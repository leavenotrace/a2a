const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [3, 50],
      isAlphanumeric: true
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      isEmail: true,
      len: [5, 100]
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash',
    validate: {
      notEmpty: true,
      len: [6, 255]
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'operator', 'viewer'),
    allowNull: false,
    defaultValue: 'viewer',
    validate: {
      isIn: [['admin', 'operator', 'viewer']]
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login'
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['username']
    },
    {
      unique: true,
      fields: ['email']
    },
    {
      fields: ['role']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.passwordHash && !user.passwordHash.startsWith('$2b$')) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('passwordHash') && !user.passwordHash.startsWith('$2b$')) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
      }
    }
  }
});

// Instance methods
User.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.passwordHash;
  return values;
};

User.prototype.hasPermission = function(requiredRole) {
  const roleHierarchy = {
    viewer: 1,
    operator: 2,
    admin: 3
  };
  
  return roleHierarchy[this.role] >= roleHierarchy[requiredRole];
};

User.prototype.updateLastLogin = async function() {
  this.lastLogin = new Date();
  return this.save({ fields: ['lastLogin'] });
};

// Class methods
User.findByCredentials = async function(username, password) {
  const user = await User.findOne({
    where: {
      username,
      isActive: true
    }
  });
  
  if (!user || !(await user.validatePassword(password))) {
    return null;
  }
  
  return user;
};

User.findActiveUsers = function(options = {}) {
  return User.findAll({
    where: {
      isActive: true,
      ...options.where
    },
    ...options
  });
};

User.countByRole = function() {
  return User.findAll({
    attributes: [
      'role',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    where: {
      isActive: true
    },
    group: ['role'],
    raw: true
  });
};

module.exports = User;