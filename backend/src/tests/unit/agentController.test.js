const agentController = require('../../controllers/agentController');
const agentService = require('../../services/agentService');
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors');

// Mock the service
jest.mock('../../services/agentService');
jest.mock('../../utils/logger');

describe('AgentController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 1, role: 'user' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('createAgent', () => {
    it('should create agent successfully', async () => {
      const agentData = {
        name: 'test-agent',
        description: 'Test description',
        config: { model: 'gpt-3.5-turbo' }
      };
      const mockAgent = { id: 1, ...agentData };

      req.body = agentData;
      agentService.createAgent.mockResolvedValue(mockAgent);

      await agentController.createAgent(req, res, next);

      expect(agentService.createAgent).toHaveBeenCalledWith(agentData, 1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAgent,
        message: 'Agent created successfully'
      });
    });

    it('should return 400 if name is missing', async () => {
      req.body = { config: { model: 'gpt-3.5-turbo' } }; // Missing name

      await agentController.createAgent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'VALIDATION_ERROR',
        message: 'Name and config are required fields'
      });
      expect(agentService.createAgent).not.toHaveBeenCalled();
    });

    it('should return 400 if config is missing', async () => {
      req.body = { name: 'test-agent' }; // Missing config

      await agentController.createAgent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'VALIDATION_ERROR',
        message: 'Name and config are required fields'
      });
      expect(agentService.createAgent).not.toHaveBeenCalled();
    });

    it('should call next with error if service throws', async () => {
      const error = new ConflictError('Agent already exists');
      req.body = {
        name: 'test-agent',
        config: { model: 'gpt-3.5-turbo' }
      };

      agentService.createAgent.mockRejectedValue(error);

      await agentController.createAgent(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getAgents', () => {
    it('should get agents successfully', async () => {
      const mockResult = {
        agents: [{ id: 1, name: 'agent1' }],
        pagination: { total: 1, page: 1, limit: 10, pages: 1 }
      };

      req.query = { page: '1', limit: '10' };
      agentService.getAgents.mockResolvedValue(mockResult);

      await agentController.getAgents(req, res, next);

      expect(agentService.getAgents).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        status: undefined,
        search: undefined,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        userId: 1 // Non-admin user should have userId filter
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult.agents,
        pagination: mockResult.pagination
      });
    });

    it('should not filter by userId for admin users', async () => {
      req.user.role = 'admin';
      req.query = {};
      agentService.getAgents.mockResolvedValue({
        agents: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 }
      });

      await agentController.getAgents(req, res, next);

      expect(agentService.getAgents).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null // Admin should see all agents
        })
      );
    });

    it('should pass query parameters to service', async () => {
      req.query = {
        page: '2',
        limit: '5',
        status: 'running',
        search: 'test',
        sortBy: 'name',
        sortOrder: 'ASC'
      };
      agentService.getAgents.mockResolvedValue({
        agents: [],
        pagination: { total: 0, page: 2, limit: 5, pages: 0 }
      });

      await agentController.getAgents(req, res, next);

      expect(agentService.getAgents).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        status: 'running',
        search: 'test',
        sortBy: 'name',
        sortOrder: 'ASC',
        userId: 1
      });
    });
  });

  describe('getAgentById', () => {
    it('should get agent by id successfully', async () => {
      const mockAgent = { id: 1, name: 'test-agent' };
      req.params.id = '1';
      agentService.getAgentById.mockResolvedValue(mockAgent);

      await agentController.getAgentById(req, res, next);

      expect(agentService.getAgentById).toHaveBeenCalledWith(1, 1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAgent
      });
    });

    it('should not filter by userId for admin users', async () => {
      req.user.role = 'admin';
      req.params.id = '1';
      agentService.getAgentById.mockResolvedValue({ id: 1 });

      await agentController.getAgentById(req, res, next);

      expect(agentService.getAgentById).toHaveBeenCalledWith(1, null);
    });
  });

  describe('updateAgent', () => {
    it('should update agent successfully', async () => {
      const updateData = {
        name: 'updated-agent',
        description: 'Updated description',
        config: { model: 'gpt-4' }
      };
      const mockAgent = { id: 1, ...updateData };

      req.params.id = '1';
      req.body = updateData;
      agentService.updateAgent.mockResolvedValue(mockAgent);

      await agentController.updateAgent(req, res, next);

      expect(agentService.updateAgent).toHaveBeenCalledWith(1, updateData, 1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAgent,
        message: 'Agent updated successfully'
      });
    });

    it('should handle partial updates', async () => {
      const updateData = { name: 'new-name' };
      const mockAgent = { id: 1, name: 'new-name' };

      req.params.id = '1';
      req.body = updateData;
      agentService.updateAgent.mockResolvedValue(mockAgent);

      await agentController.updateAgent(req, res, next);

      expect(agentService.updateAgent).toHaveBeenCalledWith(1, {
        name: 'new-name',
        description: undefined,
        config: undefined
      }, 1);
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent successfully', async () => {
      req.params.id = '1';
      agentService.deleteAgent.mockResolvedValue(true);

      await agentController.deleteAgent(req, res, next);

      expect(agentService.deleteAgent).toHaveBeenCalledWith(1, 1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Agent deleted successfully'
      });
    });
  });

  describe('getAgentStats', () => {
    it('should get agent stats successfully', async () => {
      const mockStats = {
        total: 10,
        running: 5,
        errors: 1,
        statusBreakdown: []
      };

      agentService.getAgentStats.mockResolvedValue(mockStats);

      await agentController.getAgentStats(req, res, next);

      expect(agentService.getAgentStats).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });
  });

  describe('validateConfig', () => {
    it('should validate config successfully', async () => {
      const config = { model: 'gpt-3.5-turbo' };
      req.body = { config };
      agentService.validateAgentConfig.mockResolvedValue(true);

      await agentController.validateConfig(req, res, next);

      expect(agentService.validateAgentConfig).toHaveBeenCalledWith(config);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Configuration is valid'
      });
    });

    it('should return 400 if config is missing', async () => {
      req.body = {}; // Missing config

      await agentController.validateConfig(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'VALIDATION_ERROR',
        message: 'Config is required'
      });
      expect(agentService.validateAgentConfig).not.toHaveBeenCalled();
    });
  });
});