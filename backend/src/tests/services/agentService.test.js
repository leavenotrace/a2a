const agentService = require('../../services/agentService');
const Agent = require('../../models/Agent');
const AgentTemplate = require('../../models/AgentTemplate');
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors');

// Mock the models
jest.mock('../../models/Agent');
jest.mock('../../models/AgentTemplate');
jest.mock('../../utils/logger');

describe('AgentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAgent', () => {
    const mockAgentData = {
      name: 'test-agent',
      description: 'Test agent description',
      config: {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 1000
      }
    };
    const userId = 1;

    it('should create agent successfully', async () => {
      const mockAgent = { id: 1, ...mockAgentData, createdBy: userId };
      
      Agent.findByName.mockResolvedValue(null);
      Agent.create.mockResolvedValue(mockAgent);

      const result = await agentService.createAgent(mockAgentData, userId);

      expect(Agent.findByName).toHaveBeenCalledWith('test-agent');
      expect(Agent.create).toHaveBeenCalledWith({
        name: 'test-agent',
        description: 'Test agent description',
        config: mockAgentData.config,
        templateId: undefined,
        createdBy: userId,
        status: 'stopped'
      });
      expect(result).toEqual(mockAgent);
    });

    it('should throw ConflictError if agent name already exists', async () => {
      Agent.findByName.mockResolvedValue({ id: 1, name: 'test-agent' });

      await expect(agentService.createAgent(mockAgentData, userId))
        .rejects.toThrow(ConflictError);
      
      expect(Agent.create).not.toHaveBeenCalled();
    });

    it('should merge template config when templateId is provided', async () => {
      const templateConfig = {
        model: 'gpt-4',
        temperature: 0.5,
        timeout: 30
      };
      const mockTemplate = {
        id: 1,
        config: templateConfig,
        isActive: true
      };
      const agentDataWithTemplate = {
        ...mockAgentData,
        templateId: 1,
        config: { temperature: 0.8 } // Override template temperature
      };
      const expectedConfig = {
        model: 'gpt-4',
        temperature: 0.8, // User config should override template
        timeout: 30
      };

      Agent.findByName.mockResolvedValue(null);
      AgentTemplate.findByPk.mockResolvedValue(mockTemplate);
      Agent.create.mockResolvedValue({ id: 1, ...agentDataWithTemplate });

      await agentService.createAgent(agentDataWithTemplate, userId);

      expect(AgentTemplate.findByPk).toHaveBeenCalledWith(1);
      expect(Agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expectedConfig
        })
      );
    });

    it('should throw NotFoundError if template does not exist', async () => {
      const agentDataWithTemplate = {
        ...mockAgentData,
        templateId: 999
      };

      Agent.findByName.mockResolvedValue(null);
      AgentTemplate.findByPk.mockResolvedValue(null);

      await expect(agentService.createAgent(agentDataWithTemplate, userId))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if template is inactive', async () => {
      const mockTemplate = {
        id: 1,
        config: { model: 'gpt-4' },
        isActive: false
      };
      const agentDataWithTemplate = {
        ...mockAgentData,
        templateId: 1
      };

      Agent.findByName.mockResolvedValue(null);
      AgentTemplate.findByPk.mockResolvedValue(mockTemplate);

      await expect(agentService.createAgent(agentDataWithTemplate, userId))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getAgents', () => {
    it('should return agents with pagination', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', status: 'running' },
        { id: 2, name: 'agent2', status: 'stopped' }
      ];
      const mockResult = {
        count: 2,
        rows: mockAgents
      };

      Agent.findAndCountAll.mockResolvedValue(mockResult);

      const result = await agentService.getAgents({
        page: 1,
        limit: 10
      });

      expect(result).toEqual({
        agents: mockAgents,
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          pages: 1
        }
      });
    });

    it('should apply status filter', async () => {
      Agent.findAndCountAll.mockResolvedValue({ count: 1, rows: [] });

      await agentService.getAgents({
        status: 'running',
        page: 1,
        limit: 10
      });

      expect(Agent.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'running'
          })
        })
      );
    });

    it('should apply search filter', async () => {
      Agent.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await agentService.getAgents({
        search: 'test',
        page: 1,
        limit: 10
      });

      const call = Agent.findAndCountAll.mock.calls[0][0];
      // Check that the where clause contains an OR condition for search
      const whereKeys = Object.getOwnPropertySymbols(call.where);
      expect(whereKeys.length).toBeGreaterThan(0);
      expect(Array.isArray(call.where[whereKeys[0]])).toBe(true);
    });
  });

  describe('getAgentById', () => {
    it('should return agent by id', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        createdBy: 1
      };

      Agent.findByPk.mockResolvedValue(mockAgent);

      const result = await agentService.getAgentById(1, 1);

      expect(Agent.findByPk).toHaveBeenCalledWith(1, expect.any(Object));
      expect(result).toEqual(mockAgent);
    });

    it('should throw NotFoundError if agent does not exist', async () => {
      Agent.findByPk.mockResolvedValue(null);

      await expect(agentService.getAgentById(999, 1))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if user does not own agent', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        createdBy: 2 // Different user
      };

      Agent.findByPk.mockResolvedValue(mockAgent);

      await expect(agentService.getAgentById(1, 1))
        .rejects.toThrow(ValidationError);
    });

    it('should allow access without user check when userId is null', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        createdBy: 2
      };

      Agent.findByPk.mockResolvedValue(mockAgent);

      const result = await agentService.getAgentById(1, null);

      expect(result).toEqual(mockAgent);
    });
  });

  describe('updateAgent', () => {
    const mockAgent = {
      id: 1,
      name: 'test-agent',
      status: 'stopped',
      createdBy: 1,
      update: jest.fn()
    };

    beforeEach(() => {
      mockAgent.update.mockClear();
    });

    it('should update agent successfully', async () => {
      const updateData = {
        name: 'updated-agent',
        description: 'Updated description',
        config: { model: 'gpt-4' }
      };

      Agent.findByPk.mockResolvedValue(mockAgent);
      Agent.findByName.mockResolvedValue(null);
      Agent.build.mockReturnValue({
        validate: jest.fn().mockResolvedValue(true)
      });
      mockAgent.update.mockResolvedValue(mockAgent);

      const result = await agentService.updateAgent(1, updateData, 1);

      expect(mockAgent.update).toHaveBeenCalledWith({
        name: 'updated-agent',
        description: 'Updated description',
        config: { model: 'gpt-4' }
      });
      expect(result).toEqual(mockAgent);
    });

    it('should throw ValidationError if agent is running', async () => {
      const runningAgent = { ...mockAgent, status: 'running' };
      Agent.findByPk.mockResolvedValue(runningAgent);

      await expect(agentService.updateAgent(1, {}, 1))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError if new name already exists', async () => {
      const updateData = { name: 'existing-agent' };
      const existingAgent = { id: 2, name: 'existing-agent' };

      Agent.findByPk.mockResolvedValue(mockAgent);
      Agent.findByName.mockResolvedValue(existingAgent);

      await expect(agentService.updateAgent(1, updateData, 1))
        .rejects.toThrow(ConflictError);
    });

    it('should allow updating to same name', async () => {
      const updateData = { name: 'test-agent' }; // Same name
      
      Agent.findByPk.mockResolvedValue(mockAgent);
      Agent.findByName.mockResolvedValue(mockAgent); // Same agent
      mockAgent.update.mockResolvedValue(mockAgent);

      await agentService.updateAgent(1, updateData, 1);

      expect(mockAgent.update).toHaveBeenCalled();
    });
  });

  describe('deleteAgent', () => {
    const mockAgent = {
      id: 1,
      name: 'test-agent',
      status: 'stopped',
      createdBy: 1,
      destroy: jest.fn()
    };

    beforeEach(() => {
      mockAgent.destroy.mockClear();
    });

    it('should delete agent successfully', async () => {
      Agent.findByPk.mockResolvedValue(mockAgent);
      mockAgent.destroy.mockResolvedValue(true);

      const result = await agentService.deleteAgent(1, 1);

      expect(mockAgent.destroy).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw ValidationError if agent is running', async () => {
      const runningAgent = { ...mockAgent, status: 'running' };
      Agent.findByPk.mockResolvedValue(runningAgent);

      await expect(agentService.deleteAgent(1, 1))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getAgentStats', () => {
    it('should return agent statistics', async () => {
      const mockStatusCounts = [
        { status: 'running', count: 5 },
        { status: 'stopped', count: 3 },
        { status: 'error', count: 1 }
      ];

      Agent.getStatusCounts.mockResolvedValue(mockStatusCounts);
      Agent.count.mockImplementation((options) => {
        if (!options) return Promise.resolve(9); // total
        if (options.where?.status === 'running') return Promise.resolve(5);
        if (options.where?.status === 'error') return Promise.resolve(1);
        return Promise.resolve(0);
      });

      const result = await agentService.getAgentStats();

      expect(result).toEqual({
        total: 9,
        running: 5,
        errors: 1,
        statusBreakdown: mockStatusCounts
      });
    });
  });

  describe('validateAgentConfig', () => {
    it('should validate config successfully', async () => {
      const config = { model: 'gpt-3.5-turbo' };
      const mockAgent = {
        validate: jest.fn().mockResolvedValue(true)
      };

      Agent.build.mockReturnValue(mockAgent);

      const result = await agentService.validateAgentConfig(config);

      expect(Agent.build).toHaveBeenCalledWith({ config });
      expect(mockAgent.validate).toHaveBeenCalledWith({ fields: ['config'] });
      expect(result).toBe(true);
    });

    it('should throw ValidationError for invalid config', async () => {
      const config = { invalid: 'config' };
      const mockAgent = {
        validate: jest.fn().mockRejectedValue(new Error('Invalid config'))
      };

      Agent.build.mockReturnValue(mockAgent);

      await expect(agentService.validateAgentConfig(config))
        .rejects.toThrow(ValidationError);
    });
  });
});