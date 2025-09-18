const { Agent, User, AgentTemplate } = require('../../models');

describe('Agent Model', () => {
    let user, template;

    beforeAll(async () => {
        await Agent.destroy({ where: {}, force: true });
        await AgentTemplate.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });

        user = await User.create({
            username: 'testuser',
            email: 'test@example.com',
            passwordHash: 'password123'
        });

        template = await AgentTemplate.create({
            name: 'Test Template',
            description: 'Test template',
            config: {
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                max_tokens: 1000
            },
            createdBy: user.id
        });
    });

    beforeEach(async () => {
        await Agent.destroy({ where: {}, force: true });
    });

    describe('Agent Creation', () => {
        test('should create an agent with valid data', async () => {
            const agentData = {
                name: 'test-agent',
                description: 'Test agent',
                config: {
                    model: 'gpt-3.5-turbo',
                    temperature: 0.7,
                    max_tokens: 1000,
                    port: 3001
                },
                templateId: template.id,
                createdBy: user.id
            };

            const agent = await Agent.create(agentData);

            expect(agent.name).toBe('test-agent');
            expect(agent.description).toBe('Test agent');
            expect(agent.status).toBe('stopped');
            expect(agent.restartCount).toBe(0);
            expect(agent.config.model).toBe('gpt-3.5-turbo');
        });

        test('should set default status to stopped', async () => {
            const agent = await Agent.create({
                name: 'test-agent',
                config: { model: 'gpt-3.5-turbo' }
            });

            expect(agent.status).toBe('stopped');
        });

        test('should set default restart count to 0', async () => {
            const agent = await Agent.create({
                name: 'test-agent',
                config: { model: 'gpt-3.5-turbo' }
            });

            expect(agent.restartCount).toBe(0);
        });
    });

    describe('Agent Validation', () => {
        test('should require name', async () => {
            await expect(Agent.create({
                config: { model: 'gpt-3.5-turbo' }
            })).rejects.toThrow();
        });

        test('should require config', async () => {
            await expect(Agent.create({
                name: 'test-agent'
            })).rejects.toThrow();
        });

        test('should validate name format', async () => {
            await expect(Agent.create({
                name: 'invalid name with spaces',
                config: { model: 'gpt-3.5-turbo' }
            })).rejects.toThrow();
        });

        test('should validate config has required model field', async () => {
            await expect(Agent.create({
                name: 'test-agent',
                config: { temperature: 0.7 }
            })).rejects.toThrow();
        });

        test('should validate port range', async () => {
            await expect(Agent.create({
                name: 'test-agent',
                config: { model: 'gpt-3.5-turbo', port: 80 }
            })).rejects.toThrow();
        });

        test('should enforce unique name', async () => {
            await Agent.create({
                name: 'test-agent',
                config: { model: 'gpt-3.5-turbo' }
            });

            await expect(Agent.create({
                name: 'test-agent',
                config: { model: 'gpt-4' }
            })).rejects.toThrow();
        });

        test('should enforce unique process ID', async () => {
            await Agent.create({
                name: 'test-agent-1',
                config: { model: 'gpt-3.5-turbo' },
                processId: 12345
            });

            await expect(Agent.create({
                name: 'test-agent-2',
                config: { model: 'gpt-4' },
                processId: 12345
            })).rejects.toThrow();
        });

        test('should enforce unique port', async () => {
            await Agent.create({
                name: 'test-agent-1',
                config: { model: 'gpt-3.5-turbo' },
                port: 3001
            });

            await expect(Agent.create({
                name: 'test-agent-2',
                config: { model: 'gpt-4' },
                port: 3001
            })).rejects.toThrow();
        });
    });

    describe('Instance Methods', () => {
        let agent;

        beforeEach(async () => {
            agent = await Agent.create({
                name: 'test-agent',
                config: { model: 'gpt-3.5-turbo' },
                status: 'stopped'
            });
        });

        test('updateStatus should update status and error message', async () => {
            await agent.updateStatus('error', 'Test error message');

            expect(agent.status).toBe('error');
            expect(agent.errorMessage).toBe('Test error message');
        });

        test('updateStatus should clear error message for non-error status', async () => {
            agent.errorMessage = 'Previous error';
            await agent.updateStatus('running');

            expect(agent.status).toBe('running');
            expect(agent.errorMessage).toBeNull();
        });

        test('updateHeartbeat should update lastHeartbeat', async () => {
            const beforeUpdate = agent.lastHeartbeat;
            await agent.updateHeartbeat();

            expect(agent.lastHeartbeat).not.toBe(beforeUpdate);
            expect(agent.lastHeartbeat).toBeInstanceOf(Date);
        });

        test('incrementRestartCount should increase restart count', async () => {
            const initialCount = agent.restartCount;
            await agent.incrementRestartCount();

            expect(agent.restartCount).toBe(initialCount + 1);
        });

        test('resetRestartCount should reset restart count to 0', async () => {
            agent.restartCount = 5;
            await agent.resetRestartCount();

            expect(agent.restartCount).toBe(0);
        });

        test('isHealthy should return false for non-running agent', () => {
            agent.status = 'stopped';
            expect(agent.isHealthy()).toBe(false);
        });

        test('isHealthy should return false for running agent without heartbeat', () => {
            agent.status = 'running';
            agent.lastHeartbeat = null;
            expect(agent.isHealthy()).toBe(false);
        });

        test('isHealthy should return false for running agent with old heartbeat', () => {
            agent.status = 'running';
            agent.lastHeartbeat = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
            expect(agent.isHealthy()).toBe(false);
        });

        test('isHealthy should return true for running agent with recent heartbeat', () => {
            agent.status = 'running';
            agent.lastHeartbeat = new Date(); // Now
            expect(agent.isHealthy()).toBe(true);
        });

        test('canStart should return true for stopped or error status', () => {
            agent.status = 'stopped';
            expect(agent.canStart()).toBe(true);

            agent.status = 'error';
            expect(agent.canStart()).toBe(true);

            agent.status = 'running';
            expect(agent.canStart()).toBe(false);
        });

        test('canStop should return true for running or starting status', () => {
            agent.status = 'running';
            expect(agent.canStop()).toBe(true);

            agent.status = 'starting';
            expect(agent.canStop()).toBe(true);

            agent.status = 'stopped';
            expect(agent.canStop()).toBe(false);
        });

        test('canRestart should return true for running or error status', () => {
            agent.status = 'running';
            expect(agent.canRestart()).toBe(true);

            agent.status = 'error';
            expect(agent.canRestart()).toBe(true);

            agent.status = 'stopped';
            expect(agent.canRestart()).toBe(false);
        });
    });

    describe('Class Methods', () => {
        beforeEach(async () => {
            await Agent.bulkCreate([
                {
                    name: 'running-agent',
                    config: { model: 'gpt-3.5-turbo' },
                    status: 'running',
                    lastHeartbeat: new Date()
                },
                {
                    name: 'stopped-agent',
                    config: { model: 'gpt-3.5-turbo' },
                    status: 'stopped'
                },
                {
                    name: 'error-agent',
                    config: { model: 'gpt-3.5-turbo' },
                    status: 'error',
                    errorMessage: 'Test error'
                },
                {
                    name: 'unhealthy-agent',
                    config: { model: 'gpt-3.5-turbo' },
                    status: 'running',
                    lastHeartbeat: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
                }
            ]);
        });

        test('findByStatus should return agents with specified status', async () => {
            const runningAgents = await Agent.findByStatus('running');
            expect(runningAgents).toHaveLength(2);
            expect(runningAgents.every(a => a.status === 'running')).toBe(true);
        });

        test('findRunning should return running agents', async () => {
            const agents = await Agent.findRunning();
            expect(agents).toHaveLength(2);
            expect(agents.every(a => a.status === 'running')).toBe(true);
        });

        test('findStopped should return stopped agents', async () => {
            const agents = await Agent.findStopped();
            expect(agents).toHaveLength(1);
            expect(agents[0].status).toBe('stopped');
        });

        test('findWithErrors should return error agents', async () => {
            const agents = await Agent.findWithErrors();
            expect(agents).toHaveLength(1);
            expect(agents[0].status).toBe('error');
        });

        test('findByName should return agent with specified name', async () => {
            const agent = await Agent.findByName('running-agent');
            expect(agent).not.toBeNull();
            expect(agent.name).toBe('running-agent');
        });

        test('getStatusCounts should return correct counts', async () => {
            const counts = await Agent.getStatusCounts();

            const runningCount = counts.find(c => c.status === 'running');
            const stoppedCount = counts.find(c => c.status === 'stopped');
            const errorCount = counts.find(c => c.status === 'error');

            expect(runningCount.count).toBe('2');
            expect(stoppedCount.count).toBe('1');
            expect(errorCount.count).toBe('1');
        });

        test('findUnhealthy should return agents with old heartbeats', async () => {
            const unhealthyAgents = await Agent.findUnhealthy();
            expect(unhealthyAgents).toHaveLength(1);
            expect(unhealthyAgents[0].name).toBe('unhealthy-agent');
        });

        test('findAvailablePort should return available port', async () => {
            // Create agents with specific ports
            await Agent.create({
                name: 'port-agent-1',
                config: { model: 'gpt-3.5-turbo' },
                port: 3001
            });

            await Agent.create({
                name: 'port-agent-2',
                config: { model: 'gpt-3.5-turbo' },
                port: 3002
            });

            const availablePort = await Agent.findAvailablePort(3001, 3010);
            expect(availablePort).toBe(3003);
        });

        test('findAvailablePort should throw error when no ports available', async () => {
            // Fill all ports in range
            const agents = [];
            for (let port = 3001; port <= 3003; port++) {
                agents.push({
                    name: `port-agent-${port}`,
                    config: { model: 'gpt-3.5-turbo' },
                    port
                });
            }
            await Agent.bulkCreate(agents);

            await expect(Agent.findAvailablePort(3001, 3003)).rejects.toThrow();
        });
    });
});