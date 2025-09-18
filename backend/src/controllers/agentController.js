const agentService = require('../services/agentService');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

class AgentController {
  /**
   * 创建新代理
   */
  async createAgent(req, res, next) {
    try {
      const { name, description, config, templateId } = req.body;
      const userId = req.user?.id;

      // 验证必需字段
      if (!name || !config) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Name and config are required fields'
        });
      }

      const agent = await agentService.createAgent({
        name,
        description,
        config,
        templateId
      }, userId);

      res.status(201).json({
        success: true,
        data: agent,
        message: 'Agent created successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取代理列表
   */
  async getAgents(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

      const userId = req.user?.role === 'admin' ? null : req.user?.id;

      const result = await agentService.getAgents({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        search,
        sortBy,
        sortOrder,
        userId
      });

      res.json({
        success: true,
        data: result.agents,
        pagination: result.pagination
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取代理详情
   */
  async getAgentById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.role === 'admin' ? null : req.user?.id;

      const agent = await agentService.getAgentById(parseInt(id), userId);

      res.json({
        success: true,
        data: agent
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新代理
   */
  async updateAgent(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description, config } = req.body;
      const userId = req.user?.role === 'admin' ? null : req.user?.id;

      const agent = await agentService.updateAgent(parseInt(id), {
        name,
        description,
        config
      }, userId);

      res.json({
        success: true,
        data: agent,
        message: 'Agent updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除代理
   */
  async deleteAgent(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.role === 'admin' ? null : req.user?.id;

      await agentService.deleteAgent(parseInt(id), userId);

      res.json({
        success: true,
        message: 'Agent deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取代理状态统计
   */
  async getAgentStats(req, res, next) {
    try {
      const stats = await agentService.getAgentStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 验证代理配置
   */
  async validateConfig(req, res, next) {
    try {
      const { config } = req.body;

      if (!config) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Config is required'
        });
      }

      await agentService.validateAgentConfig(config);

      res.json({
        success: true,
        message: 'Configuration is valid'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 启动代理
   */
  async startAgent(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.role === 'admin' ? null : req.user?.id;

      const result = await agentService.startAgent(parseInt(id), userId);

      res.json({
        success: true,
        data: result,
        message: 'Agent started successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 停止代理
   */
  async stopAgent(req, res, next) {
    try {
      const { id } = req.params;
      const { force = false } = req.body;
      const userId = req.user?.role === 'admin' ? null : req.user?.id;

      await agentService.stopAgent(parseInt(id), userId, force);

      res.json({
        success: true,
        message: 'Agent stopped successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 重启代理
   */
  async restartAgent(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.role === 'admin' ? null : req.user?.id;

      const result = await agentService.restartAgent(parseInt(id), userId);

      res.json({
        success: true,
        data: result,
        message: 'Agent restarted successfully'
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取代理进程信息
   */
  async getAgentProcessInfo(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.role === 'admin' ? null : req.user?.id;

      const processInfo = await agentService.getAgentProcessInfo(parseInt(id), userId);

      res.json({
        success: true,
        data: processInfo
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取所有进程信息
   */
  async getAllProcessInfo(req, res, next) {
    try {
      const processes = await agentService.getAllProcessInfo();

      res.json({
        success: true,
        data: processes
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * 检查代理健康状态
   */
  async checkAgentHealth(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.role === 'admin' ? null : req.user?.id;

      const health = await agentService.checkAgentHealth(parseInt(id), userId);

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AgentController();