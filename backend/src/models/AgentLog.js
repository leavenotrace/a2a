const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AgentLog = sequelize.define('AgentLog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  agentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'agent_id',
    references: {
      model: 'agents',
      key: 'id'
    }
  },
  level: {
    type: DataTypes.ENUM('debug', 'info', 'warn', 'error', 'fatal'),
    allowNull: false,
    validate: {
      isIn: [['debug', 'info', 'warn', 'error', 'fatal']]
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 65535]
    }
  },
  context: {
    type: DataTypes.JSON,
    allowNull: true,
    validate: {
      isValidContext(value) {
        if (value !== null && typeof value !== 'object') {
          throw new Error('Context must be a valid JSON object or null');
        }
      }
    }
  },
  source: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: [0, 100]
    }
  },
  requestId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'request_id',
    validate: {
      len: [0, 100]
    }
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'agent_logs',
  timestamps: false, // We use custom timestamp field
  indexes: [
    {
      fields: ['agent_id', 'timestamp']
    },
    {
      fields: ['level', 'timestamp']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['source']
    },
    {
      fields: ['request_id']
    },
    {
      fields: ['agent_id', 'level', 'timestamp']
    },
    {
      fields: ['level', 'agent_id', 'timestamp']
    }
  ]
});

// Instance methods
AgentLog.prototype.isError = function() {
  return ['error', 'fatal'].includes(this.level);
};

AgentLog.prototype.isWarning = function() {
  return this.level === 'warn';
};

AgentLog.prototype.getFormattedMessage = function() {
  const timestamp = this.timestamp.toISOString();
  const level = this.level.toUpperCase().padEnd(5);
  const source = this.source ? `[${this.source}]` : '';
  const requestId = this.requestId ? `[${this.requestId}]` : '';
  
  return `${timestamp} ${level} ${source}${requestId} ${this.message}`;
};

AgentLog.prototype.toLogFormat = function() {
  return {
    timestamp: this.timestamp,
    level: this.level,
    message: this.message,
    context: this.context,
    source: this.source,
    requestId: this.requestId,
    agentId: this.agentId
  };
};

// Class methods
AgentLog.createLog = function(agentId, level, message, options = {}) {
  return AgentLog.create({
    agentId,
    level,
    message,
    context: options.context || null,
    source: options.source || null,
    requestId: options.requestId || null,
    timestamp: options.timestamp || new Date()
  });
};

AgentLog.findByAgent = function(agentId, options = {}) {
  return AgentLog.findAll({
    where: {
      agentId,
      ...options.where
    },
    order: [['timestamp', 'DESC']],
    ...options
  });
};

AgentLog.findByLevel = function(level, options = {}) {
  return AgentLog.findAll({
    where: {
      level,
      ...options.where
    },
    order: [['timestamp', 'DESC']],
    ...options
  });
};

AgentLog.findByTimeRange = function(startTime, endTime, options = {}) {
  return AgentLog.findAll({
    where: {
      timestamp: {
        [sequelize.Op.between]: [startTime, endTime]
      },
      ...options.where
    },
    order: [['timestamp', 'DESC']],
    ...options
  });
};

AgentLog.findErrors = function(options = {}) {
  return AgentLog.findAll({
    where: {
      level: {
        [sequelize.Op.in]: ['error', 'fatal']
      },
      ...options.where
    },
    order: [['timestamp', 'DESC']],
    ...options
  });
};

AgentLog.searchLogs = function(searchTerm, options = {}) {
  return AgentLog.findAll({
    where: {
      message: {
        [sequelize.Op.like]: `%${searchTerm}%`
      },
      ...options.where
    },
    order: [['timestamp', 'DESC']],
    ...options
  });
};

AgentLog.getLogCounts = function(agentId = null, timeRange = null) {
  const where = {};
  
  if (agentId) {
    where.agentId = agentId;
  }
  
  if (timeRange) {
    where.timestamp = {
      [sequelize.Op.between]: [timeRange.start, timeRange.end]
    };
  }
  
  return AgentLog.findAll({
    attributes: [
      'level',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where,
    group: ['level'],
    raw: true
  });
};

AgentLog.getRecentActivity = function(agentId, hours = 24) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return AgentLog.findAll({
    attributes: [
      [sequelize.fn('DATE_FORMAT', sequelize.col('timestamp'), '%Y-%m-%d %H:00:00'), 'hour'],
      'level',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      agentId,
      timestamp: {
        [sequelize.Op.gte]: startTime
      }
    },
    group: ['hour', 'level'],
    order: [['hour', 'ASC']],
    raw: true
  });
};

AgentLog.cleanupOldLogs = function(daysToKeep = 30) {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  return AgentLog.destroy({
    where: {
      timestamp: {
        [sequelize.Op.lt]: cutoffDate
      }
    }
  });
};

AgentLog.exportLogs = function(agentId, format = 'json', options = {}) {
  const query = {
    where: { agentId },
    order: [['timestamp', 'ASC']],
    ...options
  };
  
  return AgentLog.findAll(query).then(logs => {
    switch (format.toLowerCase()) {
      case 'csv':
        return AgentLog.formatAsCSV(logs);
      case 'txt':
        return AgentLog.formatAsText(logs);
      case 'json':
      default:
        return JSON.stringify(logs.map(log => log.toLogFormat()), null, 2);
    }
  });
};

AgentLog.formatAsCSV = function(logs) {
  const headers = ['timestamp', 'level', 'source', 'requestId', 'message'];
  const csvRows = [headers.join(',')];
  
  logs.forEach(log => {
    const row = [
      log.timestamp.toISOString(),
      log.level,
      log.source || '',
      log.requestId || '',
      `"${log.message.replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
};

AgentLog.formatAsText = function(logs) {
  return logs.map(log => log.getFormattedMessage()).join('\n');
};

module.exports = AgentLog;