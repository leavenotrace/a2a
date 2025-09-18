const { sequelize } = require('../models');

// Setup test database
beforeAll(async () => {
  // Use test database configuration
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = 'agent_management_test';
  
  try {
    // Create test database if it doesn't exist
    await sequelize.query('CREATE DATABASE IF NOT EXISTS agent_management_test');
    
    // Connect to test database
    await sequelize.authenticate();
    console.log('✅ Test database connection established');
    
    // Sync all models (create tables)
    await sequelize.sync({ force: true });
    console.log('✅ Test database tables created');
  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    // Drop all tables
    await sequelize.drop();
    console.log('✅ Test database tables dropped');
    
    // Close connection
    await sequelize.close();
    console.log('✅ Test database connection closed');
  } catch (error) {
    console.error('❌ Test database cleanup failed:', error);
  }
});

// Set test timeout
jest.setTimeout(30000);