const { Op } = require('sequelize');
const Agent = require('../models/Agent');
const AgentTemplate = require('../models/AgentTemplate');
const logger = require('../utils/logger');
const processManager = require('../utils/processManager');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

class AgentService {
  /**
   * 创建新代理
   * @param {Object} agentData - 代理数据
   * @param {number} userId - 创建用户ID
   * @returns {Promise<Agent>} 创建的代理实例
   */
  async createAgent(agentData, userId) {
    try {
      const { name, description, config, templateId } = agentData;

      // 验证代理名称是否已存在
      const existingAgent = await Agent.findByName(name);
      if (existingAgent) {
        throw new ConflictError(`Agent with name '${name}' already exists`);
      }

      // 如果使用模板，验证模板是否存在并合并配置
      let finalConfig = config;
      if (templateId) {
        const template = await AgentTemplate.findByPk(templateId);
        if (!template) {
          throw new NotFoundError(`Template with id ${templateId} not found`);
        }
        if (!template.isActive) {
          throw new ValidationError('Cannot use inactive template');
        }
        
        // 合并模板配置和用户配置
        finalConfig = { ...template.config, ...config };
      }

      // 创建代理
      const agent = await Agent.create({
        name,
        description,
        config: finalConfig,
        templateId,
        createdBy: userId,
        status: 'stopped'
      });

      logger.info(`Agent created: ${name} (ID: ${agent.id}) by user ${userId}`);
      return agent;

    } catch (error) {
      logger.error('Error creating agent:', error);
      throw error;
    }
  }

  /**
   * 获取代理列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 代理列表和分页信息
   */
  async getAgents(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        userId
      } = options;

      const offset = (page - 1) * limit;
      const where = {};

      // 状态过滤
      if (status) {
        where.status = status;
      }

      // 用户过滤（如果不是管理员）
      if (userId) {
        where.createdBy = userId;
      }

