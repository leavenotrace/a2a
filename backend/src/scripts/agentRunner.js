#!/usr/bin/env node

/**
 * Agent Runner Script
 * 这个脚本用于运行单个代理实例
 */

const http = require('http');
const express = require('express');

class AgentRunner {
  constructor() {
    this.agentId = process.env.AGENT_ID;
    this.port = parseInt(process.env.AGENT_PORT) || 3001;
    this.config = JSON.parse(process.env.AGENT_CONFIG || '{}');
    this.name = process.env.AGENT_NAME || `agent-${this.agentId}`;
    
    this.app = express();
    this.server = null;
    this.heartbeatInterval = null;
    this.metricsInterval = null;
    
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    
    this.setupApp();
    this.setupSignalHandlers();
  }

  setupApp() {
    this.app.use(express.json());
    
    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        agentId: this.agentId,
        name: this.name,
        uptime: Date.now() - this.startTime,
        requestCount: this.requestCount,
        errorCount: this.errorCount
      });
    });

    // 代理配置端点
    this.app.get('/config', (req, res) => {
      res.json({
        agentId: this.agentId,
        name: this.name,
        config: this.config
      });
    });

    // 模拟代理处理端点
    this.app.post('/process', (req, res) => {
      this.requestCount++;
      
      try {
        // 模拟代理处理逻辑
        const { input, options = {} } = req.body;
        
        if (!input) {
          this.errorCount++;
          return res.status(400).json({
            error: 'Input is required'
          });
        }

        // 模拟处理延迟
        const processingTime = Math.random() * 1000 + 500; // 500-1500ms
        
        setTimeout(() => {
          const response = {
            agentId: this.agentId,
            input,
            output: `Processed by ${this.name}: ${input}`,
            processingTime,
            timestamp: new Date().toISOString(),
            config: this.config
          };
          
          res.json(response);
        }, processingTime);

      } catch (error) {
        this.errorCount++;
        res.status(500).json({
          error: 'Processing failed',
          message: error.message
        });
      }
    });

    // 停止代理端点
    this.app.post('/shutdown', (req, res) => {
      res.json({ message: 'Shutting down...' });
      setTimeout(() => {
        this.shutdown();
      }, 1000);
    });

    // 错误处理
    this.app.use((err, req, res, next) => {
      this.errorCount++;
      console.error('Agent error:', err);
      res.status(500).json({
        error: 'Internal agent error',
        message: err.message
      });
    });
  }

  setupSignalHandlers() {
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      this.shutdown();
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.errorCount++;
      this.shutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      this.errorCount++;
    });
  }

  async start() {
    try {
      // 启动HTTP服务器
      this.server = this.app.listen(this.port, () => {
        console.log(`Agent ${this.agentId} (${this.name}) listening on port ${this.port}`);
        
        // 发送就绪信号
        this.sendMessage({
          type: 'ready',
          agentId: this.agentId,
          port: this.port,
          timestamp: new Date().toISOString()
        });
      });

      // 启动心跳
      this.startHeartbeat();
      
      // 启动指标收集
      this.startMetricsCollection();

    } catch (error) {
      console.error('Failed to start agent:', error);
      process.exit(1);
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendMessage({
        type: 'heartbeat',
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        status: 'running',
        uptime: Date.now() - this.startTime,
        requestCount: this.requestCount,
        errorCount: this.errorCount
      });
    }, 30000); // 每30秒发送心跳
  }

  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.sendMessage({
        type: 'metrics',
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        requestCount: this.requestCount,
        errorCount: this.errorCount
      });
    }, 60000); // 每60秒收集指标
  }

  sendMessage(message) {
    // 通过stdout发送消息给父进程
    console.log(JSON.stringify(message));
  }

  shutdown(exitCode = 0) {
    console.log('Shutting down agent...');
    
    // 清理定时器
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // 关闭服务器
    if (this.server) {
      this.server.close(() => {
        console.log('Agent server closed');
        process.exit(exitCode);
      });
      
      // 强制关闭超时
      setTimeout(() => {
        console.log('Force closing agent server');
        process.exit(exitCode);
      }, 5000);
    } else {
      process.exit(exitCode);
    }
  }
}

// 启动代理
if (require.main === module) {
  const agent = new AgentRunner();
  agent.start().catch(error => {
    console.error('Agent startup failed:', error);
    process.exit(1);
  });
}

module.exports = AgentRunner;