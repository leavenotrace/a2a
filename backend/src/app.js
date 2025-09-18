const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const sequelize = require('./config/database');
const redisClient = require('./config/redis');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// 中间件配置
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true
}));

// 限流配置
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: '请求过于频繁，请稍后再试'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API路由
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);

// 默认API路由
app.use('/api', (req, res) => {
  res.json({ message: 'Agent Management System API' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('未处理的错误:', err);

  // 处理自定义错误
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      field: err.field || undefined
    });
  }

  // 处理Sequelize验证错误
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.errors.map(e => ({
        field: e.path,
        message: e.message
      }))
    });
  }

  // 处理Sequelize唯一约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'CONFLICT',
      message: 'Resource already exists',
      field: err.errors[0]?.path
    });
  }

  // 默认错误处理
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

const PORT = process.env.PORT || 3000;

// 启动服务器
async function startServer() {
  try {
    // 测试数据库连接
    await sequelize.authenticate();
    logger.info('数据库连接成功');

    // 启动服务器
    server.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
      logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
    });

    // WebSocket连接处理
    io.on('connection', (socket) => {
      logger.info(`客户端已连接: ${socket.id}`);

      socket.on('disconnect', () => {
        logger.info(`客户端已断开: ${socket.id}`);
      });
    });

  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    logger.info('HTTP服务器已关闭');
    sequelize.close();
    redisClient.quit();
    process.exit(0);
  });
});

startServer();

module.exports = { app, server, io };