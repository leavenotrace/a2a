const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const AgentTemplate = require('./AgentTemplate');
const Agent = require('./Agent');
const AgentLog = require('./AgentLog');
const AgentMetrics = require('./AgentMetrics');

// Define associations
// User associations
User.hasMany(AgentTemplate, {
  foreignKey: 'createdBy',
  as: 'createdTemplates',
  onDelete: 'SET NULL'
});

User.hasMany(Agent, {
  foreignKey: 'createdBy',
  as: 'createdAgents',
  onDelete: 'SET NULL'
});

// AgentTemplate associations
AgentTemplate.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator',
  onDelete: 'SET NULL'
});

AgentTemplate.hasMany(Agent, {
  foreignKey: 'templateId',
  as: 'agents',
  onDelete: 'SET NULL'
});

// Agent associations
Agent.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator',
  onDelete: 'SET NULL'
});

Agent.belongsTo(AgentTemplate, {
  foreignKey: 'templateId',
  as: 'template',
  onDelete: 'SET NULL'
});

Agent.hasMany(AgentLog, {
  foreignKey: 'agentId',
  as: 'logs',
  onDelete: 'CASCADE'
});

Agent.hasMany(AgentMetrics, {
  foreignKey: 'agentId',
  as: 'metrics',
  onDelete: 'CASCADE'
});

// AgentLog associations
AgentLog.belongsTo(Agent, {
  foreignKey: 'agentId',
  as: 'agent',
  onDelete: 'CASCADE'
});

// AgentMetrics associations
AgentMetrics.belongsTo(Agent, {
  foreignKey: 'agentId',
  as: 'agent',
  onDelete: 'CASCADE'
});

// Database connection and sync utilities
const db = {
  sequelize,
  User,
  AgentTemplate,
  Agent,
  AgentLog,
  AgentMetrics,
  
  // Utility methods
  async connect() {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection established successfully');
      return true;
    } catch (error) {
      console.error('❌ Unable to connect to database:', error.message);
      return false;
    }
  },
  
  async disconnect() {
    try {
      await sequelize.close();
      console.log('✅ Database connection closed');
      return true;
    } catch (error) {
      console.error('❌ Error closing database connection:', error.message);
      return false;
    }
  },
  
  async sync(options = {}) {
    try {
      await sequelize.sync(options);
      console.log('✅ Database synchronized successfully');
      return true;
    } catch (error) {
      console.error('❌ Database synchronization failed:', error.message);
      return false;
    }
  },
  
  async createTables(force = false) {
    try {
      await sequelize.sync({ force });
      console.log('✅ Database tables created successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to create database tables:', error.message);
      return false;
    }
  },
  
  async testConnection() {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection test passed');
      
      // Test a simple query
      const result = await sequelize.query('SELECT 1 as test');
      console.log('✅ Database query test passed');
      
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      return false;
    }
  },
  
  async seedData() {
    try {
      // Check if admin user already exists
      const adminUser = await User.findOne({ where: { username: 'admin' } });
      
      if (!adminUser) {
        // Create admin user
        await User.create({
          username: 'admin',
          email: 'admin@example.com',
          passwordHash: 'admin123', // Will be hashed by the model hook
          role: 'admin'
        });
        console.log('✅ Admin user created');
      }
      
      // Create sample templates if they don't exist
      const templateCount = await AgentTemplate.count();
      if (templateCount === 0) {
        await AgentTemplate.bulkCreate([
          {
            name: '基础聊天代理',
            description: '基础的聊天代理模板，适用于一般对话场景',
            config: {
              model: 'gpt-3.5-turbo',
              temperature: 0.7,
              max_tokens: 1000,
              timeout: 30,
              retry_attempts: 3,
              system_prompt: '你是一个有用的AI助手。'
            },
            version: '1.0.0',
            createdBy: 1
          },
          {
            name: '数据分析代理',
            description: '专门用于数据分析的代理模板，集成Python和数据分析工具',
            config: {
              model: 'gpt-4',
              temperature: 0.3,
              max_tokens: 2000,
              timeout: 60,
              retry_attempts: 2,
              tools: ['python', 'pandas', 'numpy', 'matplotlib'],
              system_prompt: '你是一个专业的数据分析师，擅长使用Python进行数据分析。'
            },
            version: '1.0.0',
            createdBy: 1
          }
        ]);
        console.log('✅ Sample templates created');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to seed data:', error.message);
      return false;
    }
  },
  
  async getHealthStatus() {
    try {
      const startTime = Date.now();
      await sequelize.authenticate();
      const connectionTime = Date.now() - startTime;
      
      const stats = await Promise.all([
        User.count(),
        AgentTemplate.count(),
        Agent.count(),
        AgentLog.count(),
        AgentMetrics.count()
      ]);
      
      return {
        status: 'healthy',
        connectionTime,
        tables: {
          users: stats[0],
          agentTemplates: stats[1],
          agents: stats[2],
          agentLogs: stats[3],
          agentMetrics: stats[4]
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }
};

module.exports = db;