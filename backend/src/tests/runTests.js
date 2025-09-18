#!/usr/bin/env node

/**
 * Test runner for model validation
 * This script runs basic tests to verify models are working correctly
 */

const db = require('../models');

async function runBasicTests() {
  console.log('🧪 Starting basic model tests...\n');
  
  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const connected = await db.connect();
    if (!connected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connection successful\n');
    
    // Test database sync
    console.log('2. Testing database synchronization...');
    await db.sync({ force: true });
    console.log('✅ Database sync successful\n');
    
    // Test User model
    console.log('3. Testing User model...');
    const user = await db.User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123',
      role: 'admin'
    });
    console.log(`✅ User created: ${user.username} (${user.email})`);
    
    const isValidPassword = await user.validatePassword('password123');
    console.log(`✅ Password validation: ${isValidPassword}`);
    
    const hasPermission = user.hasPermission('viewer');
    console.log(`✅ Permission check: ${hasPermission}\n`);
    
    // Test AgentTemplate model
    console.log('4. Testing AgentTemplate model...');
    const template = await db.AgentTemplate.create({
      name: 'Test Template',
      description: 'A test template',
      config: {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 1000,
        timeout: 30
      },
      createdBy: user.id
    });
    console.log(`✅ Template created: ${template.name} (v${template.version})`);
    
    const clonedTemplate = await template.clone('Cloned Template', user.id);
    console.log(`✅ Template cloned: ${clonedTemplate.name}\n`);
    
    // Test Agent model
    console.log('5. Testing Agent model...');
    const agent = await db.Agent.create({
      name: 'test-agent',
      description: 'A test agent',
      config: {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 1000,
        port: 3001
      },
      templateId: template.id,
      createdBy: user.id
    });
    console.log(`✅ Agent created: ${agent.name} (${agent.status})`);
    
    await agent.updateStatus('running');
    await agent.updateHeartbeat();
    console.log(`✅ Agent status updated: ${agent.status}`);
    console.log(`✅ Agent is healthy: ${agent.isHealthy()}\n`);
    
    // Test AgentLog model
    console.log('6. Testing AgentLog model...');
    const log = await db.AgentLog.createLog(
      agent.id,
      'info',
      'Agent started successfully',
      {
        source: 'test',
        context: { test: true }
      }
    );
    console.log(`✅ Log created: ${log.level} - ${log.message}`);
    
    const logs = await db.AgentLog.findByAgent(agent.id, { limit: 5 });
    console.log(`✅ Found ${logs.length} logs for agent\n`);
    
    // Test AgentMetrics model
    console.log('7. Testing AgentMetrics model...');
    const metrics = await db.AgentMetrics.recordMetrics(agent.id, {
      cpuUsage: 45.5,
      memoryUsage: 512.0,
      memoryLimit: 1024.0,
      requestCount: 100,
      errorCount: 2,
      successCount: 98,
      responseTime: 250.5,
      uptimeSeconds: 3600
    });
    console.log(`✅ Metrics recorded: CPU ${metrics.cpuUsage}%, Memory ${metrics.memoryUsage}MB`);
    console.log(`✅ Error rate: ${metrics.getErrorRate()}%`);
    console.log(`✅ Memory usage: ${metrics.getMemoryUsagePercentage()}%`);
    console.log(`✅ Is healthy: ${metrics.isHealthy()}\n`);
    
    // Test associations
    console.log('8. Testing model associations...');
    const agentWithTemplate = await db.Agent.findByPk(agent.id, {
      include: [
        { model: db.AgentTemplate, as: 'template' },
        { model: db.User, as: 'creator' }
      ]
    });
    console.log(`✅ Agent with template: ${agentWithTemplate.template.name}`);
    console.log(`✅ Agent creator: ${agentWithTemplate.creator.username}\n`);
    
    // Test health status
    console.log('9. Testing database health status...');
    const healthStatus = await db.getHealthStatus();
    console.log(`✅ Database status: ${healthStatus.status}`);
    console.log(`✅ Connection time: ${healthStatus.connectionTime}ms`);
    console.log(`✅ Table counts:`, healthStatus.tables);
    
    console.log('\n🎉 All basic tests passed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run tests if called directly
if (require.main === module) {
  runBasicTests();
}

module.exports = runBasicTests;