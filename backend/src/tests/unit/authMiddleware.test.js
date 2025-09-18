// Mock setup first
jest.mock('../../services/authService');
jest.mock('../../utils/logger', () => ({
  warn: jest.fn()
}));

const { 
  authenticateToken, 
  requireRole, 
  optionalAuth, 
  requireOwnershipOrAdmin 
} = require('../../middleware/auth');
const authService = require('../../services/authService');

describe('Auth Middleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null,
      params: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('应该成功验证有效令牌', () => {
      const mockUser = { userId: 1, username: 'testuser', role: 'viewer' };
      req.headers.authorization = 'Bearer valid-token';
      authService.verifyToken.mockReturnValue(mockUser);

      authenticateToken(req, res, next);

      expect(authService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('应该拒绝缺少令牌的请求', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AUTH_001',
        message: '缺少访问令牌'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该拒绝无效令牌', () => {
      req.headers.authorization = 'Bearer invalid-token';
      authService.verifyToken.mockImplementation(() => {
        throw new Error('无效的令牌');
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AUTH_003',
        message: '无效的访问令牌'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该处理过期令牌', () => {
      req.headers.authorization = 'Bearer expired-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      authService.verifyToken.mockImplementation(() => {
        throw error;
      });

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AUTH_002',
        message: '令牌已过期'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该处理Bearer格式的令牌', () => {
      const mockUser = { userId: 1, username: 'testuser', role: 'viewer' };
      req.headers.authorization = 'Bearer valid-token';
      authService.verifyToken.mockReturnValue(mockUser);

      authenticateToken(req, res, next);

      expect(authService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      req.user = { userId: 1, username: 'testuser', role: 'viewer' };
    });

    it('应该允许有权限的用户访问', () => {
      authService.hasPermission.mockReturnValue(true);
      const middleware = requireRole('viewer');

      middleware(req, res, next);

      expect(authService.hasPermission).toHaveBeenCalledWith('viewer', 'viewer');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('应该拒绝权限不足的用户', () => {
      authService.hasPermission.mockReturnValue(false);
      const middleware = requireRole('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AUTH_005',
        message: '权限不足'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该拒绝未认证的用户', () => {
      req.user = null;
      const middleware = requireRole('viewer');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AUTH_004',
        message: '用户未认证'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该处理角色数组', () => {
      authService.hasPermission.mockReturnValue(true);
      const middleware = requireRole(['viewer', 'operator']);

      middleware(req, res, next);

      expect(authService.hasPermission).toHaveBeenCalledWith('viewer', ['viewer', 'operator']);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('应该在没有令牌时继续执行', () => {
      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    it('应该在有效令牌时设置用户信息', () => {
      const mockUser = { userId: 1, username: 'testuser', role: 'viewer' };
      req.headers.authorization = 'Bearer valid-token';
      authService.verifyToken.mockReturnValue(mockUser);

      optionalAuth(req, res, next);

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('应该在无效令牌时继续执行但不设置用户', () => {
      req.headers.authorization = 'Bearer invalid-token';
      authService.verifyToken.mockImplementation(() => {
        throw new Error('无效的令牌');
      });

      optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireOwnershipOrAdmin', () => {
    it('应该允许管理员访问任何资源', () => {
      req.user = { userId: 1, username: 'admin', role: 'admin' };
      req.params.userId = '2';
      const middleware = requireOwnershipOrAdmin('userId');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('应该允许用户访问自己的资源', () => {
      req.user = { userId: 1, username: 'testuser', role: 'viewer' };
      req.params.userId = '1';
      const middleware = requireOwnershipOrAdmin('userId');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('应该拒绝用户访问他人的资源', () => {
      req.user = { userId: 1, username: 'testuser', role: 'viewer' };
      req.params.userId = '2';
      const middleware = requireOwnershipOrAdmin('userId');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AUTH_007',
        message: '只能访问自己的资源'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该拒绝未认证的用户', () => {
      req.user = null;
      const middleware = requireOwnershipOrAdmin('userId');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AUTH_004',
        message: '用户未认证'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该处理缺少资源ID的情况', () => {
      req.user = { userId: 1, username: 'testuser', role: 'viewer' };
      const middleware = requireOwnershipOrAdmin('userId');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AUTH_006',
        message: '无法确定资源所有者'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该从请求体中获取资源ID', () => {
      req.user = { userId: 1, username: 'testuser', role: 'viewer' };
      req.body.userId = '1';
      const middleware = requireOwnershipOrAdmin('userId');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});