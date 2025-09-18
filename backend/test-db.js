const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  try {
    console.log('🔍 测试数据库连接...');
    console.log(`主机: ${process.env.DB_HOST}`);
    console.log(`端口: ${process.env.DB_PORT}`);
    console.log(`数据库: ${process.env.DB_NAME}`);
    console.log(`用户: ${process.env.DB_USER}`);
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 10000, // 10秒超时
      acquireTimeout: 10000,
      timeout: 10000
    });

    console.log('✅ 数据库连接成功!');
    
    // 测试查询
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ 测试查询成功:', rows);
    
    await connection.end();
    console.log('✅ 连接已关闭');
    
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.error('错误代码:', error.code);
    
    if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 可能的解决方案:');
      console.log('1. 检查网络连接');
      console.log('2. 确认数据库服务器是否运行');
      console.log('3. 检查防火墙设置');
      console.log('4. 验证数据库配置信息');
    }
  }
}

testConnection();