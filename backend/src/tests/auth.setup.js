// Mock setup for authentication tests
// This avoids database connection issues during auth testing

// Mock the models
jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    bulkCreate: jest.fn()
  },
  AgentTemplate: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    bulkCreate: jest.fn()
  },
  Agent: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    bulkCreate: jest.fn()
  },
  AgentLog: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    bulkCreate: jest.fn()
  },
  AgentMetrics: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    bulkCreate: jest.fn()
  },
  sequelize: {
    authenticate: jest.fn(),
    sync: jest.fn(),
    close: jest.fn(),
    query: jest.fn()
  }
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';