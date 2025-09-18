// Mock setup first
jest.mock('../../models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn()
  }
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const authService = require('../../services/authService');
const { User } = require('../../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('AuthService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  describe('generateAccessToken', () => {
    it('应该生成有效的访问令牌', () => {
      const payload = { userId: 1, username: 'testuser', role: 'viewer' };
      const token = authService.generateAccessToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // 验证令牌内容
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.iss).toBe('agent-management-system');
    });
  });

  describe('generateRefreshToken', () => {
    it('应该生成有效的刷新令牌', () => {
      const payload = { userId: 1 };
      const token = authService.generateRefreshToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(payload.userId);
    });
  });

  describe('verifyToken', () => {
    it('应该验证有效令牌', () => {
      const payload = { userId: 1, username: 'testuser' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);
      
      const decoded = authService.verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.username).toBe(payload.username);
    });

    it('应该拒绝无效令牌', () => {
      const invalidToken = 'invalid.token.here';
      
      expect(() => {
        authService.verifyToken(invalidToken);
      }).toThrow('无效的令牌');
    });

    it('应该拒绝过期令牌', () => {
      const expiredToken = jwt.sign(
        { userId: 1 }, 
        process.env.JWT_SECRET, 
        { expiresIn: '-1h' }
      );
      
      expect(() => {
        authService.verifyToken(expiredToken);
      }).toThrow('无效的令牌');
    });
  });

  describe('hashPassword', () => {
    it('应该哈希密码', async () => {
      const password = 'testpassword123';
      const hashedPassword = await authService.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });
  });

  describe('verifyPassword', () => {
    it('应该验证正确的密码', async () => {
      const password = 'testpassword123';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const isValid = await authService.verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('应该拒绝错误的密码', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const isValid = await authService.verifyPassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('login', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      password_hash: '$2b$12$hashedpassword',
      role: 'viewer'
    };

    beforeEach(() => {
      User.findOne.mockResolvedValue(mockUser);
      jest.spyOn(authService, 'verifyPassword').mockResolvedValue(true);
    });

    it('应该成功登录有效用户', async () => {
      const result = await authService.login('testuser', 'password123');
      
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.username).toBe(mockUser.username);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.role).toBe(mockUser.role);
      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('应该拒绝不存在的用户', async () => {
      User.findOne.mockResolvedValue(null);
      
      await expect(authService.login('nonexistent', 'password123'))
        .rejects.toThrow('用户名或密码错误');
    });

    it('应该拒绝错误的密码', async () => {
      jest.spyOn(authService, 'verifyPassword').mockResolvedValue(false);
      
      await expect(authService.login('testuser', 'wrongpassword'))
        .rejects.toThrow('用户名或密码错误');
    });
  });

  describe('refreshAccessToken', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      role: 'viewer'
    };

    beforeEach(() => {
      User.findByPk.mockResolvedValue(mockUser);
    });

    it('应该刷新有效的刷新令牌', async () => {
      const refreshToken = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
      
      const result = await authService.refreshAccessToken(refreshToken);
      
      expect(result).toHaveProperty('accessToken');
      expect(typeof result.accessToken).toBe('string');
    });

    it('应该拒绝无效的刷新令牌', async () => {
      const invalidToken = 'invalid.token';
      
      await expect(authService.refreshAccessToken(invalidToken))
        .rejects.toThrow('无效的刷新令牌');
    });

    it('应该拒绝不存在用户的刷新令牌', async () => {
      User.findByPk.mockResolvedValue(null);
      const refreshToken = jwt.sign({ userId: 999 }, process.env.JWT_SECRET);
      
      await expect(authService.refreshAccessToken(refreshToken))
        .rejects.toThrow('无效的刷新令牌');
    });
  });

  describe('hasPermission', () => {
    it('应该允许管理员访问所有资源', () => {
      expect(authService.hasPermission('admin', 'viewer')).toBe(true);
      expect(authService.hasPermission('admin', 'operator')).toBe(true);
      expect(authService.hasPermission('admin', 'admin')).toBe(true);
    });

    it('应该允许操作员访问查看者权限', () => {
      expect(authService.hasPermission('operator', 'viewer')).toBe(true);
      expect(authService.hasPermission('operator', 'operator')).toBe(true);
      expect(authService.hasPermission('operator', 'admin')).toBe(false);
    });

    it('应该只允许查看者访问查看者权限', () => {
      expect(authService.hasPermission('viewer', 'viewer')).toBe(true);
      expect(authService.hasPermission('viewer', 'operator')).toBe(false);
      expect(authService.hasPermission('viewer', 'admin')).toBe(false);
    });

    it('应该处理角色数组', () => {
      expect(authService.hasPermission('admin', ['viewer', 'operator'])).toBe(true);
      expect(authService.hasPermission('operator', ['viewer', 'operator'])).toBe(true);
      expect(authService.hasPermission('viewer', ['operator', 'admin'])).toBe(false);
    });

    it('应该在没有要求角色时返回true', () => {
      expect(authService.hasPermission('viewer', null)).toBe(true);
      expect(authService.hasPermission('viewer', undefined)).toBe(true);
    });
  });
});