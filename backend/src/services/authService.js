const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const logger = require('../utils/logger');

class AuthService {
  /**
   * 生成JWT访问令牌
   * @param {Object} payload - 令牌载荷
   * @returns {string} JWT令牌
   */
  generateAccessToken(payload) {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'agent-management-system'
      }
    );
  }

  /**
   * 生成JWT刷新令牌
   * @param {Object} payload - 令牌载荷
   * @returns {string} JWT刷新令牌
   */
  generateRefreshToken(payload) {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: 'agent-management-system'
      }
    );
  }

  /**
   * 验证JWT令牌
   * @param {string} token - JWT令牌
   * @returns {Object} 解码后的载荷
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      logger.warn('JWT令牌验证失败:', error.message);
      throw new Error('无效的令牌');
    }
  }

  /**
   * 哈希密码
   * @param {string} password - 明文密码
   * @returns {Promise<string>} 哈希后的密码
   */
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * 验证密码
   * @param {string} password - 明文密码
   * @param {string} hashedPassword - 哈希密码
   * @returns {Promise<boolean>} 密码是否匹配
   */
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * 用户登录
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<Object>} 登录结果
   */
  async login(username, password) {
    try {
      // 查找用户
      const user = await User.findOne({
        where: { username },
        attributes: ['id', 'username', 'email', 'password_hash', 'role']
      });

      if (!user) {
        throw new Error('用户名或密码错误');
      }

      // 验证密码
      const isValidPassword = await this.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('用户名或密码错误');
      }

      // 生成令牌载荷
      const payload = {
        userId: user.id,
        username: user.username,
        role: user.role
      };

      // 生成令牌
      const accessToken = this.generateAccessToken(payload);
      const refreshToken = this.generateRefreshToken({ userId: user.id });

      logger.info(`用户登录成功: ${username}`);

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.warn(`用户登录失败: ${username} - ${error.message}`);
      throw error;
    }
  }

  /**
   * 刷新访问令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<Object>} 新的访问令牌
   */
  async refreshAccessToken(refreshToken) {
    try {
      // 验证刷新令牌
      const decoded = this.verifyToken(refreshToken);
      
      // 查找用户
      const user = await User.findByPk(decoded.userId, {
        attributes: ['id', 'username', 'role']
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 生成新的访问令牌
      const payload = {
        userId: user.id,
        username: user.username,
        role: user.role
      };

      const accessToken = this.generateAccessToken(payload);

      return { accessToken };
    } catch (error) {
      logger.warn('刷新令牌失败:', error.message);
      throw new Error('无效的刷新令牌');
    }
  }

  /**
   * 验证用户权限
   * @param {string} userRole - 用户角色
   * @param {string|Array} requiredRoles - 所需角色
   * @returns {boolean} 是否有权限
   */
  hasPermission(userRole, requiredRoles) {
    if (!requiredRoles) return true;
    
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    // 角色层级: admin > operator > viewer
    const roleHierarchy = {
      'admin': 3,
      'operator': 2,
      'viewer': 1
    };

    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = Math.min(...roles.map(role => roleHierarchy[role] || 0));

    return userLevel >= requiredLevel;
  }
}

module.exports = new AuthService();