const redis = require('redis');
const logger = require('../utils/logger');
require('dotenv').config();

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    connectTimeout: 5000,
    lazyConnect: true
  },
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3
});

client.on('connect', () => {
  logger.info('Redis客户端已连接');
});

client.on('ready', () => {
  logger.info('Redis客户端准备就绪');
});

client.on('error', (err) => {
  logger.error('Redis连接错误:', err.message);
});

client.on('end', () => {
  logger.info('Redis连接已断开');
});

// 连接Redis（可选，因为设置了lazyConnect）
async function connectRedis() {
  try {
    if (!client.isOpen) {
      await client.connect();
      logger.info('Redis连接成功');
    }
  } catch (error) {
    logger.warn('Redis连接失败，将在需要时重试:', error.message);
  }
}

// 优雅关闭Redis连接
async function disconnectRedis() {
  try {
    if (client.isOpen) {
      await client.quit();
      logger.info('Redis连接已关闭');
    }
  } catch (error) {
    logger.error('关闭Redis连接时出错:', error.message);
  }
}

module.exports = {
  client,
  connectRedis,
  disconnectRedis
};