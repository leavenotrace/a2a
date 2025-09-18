const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');
const { InternalServerError } = require('./errors');

class ProcessManager {
  constructor() {
    this.processes = new Map(); // agentId -> process info
    this.heartbeatInterval = 30000; // 30 seconds
    this.maxRestartAttempts = 3;
    this.restartDelay = 5000; // 5 seconds
  }

  /**
   * 启动代理进程
   * @param {Object} agent - 代理实例
   * @returns {Promise<Object>} 进程信息
   */
  async startAgent(agent) {
    try {
      if (this.processes.has(agent.id)) {
        throw new Error(`Agent ${agent.id} is already running`);
      }

      // 检查代理是否可以启动
      if (!agent.canStart()) {
        throw new Error(`Agent ${agent.id} cannot be started in current state: ${agent.status}`);
      }

      // 更新代理状态为启动中
      await agent.updateStatus('starting');

      // 分配端口
      const port = agent.port || await this.findAvailablePort();
      if (!agent.port) {
        agent.port = port;
        await agent.save();
      }

      // 创建进程配置
      const processConfig = this.createProcessConfig(agent);
      
      // 启动进程
      const childProcess = spawn('node', [processConfig.scriptPath], {
        cwd: processConfig.workingDir,
        env: {
          ...process.env,
          ...processConfig.env,
          AGENT_ID: agent.id.toString(),
          AGENT_PORT: port.toString(),
          AGENT_CONFIG: JSON.stringify(agent.config)
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      // 存储进程信息
      const processInfo = {
        pid: childProcess.pid,
        process: childProcess,
        agent: agent,
        startTime: new Date(),
        restartCount: 0,
        lastHeartbeat: new Date(),
        status: 'starting'
      };

      this.processes.set(agent.id, processInfo);

      // 设置进程事件监听器
      this.setupProcessListeners(agent.id, childProcess);

      // 更新代理进程ID
      agent.processId = childProcess.pid;
      await agent.save();

      // 等待进程启动完成
      await this.waitForProcessReady(agent.id, 30000); // 30秒超时

      logger.info(`Agent ${agent.id} started successfully with PID ${childProcess.pid}`);
      
      return processInfo;

    } catch (error) {
      logger.error(`Failed to start agent ${agent.id}:`, error);
      
      // 清理失败的进程
      if (this.processes.has(agent.id)) {
        await this.cleanupProcess(agent.id);
      }
      
      // 更新代理状态为错误
      await agent.updateStatus('error', error.message);
      
      throw error;
    }
  }

  /**
   * 停止代理进程
   * @param {Object} agent - 代理实例
   * @param {boolean} force - 是否强制停止
   * @returns {Promise<boolean>} 停止成功返回true
   */
  async stopAgent(agent, force = false) {
    try {
      const processInfo = this.processes.get(agent.id);
      
      if (!processInfo) {
        logger.warn(`No running process found for agent ${agent.id}`);
        await agent.updateStatus('stopped');
        return true;
      }

      // 检查代理是否可以停止
      if (!agent.canStop() && !force) {
        throw new Error(`Agent ${agent.id} cannot be stopped in current state: ${agent.status}`);
      }

      // 更新代理状态为停止中
      await agent.updateStatus('stopping');

      const { process: childProcess } = processInfo;

      if (force) {
        // 强制终止进程
        childProcess.kill('SIGKILL');
        logger.info(`Agent ${agent.id} force killed`);
      } else {
        // 优雅停止进程
        childProcess.kill('SIGTERM');
        
        // 等待进程优雅退出
        const gracefulTimeout = setTimeout(() => {
          if (!childProcess.killed) {
            logger.warn(`Agent ${agent.id} did not exit gracefully, force killing`);
            childProcess.kill('SIGKILL');
          }
        }, 10000); // 10秒超时

        // 等待进程退出
        await new Promise((resolve) => {
          childProcess.on('exit', () => {
            clearTimeout(gracefulTimeout);
            resolve();
          });
        });
      }

      // 清理进程信息
      await this.cleanupProcess(agent.id);

      logger.info(`Agent ${agent.id} stopped successfully`);
      return true;

    } catch (error) {
      logger.error(`Failed to stop agent ${agent.id}:`, error);
      throw error;
    }
  }

  /**
   * 重启代理进程
   * @param {Object} agent - 代理实例
   * @returns {Promise<Object>} 新的进程信息
   */
  async restartAgent(agent) {
    try {
      logger.info(`Restarting agent ${agent.id}`);

      // 停止当前进程
      if (this.processes.has(agent.id)) {
        await this.stopAgent(agent, false);
      }

      // 等待一段时间后重启
      await new Promise(resolve => setTimeout(resolve, this.restartDelay));

      // 增加重启计数
      await agent.incrementRestartCount();

      // 启动新进程
      return await this.startAgent(agent);

    } catch (error) {
      logger.error(`Failed to restart agent ${agent.id}:`, error);
      throw error;
    }
  }

  /**
   * 获取代理进程状态
   * @param {number} agentId - 代理ID
   * @returns {Object|null} 进程信息
   */
  getProcessInfo(agentId) {
    const processInfo = this.processes.get(agentId);
    if (!processInfo) {
      return null;
    }

    return {
      pid: processInfo.pid,
      status: processInfo.status,
      startTime: processInfo.startTime,
      uptime: Date.now() - processInfo.startTime.getTime(),
      restartCount: processInfo.restartCount,
      lastHeartbeat: processInfo.lastHeartbeat,
      memoryUsage: processInfo.memoryUsage || null,
      cpuUsage: processInfo.cpuUsage || null
    };
  }

  /**
   * 获取所有运行中的进程
   * @returns {Array} 进程信息列表
   */
  getAllProcesses() {
    const processes = [];
    for (const [agentId, processInfo] of this.processes) {
      processes.push({
        agentId,
        ...this.getProcessInfo(agentId)
      });
    }
    return processes;
  }

  /**
   * 检查进程健康状态
   * @param {number} agentId - 代理ID
   * @returns {boolean} 健康返回true
   */
  isProcessHealthy(agentId) {
    const processInfo = this.processes.get(agentId);
    if (!processInfo) {
      return false;
    }

    // 检查进程是否还在运行
    try {
      process.kill(processInfo.pid, 0);
    } catch (error) {
      return false;
    }

    // 检查心跳时间
    const heartbeatAge = Date.now() - processInfo.lastHeartbeat.getTime();
    return heartbeatAge < this.heartbeatInterval * 2;
  }

  /**
   * 创建进程配置
   * @param {Object} agent - 代理实例
   * @returns {Object} 进程配置
   */
  createProcessConfig(agent) {
    // 这里应该根据代理配置创建实际的启动脚本
    // 目前使用一个模拟的代理进程脚本
    return {
      scriptPath: path.join(__dirname, '../scripts/agentRunner.js'),
      workingDir: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        AGENT_NAME: agent.name,
        AGENT_DESCRIPTION: agent.description || ''
      }
    };
  }

  /**
   * 设置进程事件监听器
   * @param {number} agentId - 代理ID
   * @param {ChildProcess} childProcess - 子进程
   */
  setupProcessListeners(agentId, childProcess) {
    const processInfo = this.processes.get(agentId);
    if (!processInfo) return;

    // 进程退出事件
    childProcess.on('exit', async (code, signal) => {
      logger.info(`Agent ${agentId} process exited with code ${code}, signal ${signal}`);
      
      const agent = processInfo.agent;
      
      if (code === 0) {
        // 正常退出
        await agent.updateStatus('stopped');
      } else {
        // 异常退出
        const errorMessage = `Process exited with code ${code}`;
        await agent.updateStatus('error', errorMessage);
        
        // 检查是否需要自动重启
        if (processInfo.restartCount < this.maxRestartAttempts) {
          logger.info(`Attempting to restart agent ${agentId} (attempt ${processInfo.restartCount + 1})`);
          setTimeout(() => {
            this.restartAgent(agent).catch(error => {
              logger.error(`Auto-restart failed for agent ${agentId}:`, error);
            });
          }, this.restartDelay);
        }
      }
      
      // 清理进程信息
      this.processes.delete(agentId);
    });

    // 进程错误事件
    childProcess.on('error', async (error) => {
      logger.error(`Agent ${agentId} process error:`, error);
      await processInfo.agent.updateStatus('error', error.message);
    });

    // 标准输出处理
    childProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        logger.info(`Agent ${agentId} stdout: ${message}`);
        this.handleProcessMessage(agentId, message);
      }
    });

