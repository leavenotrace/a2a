const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');

const Agent = sequelize.define('Agent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [1, 100],
      is: /^[a-zA-Z0-9_-]+$/
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('stopped', 'running', 'error', 'starting', 'stopping'),
    allowNull: false,
    defaultValue: 'stopped',
    validate: {
      isIn: [['stopped', 'running', 'error', 'starting', 'stopping']]
    }
  },
  config: {
    type: DataTypes.JSON,
    allowNull: false,
    validate: {
      notEmpty: true,
      isValidConfig(value) {
        if (!value || typeof value !== 'object') {
          throw new Error('Config must be a valid JSON object');
        }
        
        // Validate required config fields
        const requiredFields = ['model'];
        for (const field of requiredFields) {
          if (!value[field]) {
            throw new Error(`Config must include required field: ${field}`);
          }
        }
        
        // Validate port if specified
        if (value.port !== undefined) {
          if (!Number.isInteger(value.port) || value.port < 1024 || value.port > 65535) {
            throw new Error('Port must be an integer between 1024 and 65535');
          }
        }
      }
    }
  },
  templateId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'template_id',
    references: {
      model: 'agent_templates',
      key: 'id'
    }
  },
  processId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'process_id',
    unique: true
  },
  port: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true,
    validate: {
      min: 1024,
      max: 65535
    }
  },
  lastHeartbeat: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_heartbeat'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message'
  },
  restartCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'restart_count',
    validate: {
      min: 0
    }
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'agents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['name']
    },
    {
      fields: ['status']
    },
    {
      fields: ['template_id']
    },
    {
      fields: ['created_by']
    },
    {
      unique: true,
      fields: ['process_id'],
      where: {
        process_id: {
          [Op.ne]: null
        }
      }
    },
    {
      unique: true,
      fields: ['port'],
      where: {
        port: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: ['last_heartbeat']
    },
    {
      fields: ['created_at']
    }
  ]
});

// Instance methods
Agent.prototype.updateStatus = async function(status, errorMessage = null) {
  this.status = status;
  if (errorMessage) {
    this.errorMessage = errorMessage;
  } else if (status !== 'error') {
    this.errorMessage = null;
  }
  
  return this.save({ fields: ['status', 'errorMessage', 'updatedAt'] });
};

Agent.prototype.updateHeartbeat = async function() {
  this.lastHeartbeat = new Date();
  return this.save({ fields: ['lastHeartbeat'] });
};

Agent.prototype.incrementRestartCount = async function() {
  this.restartCount += 1;
  return this.save({ fields: ['restartCount'] });
};

Agent.prototype.resetRestartCount = async function() {
  this.restartCount = 0;
  return this.save({ fields: ['restartCount'] });
};

Agent.prototype.isHealthy = function() {
  if (this.status !== 'running') {
    return false;
  }
  
  if (!this.lastHeartbeat) {
    return false;
  }
  
  // Consider agent unhealthy if no heartbeat in last 2 minutes
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  return this.lastHeartbeat > twoMinutesAgo;
};

Agent.prototype.getUptime = function() {
  if (this.status !== 'running' || !this.lastHeartbeat) {
    return 0;
  }
  
  // Calculate uptime based on last status change to 'running'
  const AgentLog = require('./AgentLog');
  return AgentLog.findOne({
    where: {
      agentId: this.id,
      message: { [sequelize.Op.like]: '%status changed to running%' }
    },
    order: [['timestamp', 'DESC']]
  }).then(log => {
    if (!log) return 0;
    return Math.floor((Date.now() - log.timestamp.getTime()) / 1000);
  });
};

Agent.prototype.canStart = function() {
  return ['stopped', 'error'].includes(this.status);
};

Agent.prototype.canStop = function() {
  return ['running', 'starting'].includes(this.status);
};

Agent.prototype.canRestart = function() {
  return ['running', 'error'].includes(this.status);
};

Agent.prototype.getLatestMetrics = async function() {
  const AgentMetrics = require('./AgentMetrics');
  return AgentMetrics.findOne({
    where: { agentId: this.id },
    order: [['timestamp', 'DESC']]
  });
};

Agent.prototype.getRecentLogs = async function(limit = 100, level = null) {
  const AgentLog = require('./AgentLog');
  const where = { agentId: this.id };
  if (level) {
    where.level = level;
  }
  
  return AgentLog.findAll({
    where,
    order: [['timestamp', 'DESC']],
    limit
  });
};

// Class methods
Agent.findByStatus = function(status, options = {}) {
  return Agent.findAll({
    where: {
      status,
      ...options.where
    },
    ...options
  });
};

Agent.findRunning = function(options = {}) {
  return Agent.findByStatus('running', options);
};

Agent.findStopped = function(options = {}) {
  return Agent.findByStatus('stopped', options);
};

Agent.findWithErrors = function(options = {}) {
  return Agent.findByStatus('error', options);
};

Agent.findByName = function(name) {
  return Agent.findOne({ where: { name } });
};

Agent.findByProcessId = function(processId) {
  return Agent.findOne({ where: { processId } });
};

Agent.findByPort = function(port) {
  return Agent.findOne({ where: { port } });
};

Agent.getStatusCounts = function() {
  return Agent.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['status'],
    raw: true
  });
};

Agent.findUnhealthy = function() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  
  return Agent.findAll({
    where: {
      status: 'running',
      [sequelize.Op.or]: [
        { lastHeartbeat: null },
        { lastHeartbeat: { [sequelize.Op.lt]: twoMinutesAgo } }
      ]
    }
  });
};

Agent.findAvailablePort = async function(startPort = 3001, endPort = 3100) {
  const usedPorts = await Agent.findAll({
    attributes: ['port'],
    where: {
      port: {
        [sequelize.Op.between]: [startPort, endPort]
      }
    },
    raw: true
  }).then(agents => agents.map(a => a.port));
  
  for (let port = startPort; port <= endPort; port++) {
    if (!usedPorts.includes(port)) {
      return port;
    }
  }
  
  throw new Error(`No available ports in range ${startPort}-${endPort}`);
};

module.exports = Agent;