      // 搜索过滤
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const { count, rows } = await Agent.findAndCountAll({
        where,
        include: [{
          model: AgentTemplate,
          as: 'template',
          attributes: ['id', 'name', 'version']
        }],
        order: [[sortBy, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return {
        agents: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting agents:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取代理详情
   * @param {number} agentId - 代理ID
   * @param {number} userId - 用户ID（用于权限检查）
   * @returns {Promise<Agent>} 代理实例
   */
  async getAgentById(agentId, userId = null) {
    try {
      const agent = await Agent.findByPk(agentId, {
        include: [{
          model: AgentTemplate,
          as: 'template',
          attributes: ['id', 'name', 'description', 'version', 'config']
        }]
      });

      if (!agent) {
        throw new NotFoundError(`Agent with id ${agentId} not found`);
      }

      // 权限检查（如果提供了用户ID）
      if (userId && agent.createdBy !== userId) {
        throw new ValidationError('Access denied: You can only access your own agents');
      }

      return agent;

    } catch (error) {
      logger.error(`Error getting agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * 更新代理配置
   * @param {number} agentId - 代理ID
   * @param {Object} updateData - 更新数据
   * @param {number} userId - 用户ID（用于权限检查）
   * @returns {Promise<Agent>} 更新后的代理实例
   */
  async updateAgent(agentId, updateData, userId = null) {
    try {
      const agent = await this.getAgentById(agentId, userId);

      // 检查代理是否可以更新
      if (agent.status === 'running') {
        throw new ValidationError('Cannot update running agent. Please stop the agent first.');
      }

      const { name, description, config } = updateData;

      // 如果更新名称，检查是否冲突
      if (name && name !== agent.name) {
        const existingAgent = await Agent.findByName(name);
        if (existingAgent && existingAgent.id !== agentId) {
          throw new ConflictError(`Agent with name '${name}' already exists`);
        }
      }

      // 更新字段
      const updateFields = {};
      if (name !== undefined) updateFields.name = name;
      if (description !== undefined) updateFields.description = description;
      if (config !== undefined) {
        // 验证配置
        const tempAgent = Agent.build({ config });
        await tempAgent.validate({ fields: ['config'] });
        updateFields.config = config;
      }

      await agent.update(updateFields);

      logger.info(`Agent updated: ${agent.name} (ID: ${agentId}) by user ${userId}`);
      return agent;

    } catch (error) {
      logger.error(`Error updating agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * 删除代理
   * @param {number} agentId - 代理ID
   * @param {number} userId - 用户ID（用于权限检查）
   * @returns {Promise<boolean>} 删除成功返回true
   */
  async deleteAgent(agentId, userId = null) {
    try {
      const agent = await this.getAgentById(agentId, userId);

      // 检查代理是否可以删除
      if (agent.status === 'running') {
        throw new ValidationError('Cannot delete running agent. Please stop the agent first.');
      }

      await agent.destroy();

      logger.info(`Agent deleted: ${agent.name} (ID: ${agentId}) by user ${userId}`);
      return true;

    } catch (error) {
      logger.error(`Error deleting agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * 获取代理状态统计
   * @returns {Promise<Object>} 状态统计信息
   */
  async getAgentStats() {
    try {
      const statusCounts = await Agent.getStatusCounts();
      const totalAgents = await Agent.count();
      const runningAgents = await Agent.count({ where: { status: 'running' } });
      const errorAgents = await Agent.count({ where: { status: 'error' } });

      return {
        total: totalAgents,
        running: runningAgents,
        errors: errorAgents,
        statusBreakdown: statusCounts
      };

    } catch (error) {
      logger.error('Error getting agent stats:', error);
      throw error;
    }
  }

  /**
   * 验证代理配置
   * @param {Object} config - 代理配置
   * @returns {Promise<boolean>} 验证成功返回true
   */
  async validateAgentConfig(config) {
    try {
      const tempAgent = Agent.build({ config });
      await tempAgent.validate({ fields: ['config'] });
      return true;

    } catch (error) {
      logger.error('Config validation error:', error);
      throw new ValidationError(`Invalid configuration: ${error.message}`);
    }
  }

  /**
   * 启动代理
   * @param {number} agentId - 代理ID
   * @param {number} userId - 用户ID（用于权限检查）
   * @returns {Promise<Object>} 进程信息
   */
  async startAgent(agentId, userId = null) {
    try {
      const agent = await this.getAgentById(agentId, userId);

      // 检查代理是否可以启动
      if (!agent.canStart()) {
        throw new ValidationError(`Agent cannot be started in current state: ${agent.status}`);
      }

      // 启动进程
      const processInfo = await processManager.startAgent(agent);

      logger.info(`Agent ${agentId} started by user ${userId}`);
      return {
        agentId: agent.id,
        name: agent.name,
        status: agent.status,
        processId: agent.processId,
        port: agent.port,
        startTime: processInfo.startTime
      };

    } catch (error) {
      logger.error(`Error starting agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * 停止代理
   * @param {number} agentId - 代理ID
   * @param {number} userId - 用户ID（用于权限检查）
   * @param {boolean} force - 是否强制停止
   * @returns {Promise<boolean>} 停止成功返回true
   */
  async stopAgent(agentId, userId = null, force = false) {
    try {
      const agent = await this.getAgentById(agentId, userId);

      // 检查代理是否可以停止
      if (!agent.canStop() && !force) {
        throw new ValidationError(`Agent cannot be stopped in current state: ${agent.status}`);
      }

      // 停止进程
      await processManager.stopAgent(agent, force);

      logger.info(`Agent ${agentId} stopped by user ${userId}${force ? ' (forced)' : ''}`);
      return true;

    } catch (error) {
      logger.error(`Error stopping agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * 重启代理
   * @param {number} agentId - 代理ID
   * @param {number} userId - 用户ID（用于权限检查）
   * @returns {Promise<Object>} 新的进程信息
   */
  async restartAgent(agentId, userId = null) {
    try {
      const agent = await this.getAgentById(agentId, userId);

      // 检查代理是否可以重启
      if (!agent.canRestart()) {
        throw new ValidationError(`Agent cannot be restarted in current state: ${agent.status}`);
      }

      // 重启进程
      const processInfo = await processManager.restartAgent(agent);

      logger.info(`Agent ${agentId} restarted by user ${userId}`);
      return {
        agentId: agent.id,
        name: agent.name,
        status: agent.status,
        processId: agent.processId,
        port: agent.port,
        startTime: processInfo.startTime,
        restartCount: agent.restartCount
      };

    } catch (error) {
      logger.error(`Error restarting agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * 获取代理进程信息
   * @param {number} agentId - 代理ID
   * @param {number} userId - 用户ID（用于权限检查）
   * @returns {Promise<Object>} 进程信息
   */
  async getAgentProcessInfo(agentId, userId = null) {
    try {
      const agent = await this.getAgentById(agentId, userId);
      const processInfo = processManager.getProcessInfo(agentId);

      return {
        agentId: agent.id,
        name: agent.name,
        status: agent.status,
        processId: agent.processId,
        port: agent.port,
        lastHeartbeat: agent.lastHeartbeat,
        restartCount: agent.restartCount,
        processInfo: processInfo
      };

    } catch (error) {
      logger.error(`Error getting process info for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * 获取所有运行中的进程信息
   * @returns {Promise<Array>} 进程信息列表
   */
  async getAllProcessInfo() {
    try {
      const processes = processManager.getAllProcesses();
      const agentIds = processes.map(p => p.agentId);
      
      if (agentIds.length === 0) {
        return [];
      }

      const agents = await Agent.findAll({
        where: { id: { [Op.in]: agentIds } },
        attributes: ['id', 'name', 'status', 'processId', 'port', 'lastHeartbeat', 'restartCount']
      });

      const agentMap = new Map(agents.map(a => [a.id, a]));

      return processes.map(processInfo => {
        const agent = agentMap.get(processInfo.agentId);
        return {
          agentId: processInfo.agentId,
          name: agent?.name || 'Unknown',
          status: agent?.status || 'unknown',
          processId: agent?.processId,
          port: agent?.port,
          lastHeartbeat: agent?.lastHeartbeat,
          restartCount: agent?.restartCount || 0,
          processInfo: {
            pid: processInfo.pid,
            status: processInfo.status,
            startTime: processInfo.startTime,
            uptime: processInfo.uptime,
            memoryUsage: processInfo.memoryUsage,
            cpuUsage: processInfo.cpuUsage
          }
        };
      });

    } catch (error) {
      logger.error('Error getting all process info:', error);
      throw error;
    }
  }

  /**
   * 检查代理健康状态
   * @param {number} agentId - 代理ID
   * @param {number} userId - 用户ID（用于权限检查）
   * @returns {Promise<Object>} 健康状态信息
   */
  async checkAgentHealth(agentId, userId = null) {
    try {
      const agent = await this.getAgentById(agentId, userId);
      const isHealthy = processManager.isProcessHealthy(agentId);
      const processInfo = processManager.getProcessInfo(agentId);

      return {
        agentId: agent.id,
        name: agent.name,
        status: agent.status,
        isHealthy,
        isRunning: agent.status === 'running',
        lastHeartbeat: agent.lastHeartbeat,
        processInfo: processInfo
      };

    } catch (error) {
      logger.error(`Error checking health for agent ${agentId}:`, error);
      throw error;
    }
  }
}

module.exports = new AgentService();