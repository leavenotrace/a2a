const processManager = require('../../utils/processManager');
const Agent = require('../../models/Agent');
const { spawn } = require('child_process');
const EventEmitter = require('events');

// Mock dependencies
jest.mock('child_process');
jest.mock('../../models/Agent');
jest.mock('../../utils/logger');

describe('ProcessManager', () => {
  let mockAgent;
  let mockChildProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAgent = {
      id: 1,
      name: 'test-agent',
      status: 'stopped',
      config: { model: 'gpt-3.5-turbo' },
      port: null,
      processId: null,
      canStart: jest.fn().mockReturnValue(true),
      canStop: jest.fn().mockReturnValue(true),
      canRestart: jest.fn().mockReturnValue(true),
      updateStatus: jest.fn().mockResolvedValue(true),
      updateHeartbeat: jest.fn().mockResolvedValue(true),
      incrementRestartCount: jest.fn().mockResolvedValue(true),
      save: jest.fn().mockResolvedValue(true)
    };

    mockChildProcess = new EventEmitter();
    mockChildProcess.pid = 12345;
    mockChildProcess.kill = jest.fn();
    mockChildProcess.killed = false;
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    spawn.mockReturnValue(mockChildProcess);
    Agent.findAvailablePort = jest.fn().mockResolvedValue(3001);
  });

  afterEach(() => {
    // Clean up any processes in the manager
    processManager.processes.clear();
  });

  describe('startAgent', () => {
    it('should start agent successfully', async () => {
      const startPromise = processManager.startAgent(mockAgent);
      
      // Simulate process ready
      setTimeout(() => {
        mockChildProcess.stdout.emit('data', JSON.stringify({
          type: 'ready',
          agentId: 1
        }));
      }, 100);

      const result = await startPromise;

      expect(mockAgent.canStart).toHaveBeenCalled();
      expect(mockAgent.updateStatus).toHaveBeenCalledWith('starting');
      expect(spawn).toHaveBeenCalled();
      expect(mockAgent.save).toHaveBeenCalled();
      expect(result.pid).toBe(12345);
    });

    it('should throw error if agent cannot start', async () => {
      mockAgent.canStart.mockReturnValue(false);

      await expect(processManager.startAgent(mockAgent))
        .rejects.toThrow('cannot be started');
      
      expect(spawn).not.toHaveBeenCalled();
    });

    it('should throw error if agent is already running', async () => {
      // Add agent to processes map with proper structure
      processManager.processes.set(1, { 
        pid: 12345,
        agent: mockAgent,
        process: mockChildProcess
      });

      await expect(processManager.startAgent(mockAgent))
        .rejects.toThrow('already running');
    });

    it('should assign port if not set', async () => {
      const startPromise = processManager.startAgent(mockAgent);
      
      setTimeout(() => {
        mockChildProcess.stdout.emit('data', JSON.stringify({
          type: 'ready',
          agentId: 1
        }));
      }, 100);

      await startPromise;

      expect(Agent.findAvailablePort).toHaveBeenCalled();
      expect(mockAgent.port).toBe(3001);
    });
  });

  describe('stopAgent', () => {
    beforeEach(() => {
      // Add agent to processes map
      processManager.processes.set(1, {
        pid: 12345,
        process: mockChildProcess,
        agent: mockAgent
      });
    });

    it('should stop agent gracefully', async () => {
      const stopPromise = processManager.stopAgent(mockAgent);
      
      // Simulate process exit
      setTimeout(() => {
        mockChildProcess.emit('exit', 0, 'SIGTERM');
      }, 100);

      const result = await stopPromise;

      expect(mockAgent.updateStatus).toHaveBeenCalledWith('stopping');
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(result).toBe(true);
    });

    it('should force kill agent if force is true', async () => {
      const stopPromise = processManager.stopAgent(mockAgent, true);
      
      setTimeout(() => {
        mockChildProcess.emit('exit', 0, 'SIGKILL');
      }, 100);

      await stopPromise;

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('should throw error if agent cannot stop', async () => {
      mockAgent.canStop.mockReturnValue(false);

      await expect(processManager.stopAgent(mockAgent))
        .rejects.toThrow('cannot be stopped');
    });

    it('should handle missing process gracefully', async () => {
      processManager.processes.delete(1);

      const result = await processManager.stopAgent(mockAgent);

      expect(result).toBe(true);
      expect(mockAgent.updateStatus).toHaveBeenCalledWith('stopped');
    });
  });

  describe('restartAgent', () => {
    beforeEach(() => {
      processManager.processes.set(1, {
        pid: 12345,
        process: mockChildProcess,
        agent: mockAgent
      });
    });

    it('should restart agent successfully', async () => {
      // Mock the stopAgent and startAgent methods to avoid complex timing issues
      const originalStopAgent = processManager.stopAgent;
      const originalStartAgent = processManager.startAgent;
      
      processManager.stopAgent = jest.fn().mockResolvedValue(true);
      processManager.startAgent = jest.fn().mockResolvedValue({ pid: 12346 });

      const result = await processManager.restartAgent(mockAgent);

      expect(mockAgent.incrementRestartCount).toHaveBeenCalled();
      expect(processManager.stopAgent).toHaveBeenCalledWith(mockAgent, false);
      expect(processManager.startAgent).toHaveBeenCalledWith(mockAgent);
      expect(result.pid).toBe(12346);
      
      // Restore original methods
      processManager.stopAgent = originalStopAgent;
      processManager.startAgent = originalStartAgent;
    });
  });

  describe('getProcessInfo', () => {
    it('should return process info if exists', () => {
      const processInfo = {
        pid: 12345,
        status: 'running',
        startTime: new Date(),
        restartCount: 0,
        lastHeartbeat: new Date()
      };
      
      processManager.processes.set(1, processInfo);

      const result = processManager.getProcessInfo(1);

      expect(result).toMatchObject({
        pid: 12345,
        status: 'running'
      });
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return null if process does not exist', () => {
      const result = processManager.getProcessInfo(999);
      expect(result).toBeNull();
    });
  });

  describe('isProcessHealthy', () => {
    it('should return true for healthy process', () => {
      const processInfo = {
        pid: 12345,
        lastHeartbeat: new Date()
      };
      
      processManager.processes.set(1, processInfo);
      
      // Mock process.kill to not throw
      const originalKill = process.kill;
      process.kill = jest.fn();

      const result = processManager.isProcessHealthy(1);

      expect(result).toBe(true);
      
      // Restore original function
      process.kill = originalKill;
    });

    it('should return false for non-existent process', () => {
      const result = processManager.isProcessHealthy(999);
      expect(result).toBe(false);
    });

    it('should return false for process with old heartbeat', () => {
      const oldHeartbeat = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const processInfo = {
        pid: 12345,
        lastHeartbeat: oldHeartbeat
      };
      
      processManager.processes.set(1, processInfo);
      
      const originalKill = process.kill;
      process.kill = jest.fn();

      const result = processManager.isProcessHealthy(1);

      expect(result).toBe(false);
      
      process.kill = originalKill;
    });
  });

  describe('handleProcessMessage', () => {
    beforeEach(() => {
      processManager.processes.set(1, {
        pid: 12345,
        agent: mockAgent,
        lastHeartbeat: new Date(Date.now() - 60000) // 1 minute ago
      });
    });

    it('should handle heartbeat message', () => {
      const message = JSON.stringify({
        type: 'heartbeat',
        agentId: 1
      });

      processManager.handleProcessMessage(1, message);

      const processInfo = processManager.processes.get(1);
      expect(processInfo.status).toBe('running');
      expect(processInfo.lastHeartbeat.getTime()).toBeGreaterThan(Date.now() - 1000);
      expect(mockAgent.updateStatus).toHaveBeenCalledWith('running');
      expect(mockAgent.updateHeartbeat).toHaveBeenCalled();
    });

    it('should handle metrics message', () => {
      const message = JSON.stringify({
        type: 'metrics',
        memory: { rss: 1000000 },
        cpu: { user: 100000 }
      });

      processManager.handleProcessMessage(1, message);

      const processInfo = processManager.processes.get(1);
      expect(processInfo.memoryUsage).toEqual({ rss: 1000000 });
      expect(processInfo.cpuUsage).toEqual({ user: 100000 });
    });

    it('should handle ready message', () => {
      const message = JSON.stringify({
        type: 'ready'
      });

      processManager.handleProcessMessage(1, message);

      const processInfo = processManager.processes.get(1);
      expect(processInfo.status).toBe('running');
      expect(mockAgent.updateStatus).toHaveBeenCalledWith('running');
    });

    it('should ignore invalid JSON messages', () => {
      const message = 'invalid json';

      // Should not throw
      expect(() => {
        processManager.handleProcessMessage(1, message);
      }).not.toThrow();
    });
  });

  describe('getAllProcesses', () => {
    it('should return all process information', () => {
      const processInfo1 = {
        pid: 12345,
        status: 'running',
        startTime: new Date(),
        restartCount: 0,
        lastHeartbeat: new Date()
      };
      
      const processInfo2 = {
        pid: 12346,
        status: 'running',
        startTime: new Date(),
        restartCount: 1,
        lastHeartbeat: new Date()
      };

      processManager.processes.set(1, processInfo1);
      processManager.processes.set(2, processInfo2);

      const result = processManager.getAllProcesses();

      expect(result).toHaveLength(2);
      expect(result[0].agentId).toBe(1);
      expect(result[1].agentId).toBe(2);
    });

    it('should return empty array if no processes', () => {
      const result = processManager.getAllProcesses();
      expect(result).toEqual([]);
    });
  });
});