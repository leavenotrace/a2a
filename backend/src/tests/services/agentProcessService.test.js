const agentService = require('../../services/agentService');
const processManager = require('../../utils/processManager');
const Agent = require('../../models/Agent');
const { ValidationError } = require('../../utils/errors');

// Mock dependencies
jest.mock('../../models/Agent');
jest.mock('../../utils/processManager');
jest.mock('../../utils/logger');

describe('AgentService - Process Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startAgent', () => {
    const mockAgent = {
      id: 1,
      name: 'test-agent',
      status: 'stopped',
      processId: null,
      port: null,
      createdBy: 1, // Add createdBy to match userId
      canStart: jest.fn().mockReturnValue(true)
    };

    it('should start agent successfully', async () => {
      const mockProcessInfo = {
        pid: 12345,
        startTime: new Date()
      };

      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.startAgent.mockResolvedValue(mockProcessInfo);

      const result = await agentService.startAgent(1, 1);

      expect(Agent.findByPk).toHaveBeenCalledWith(1, expect.any(Object));
      expect(processManager.startAgent).toHaveBeenCalledWith(mockAgent);
      expect(result).toMatchObject({
        agentId: 1,
        name: 'test-agent',
        status: 'stopped'
      });
    });

    it('should throw ValidationError if agent cannot start', async () => {
      mockAgent.canStart.mockReturnValue(false);
      Agent.findByPk.mockResolvedValue(mockAgent);

      await expect(agentService.startAgent(1, 1))
        .rejects.toThrow(ValidationError);
      
      expect(processManager.startAgent).not.toHaveBeenCalled();
    });

    it('should propagate process manager errors', async () => {
      const error = new Error('Process start failed');
      
      // Ensure agent can start
      mockAgent.canStart.mockReturnValue(true);
      
      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.startAgent.mockRejectedValue(error);

      await expect(agentService.startAgent(1, 1))
        .rejects.toThrow(error);
    });
  });

  describe('stopAgent', () => {
    const mockAgent = {
      id: 1,
      name: 'test-agent',
      status: 'running',
      createdBy: 1, // Add createdBy to match userId
      canStop: jest.fn().mockReturnValue(true)
    };

    it('should stop agent successfully', async () => {
      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.stopAgent.mockResolvedValue(true);

      const result = await agentService.stopAgent(1, 1);

      expect(processManager.stopAgent).toHaveBeenCalledWith(mockAgent, false);
      expect(result).toBe(true);
    });

    it('should stop agent with force flag', async () => {
      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.stopAgent.mockResolvedValue(true);

      await agentService.stopAgent(1, 1, true);

      expect(processManager.stopAgent).toHaveBeenCalledWith(mockAgent, true);
    });

    it('should throw ValidationError if agent cannot stop without force', async () => {
      mockAgent.canStop.mockReturnValue(false);
      Agent.findByPk.mockResolvedValue(mockAgent);

      await expect(agentService.stopAgent(1, 1, false))
        .rejects.toThrow(ValidationError);
    });

    it('should allow force stop even if agent cannot stop normally', async () => {
      mockAgent.canStop.mockReturnValue(false);
      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.stopAgent.mockResolvedValue(true);

      const result = await agentService.stopAgent(1, 1, true);

      expect(result).toBe(true);
      expect(processManager.stopAgent).toHaveBeenCalledWith(mockAgent, true);
    });
  });

  describe('restartAgent', () => {
    const mockAgent = {
      id: 1,
      name: 'test-agent',
      status: 'running',
      restartCount: 2,
      createdBy: 1, // Add createdBy to match userId
      canRestart: jest.fn().mockReturnValue(true)
    };

    it('should restart agent successfully', async () => {
      const mockProcessInfo = {
        pid: 12346,
        startTime: new Date()
      };

      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.restartAgent.mockResolvedValue(mockProcessInfo);

      const result = await agentService.restartAgent(1, 1);

      expect(processManager.restartAgent).toHaveBeenCalledWith(mockAgent);
      expect(result).toMatchObject({
        agentId: 1,
        name: 'test-agent',
        restartCount: 2
      });
    });

    it('should throw ValidationError if agent cannot restart', async () => {
      mockAgent.canRestart.mockReturnValue(false);
      Agent.findByPk.mockResolvedValue(mockAgent);

      await expect(agentService.restartAgent(1, 1))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getAgentProcessInfo', () => {
    const mockAgent = {
      id: 1,
      name: 'test-agent',
      status: 'running',
      processId: 12345,
      port: 3001,
      lastHeartbeat: new Date(),
      restartCount: 1,
      createdBy: 1 // Add createdBy to match userId
    };

    it('should return process info successfully', async () => {
      const mockProcessInfo = {
        pid: 12345,
        status: 'running',
        uptime: 60000,
        memoryUsage: { rss: 1000000 }
      };

      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.getProcessInfo.mockReturnValue(mockProcessInfo);

      const result = await agentService.getAgentProcessInfo(1, 1);

      expect(result).toMatchObject({
        agentId: 1,
        name: 'test-agent',
        status: 'running',
        processId: 12345,
        port: 3001,
        restartCount: 1,
        processInfo: mockProcessInfo
      });
    });

    it('should return null process info if not running', async () => {
      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.getProcessInfo.mockReturnValue(null);

      const result = await agentService.getAgentProcessInfo(1, 1);

      expect(result.processInfo).toBeNull();
    });
  });

  describe('getAllProcessInfo', () => {
    it('should return all process info successfully', async () => {
      const mockProcesses = [
        { agentId: 1, pid: 12345, status: 'running' },
        { agentId: 2, pid: 12346, status: 'running' }
      ];

      const mockAgents = [
        { id: 1, name: 'agent1', status: 'running', processId: 12345, port: 3001 },
        { id: 2, name: 'agent2', status: 'running', processId: 12346, port: 3002 }
      ];

      processManager.getAllProcesses.mockReturnValue(mockProcesses);
      Agent.findAll.mockResolvedValue(mockAgents);

      const result = await agentService.getAllProcessInfo();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        agentId: 1,
        name: 'agent1',
        processInfo: { pid: 12345, status: 'running' }
      });
    });

    it('should return empty array if no processes', async () => {
      processManager.getAllProcesses.mockReturnValue([]);

      const result = await agentService.getAllProcessInfo();

      expect(result).toEqual([]);
      expect(Agent.findAll).not.toHaveBeenCalled();
    });
  });

  describe('checkAgentHealth', () => {
    const mockAgent = {
      id: 1,
      name: 'test-agent',
      status: 'running',
      lastHeartbeat: new Date(),
      createdBy: 1 // Add createdBy to match userId
    };

    it('should return health status successfully', async () => {
      const mockProcessInfo = {
        pid: 12345,
        status: 'running'
      };

      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.isProcessHealthy.mockReturnValue(true);
      processManager.getProcessInfo.mockReturnValue(mockProcessInfo);

      const result = await agentService.checkAgentHealth(1, 1);

      expect(result).toMatchObject({
        agentId: 1,
        name: 'test-agent',
        status: 'running',
        isHealthy: true,
        isRunning: true,
        processInfo: mockProcessInfo
      });
    });

    it('should return unhealthy status for unhealthy process', async () => {
      Agent.findByPk.mockResolvedValue(mockAgent);
      processManager.isProcessHealthy.mockReturnValue(false);
      processManager.getProcessInfo.mockReturnValue(null);

      const result = await agentService.checkAgentHealth(1, 1);

      expect(result.isHealthy).toBe(false);
    });

    it('should return not running for stopped agent', async () => {
      const stoppedAgent = { ...mockAgent, status: 'stopped' };
      
      Agent.findByPk.mockResolvedValue(stoppedAgent);
      processManager.isProcessHealthy.mockReturnValue(false);
      processManager.getProcessInfo.mockReturnValue(null);

      const result = await agentService.checkAgentHealth(1, 1);

      expect(result.isRunning).toBe(false);
    });
  });
});