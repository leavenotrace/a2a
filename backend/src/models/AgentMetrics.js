const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AgentMetrics = sequelize.define('AgentMetrics', {
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
  cpuUsage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'cpu_usage',
    validate: {
      min: 0,
      max: 100
    }
  },
  memoryUsage: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'memory_usage',
    validate: {
      min: 0
    }
  },
  memoryLimit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'memory_limit',
    validate: {
      min: 0
    }
  },
  requestCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'request_count',
    validate: {
      min: 0
    }
  },
  errorCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'error_count',
    validate: {
      min: 0
    }
  },
  successCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'success_count',
    validate: {
      min: 0
    }
  },
  responseTime: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
    field: 'response_time',
    validate: {
      min: 0
    }
  },
  uptimeSeconds: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    field: 'uptime_seconds',
    validate: {
      min: 0
    }
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'agent_metrics',
  timestamps: false, // We use custom timestamp field
  indexes: [
    {
      fields: ['agent_id', 'timestamp']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['agent_id', 'cpu_usage', 'timestamp']
    },
    {
      fields: ['agent_id', 'memory_usage', 'timestamp']
    },
    {
      fields: ['agent_id', 'response_time', 'timestamp']
    }
  ]
});

// Instance methods
AgentMetrics.prototype.getMemoryUsagePercentage = function() {
  if (!this.memoryUsage || !this.memoryLimit) {
    return null;
  }
  return Math.round((this.memoryUsage / this.memoryLimit) * 100 * 100) / 100;
};

AgentMetrics.prototype.getErrorRate = function() {
  const totalRequests = this.requestCount + this.errorCount;
  if (totalRequests === 0) {
    return 0;
  }
  return Math.round((this.errorCount / totalRequests) * 100 * 100) / 100;
};

AgentMetrics.prototype.getSuccessRate = function() {
  const totalRequests = this.successCount + this.errorCount;
  if (totalRequests === 0) {
    return 0;
  }
  return Math.round((this.successCount / totalRequests) * 100 * 100) / 100;
};

