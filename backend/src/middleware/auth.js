const authService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * JWT认证中间件
 * 验证请求头中的JWT令牌
 */
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'AUTH_001',
        message: '缺少访问令牌'
      });
    }

    // 验证令牌
    const decoded = authService.verifyToken(token);
    
    // 将用户信息添加到请求对象
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };

    next();
  } catch (error) {
    logger.warn('认证失败:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'AUTH_002',
        message: '令牌已过期'
      });
    }

    return res.status(401).json({
      error: 'AUTH_003',
      message: '无效的访问令牌'
    });
  }
};

/**
 * 权限验证中间件工厂函数
 * @param {string|Array} requiredRoles - 所需角色
 * @returns {Function} 中间件函数
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTH_004',
        message: '用户未认证'
      });
    }

    const hasPermission = authService.hasPermission(req.user.role, requiredRoles);
    
    if (!hasPermission) {
      logger.warn(`权限不足: 用户 ${req.user.username} (${req.user.role}) 尝试访问需要 ${requiredRoles} 权限的资源`);
      return res.status(403).json({
        error: 'AUTH_005',
        message: '权限不足'
      });
    }

    next();
  };
};

/**
 * 可选认证中间件
 * 如果提供了令牌则验证，否则继续执行
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = authService.verifyToken(token);
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
  } catch (error) {
    // 可选认证失败时不阻止请求，但记录日志
    logger.warn('可选认证失败:', error.message);
  }

  next();
};

/**
 * 检查用户是否为资源所有者或管理员
 * @param {string} resourceUserIdField - 资源中用户ID字段名
 * @returns {Function} 中间件函数
 */
const requireOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTH_004',
        message: '用户未认证'
      });
    }

    // 管理员可以访问所有资源
    if (req.user.role === 'admin') {
      return next();
    }

    // 检查资源所有权
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (!resourceUserId) {
      return res.status(400).json({
        error: 'AUTH_006',
        message: '无法确定资源所有者'
      });
    }

    if (parseInt(resourceUserId) !== req.user.userId) {
      return res.status(403).json({
        error: 'AUTH_007',
        message: '只能访问自己的资源'
      });
    }

    next();
  };
};

module.exports = {
  authenticate: authenticateToken, // 添加别名
  authenticateToken,
  requireRole,
  optionalAuth,
  requireOwnershipOrAdmin
};