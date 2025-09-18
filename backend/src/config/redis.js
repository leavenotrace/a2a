const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis服务器拒绝连接');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('重试时间已用尽');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

client.on('connect', () => {
  console.log('Redis客户端已连接');
});

client.on('error', (err) => {
  console.error('Redis连接错误:', err);
});

module.exports = client;