AgentMetrics.prototype.getUptimeFormatted = function() {
  const seconds = this.uptimeSeconds;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${remainingSeconds}s`;
  }
};

AgentMetrics.prototype.isHealthy = function() {
  // Define health thresholds
  const CPU_THRESHOLD = 90;
  const MEMORY_THRESHOLD = 90;
  const ERROR_RATE_THRESHOLD = 10;
  const RESPONSE_TIME_THRESHOLD = 5000; // 5 seconds
  
  if (this.cpuUsage && this.cpuUsage > CPU_THRESHOLD) {
    return false;
  }
  
  const memoryPercentage = this.getMemoryUsagePercentage();
  if (memoryPercentage && memoryPercentage > MEMORY_THRESHOLD) {
    return false;
  }
  
  if (this.getErrorRate() > ERROR_RATE_THRESHOLD) {
    return false;
  }
  
  if (this.responseTime && this.responseTime > RESPONSE_TIME_THRESHOLD) {
    return false;
  }
  
  return true;
};

AgentMetrics.prototype.toSummary = function() {
  return {
    id: this.id,
    agentId: this.agentId,
    cpuUsage: this.cpuUsage,
    memoryUsage: this.memoryUsage,
    memoryUsagePercentage: this.getMemoryUsagePercentage(),
    requestCount: this.requestCount,
    errorCount: this.errorCount,
    successCount: this.successCount,
    errorRate: this.getErrorRate(),
    successRate: this.getSuccessRate(),
    responseTime: this.responseTime,
    uptime: this.getUptimeFormatted(),
    uptimeSeconds: this.uptimeSeconds,
    isHealthy: this.isHealthy(),
    timestamp: this.timestamp
  };
};

// Class methods
AgentMetrics.recordMetrics = function(agentId, metrics) {
  return AgentMetrics.create({
    agentId,
    cpuUsage: metrics.cpuUsage,
    memoryUsage: metrics.memoryUsage,
    memoryLimit: metrics.memoryLimit,
    requestCount: metrics.requestCount || 0,
    errorCount: metrics.errorCount || 0,
    successCount: metrics.successCount || 0,
    responseTime: metrics.responseTime,
    uptimeSeconds: metrics.uptimeSeconds || 0,
    timestamp: metrics.timestamp || new Date()
  });
};

AgentMetrics.findByAgent = function(agentId, options = {}) {
  return AgentMetrics.findAll({
    where: {
      agentId,
      ...options.where
    },
    order: [['timestamp', 'DESC']],
    ...options
  });
};

AgentMetrics.findByTimeRange = function(agentId, startTime, endTime, options = {}) {
  return AgentMetrics.findAll({
    where: {
      agentId,
      timestamp: {
        [sequelize.Op.between]: [startTime, endTime]
      },
      ...options.where
    },
    order: [['timestamp', 'ASC']],
    ...options
  });
};

AgentMetrics.getLatestMetrics = function(agentId) {
  return AgentMetrics.findOne({
    where: { agentId },
    order: [['timestamp', 'DESC']]
  });
};

AgentMetrics.getAverageMetrics = function(agentId, hours = 24) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return AgentMetrics.findAll({
    attributes: [
      [sequelize.fn('AVG', sequelize.col('cpu_usage')), 'avgCpuUsage'],
      [sequelize.fn('AVG', sequelize.col('memory_usage')), 'avgMemoryUsage'],
      [sequelize.fn('AVG', sequelize.col('response_time')), 'avgResponseTime'],
      [sequelize.fn('SUM', sequelize.col('request_count')), 'totalRequests'],
      [sequelize.fn('SUM', sequelize.col('error_count')), 'totalErrors'],
      [sequelize.fn('SUM', sequelize.col('success_count')), 'totalSuccess'],
      [sequelize.fn('MAX', sequelize.col('uptime_seconds')), 'maxUptime']
    ],
    where: {
      agentId,
      timestamp: {
        [sequelize.Op.gte]: startTime
      }
    },
    raw: true
  }).then(results => {
    const result = results[0];
    if (!result) return null;
    
    const totalRequests = (result.totalRequests || 0) + (result.totalErrors || 0);
    const errorRate = totalRequests > 0 ? ((result.totalErrors || 0) / totalRequests) * 100 : 0;
    const successRate = totalRequests > 0 ? ((result.totalSuccess || 0) / totalRequests) * 100 : 0;
    
    return {
      avgCpuUsage: result.avgCpuUsage ? parseFloat(result.avgCpuUsage).toFixed(2) : null,
      avgMemoryUsage: result.avgMemoryUsage ? parseFloat(result.avgMemoryUsage).toFixed(2) : null,
      avgResponseTime: result.avgResponseTime ? parseFloat(result.avgResponseTime).toFixed(2) : null,
      totalRequests: result.totalRequests || 0,
      totalErrors: result.totalErrors || 0,
      totalSuccess: result.totalSuccess || 0,
      errorRate: parseFloat(errorRate).toFixed(2),
      successRate: parseFloat(successRate).toFixed(2),
      maxUptime: result.maxUptime || 0
    };
  });
};

AgentMetrics.getTimeSeriesData = function(agentId, metric, hours = 24, interval = 'hour') {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  let dateFormat;
  switch (interval) {
    case 'minute':
      dateFormat = '%Y-%m-%d %H:%i:00';
      break;
    case 'hour':
      dateFormat = '%Y-%m-%d %H:00:00';
      break;
    case 'day':
      dateFormat = '%Y-%m-%d 00:00:00';
      break;
    default:
      dateFormat = '%Y-%m-%d %H:00:00';
  }
  
  return AgentMetrics.findAll({
    attributes: [
      [sequelize.fn('DATE_FORMAT', sequelize.col('timestamp'), dateFormat), 'time'],
      [sequelize.fn('AVG', sequelize.col(metric)), 'value']
    ],
    where: {
      agentId,
      timestamp: {
        [sequelize.Op.gte]: startTime
      }
    },
    group: ['time'],
    order: [['time', 'ASC']],
    raw: true
  });
};

AgentMetrics.getSystemOverview = function() {
  return AgentMetrics.findAll({
    attributes: [
      'agent_id',
      [sequelize.fn('AVG', sequelize.col('cpu_usage')), 'avgCpuUsage'],
      [sequelize.fn('AVG', sequelize.col('memory_usage')), 'avgMemoryUsage'],
      [sequelize.fn('SUM', sequelize.col('request_count')), 'totalRequests'],
      [sequelize.fn('SUM', sequelize.col('error_count')), 'totalErrors'],
      [sequelize.fn('MAX', sequelize.col('timestamp')), 'lastUpdate']
    ],
    where: {
      timestamp: {
        [sequelize.Op.gte]: new Date(Date.now() - 60 * 60 * 1000) // Last hour
      }
    },
    group: ['agent_id'],
    raw: true
  });
};

AgentMetrics.cleanupOldMetrics = function(daysToKeep = 90) {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  return AgentMetrics.destroy({
    where: {
      timestamp: {
        [sequelize.Op.lt]: cutoffDate
      }
    }
  });
};

AgentMetrics.findUnhealthyAgents = function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  return AgentMetrics.findAll({
    where: {
      timestamp: {
        [sequelize.Op.gte]: oneHourAgo
      },
      [sequelize.Op.or]: [
        { cpuUsage: { [sequelize.Op.gt]: 90 } },
        { responseTime: { [sequelize.Op.gt]: 5000 } }
      ]
    },
    include: [{
      model: require('./Agent'),
      attributes: ['id', 'name', 'status']
    }],
    order: [['timestamp', 'DESC']]
  });
};

module.exports = AgentMetrics;