    // 标准错误处理
    childProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        logger.error(`Agent ${agentId} stderr: ${message}`);
      }
    });
  }

  /**
   * 处理进程消息
   * @param {number} agentId - 代理ID
   * @param {string} message - 消息内容
   */
  handleProcessMessage(agentId, message) {
    const processInfo = this.processes.get(agentId);
    if (!processInfo) return;

    try {
      // 尝试解析JSON消息
      const data = JSON.parse(message);
      
      if (data.type === 'heartbeat') {
        processInfo.lastHeartbeat = new Date();
        processInfo.status = 'running';
        
        // 更新代理状态
        if (processInfo.agent.status !== 'running') {
          processInfo.agent.updateStatus('running');
        }
        
        // 更新心跳时间
        processInfo.agent.updateHeartbeat();
      } else if (data.type === 'metrics') {
        processInfo.memoryUsage = data.memory;
        processInfo.cpuUsage = data.cpu;
      } else if (data.type === 'ready') {
        processInfo.status = 'running';
        processInfo.agent.updateStatus('running');
      }
    } catch (error) {
      // 非JSON消息，忽略或记录日志
    }
  }

  /**
   * 等待进程准备就绪
   * @param {number} agentId - 代理ID
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<boolean>} 准备就绪返回true
   */
  async waitForProcessReady(agentId, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkReady = () => {
        const processInfo = this.processes.get(agentId);
        
        if (!processInfo) {
          reject(new Error('Process not found'));
          return;
        }
        
        if (processInfo.status === 'running') {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error('Process ready timeout'));
          return;
        }
        
        setTimeout(checkReady, 1000);
      };
      
      checkReady();
    });
  }

  /**
   * 清理进程信息
   * @param {number} agentId - 代理ID
   */
  async cleanupProcess(agentId) {
    const processInfo = this.processes.get(agentId);
    if (!processInfo) return;

    // 清理代理的进程ID和端口
    const agent = processInfo.agent;
    agent.processId = null;
    agent.port = null;
    await agent.save();

    // 移除进程信息
    this.processes.delete(agentId);
  }

  /**
   * 查找可用端口
   * @param {number} startPort - 起始端口
   * @param {number} endPort - 结束端口
   * @returns {Promise<number>} 可用端口
   */
  async findAvailablePort(startPort = 3001, endPort = 3100) {
    const Agent = require('../models/Agent');
    return Agent.findAvailablePort(startPort, endPort);
  }

  /**
   * 停止所有代理进程
   * @returns {Promise<void>}
   */
  async stopAllAgents() {
    const promises = [];
    
    for (const [agentId, processInfo] of this.processes) {
      promises.push(this.stopAgent(processInfo.agent, true));
    }
    
    await Promise.all(promises);
    logger.info('All agent processes stopped');
  }

  /**
   * 健康检查所有进程
   * @returns {Promise<void>}
   */
  async healthCheckAll() {
    for (const [agentId, processInfo] of this.processes) {
      if (!this.isProcessHealthy(agentId)) {
        logger.warn(`Agent ${agentId} is unhealthy, attempting restart`);
        try {
          await this.restartAgent(processInfo.agent);
        } catch (error) {
          logger.error(`Failed to restart unhealthy agent ${agentId}:`, error);
        }
      }
    }
  }
}

// 创建单例实例
const processManager = new ProcessManager();

// 定期健康检查
setInterval(() => {
  processManager.healthCheckAll().catch(error => {
    logger.error('Health check failed:', error);
  });
}, processManager.heartbeatInterval);

// 优雅关闭处理
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, stopping all agent processes...');
  await processManager.stopAllAgents();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, stopping all agent processes...');
  await processManager.stopAllAgents();
  process.exit(0);
});

module.exports = processManager;