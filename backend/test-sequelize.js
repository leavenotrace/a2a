const sequelize = require('./src/config/database');

async function testSequelize() {
  try {
    console.log('🔍 测试Sequelize连接...');
    
    await sequelize.authenticate();
    console.log('✅ Sequelize连接成功!');
    
    // 测试查询
    const [results] = await sequelize.query('SELECT 1 as test');
    console.log('✅ Sequelize查询成功:', results);
    
    await sequelize.close();
    console.log('✅ Sequelize连接已关闭');
    
  } catch (error) {
    console.error('❌ Sequelize连接失败:', error.message);
    console.error('错误详情:', error);
  }
}

testSequelize();