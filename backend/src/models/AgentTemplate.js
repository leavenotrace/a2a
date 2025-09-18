const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AgentTemplate = sequelize.define('AgentTemplate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
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
        
        // Validate numeric fields
        if (value.temperature !== undefined) {
          if (typeof value.temperature !== 'number' || value.temperature < 0 || value.temperature > 2) {
            throw new Error('Temperature must be a number between 0 and 2');
          }
        }
        
        if (value.max_tokens !== undefined) {
          if (!Number.isInteger(value.max_tokens) || value.max_tokens < 1 || value.max_tokens > 32000) {
            throw new Error('Max tokens must be an integer between 1 and 32000');
          }
        }
        
        if (value.timeout !== undefined) {
          if (!Number.isInteger(value.timeout) || value.timeout < 1 || value.timeout > 300) {
            throw new Error('Timeout must be an integer between 1 and 300 seconds');
          }
        }
      }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '1.0.0',
    validate: {
      is: /^\d+\.\d+\.\d+$/
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
  tableName: 'agent_templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['created_at']
    },
    {
      unique: true,
      fields: ['name', 'is_active'],
      name: 'uk_active_template_name'
    }
  ]
});

// Instance methods
AgentTemplate.prototype.clone = function(newName, userId) {
  const clonedConfig = JSON.parse(JSON.stringify(this.config));
  
  return AgentTemplate.create({
    name: newName,
    description: `Cloned from ${this.name}`,
    config: clonedConfig,
    version: '1.0.0',
    createdBy: userId
  });
};

AgentTemplate.prototype.incrementVersion = function() {
  const [major, minor, patch] = this.version.split('.').map(Number);
  this.version = `${major}.${minor}.${patch + 1}`;
  return this.save();
};

AgentTemplate.prototype.getUsageCount = async function() {
  const Agent = require('./Agent');
  return Agent.count({
    where: {
      templateId: this.id
    }
  });
};

AgentTemplate.prototype.canDelete = async function() {
  const usageCount = await this.getUsageCount();
  return usageCount === 0;
};

// Class methods
AgentTemplate.findActive = function(options = {}) {
  return AgentTemplate.findAll({
    where: {
      isActive: true,
      ...options.where
    },
    ...options
  });
};

AgentTemplate.findByName = function(name, includeInactive = false) {
  const where = { name };
  if (!includeInactive) {
    where.isActive = true;
  }
  
  return AgentTemplate.findOne({ where });
};

AgentTemplate.getPopularTemplates = function(limit = 10) {
  const Agent = require('./Agent');
  
  return AgentTemplate.findAll({
    attributes: [
      'id',
      'name',
      'description',
      'version',
      [sequelize.fn('COUNT', sequelize.col('Agents.id')), 'usage_count']
    ],
    include: [{
      model: Agent,
      attributes: [],
      required: false
    }],
    where: {
      isActive: true
    },
    group: ['AgentTemplate.id'],
    order: [[sequelize.literal('usage_count'), 'DESC']],
    limit,
    subQuery: false
  });
};

AgentTemplate.validateConfig = function(config) {
  try {
    const template = AgentTemplate.build({ config });
    return template.validate();
  } catch (error) {
    throw error;
  }
};

module.exports = AgentTemplate;