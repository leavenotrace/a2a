// Mock setup first
jest.mock('../../models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock('../../services/authService');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const authController = require('../../controllers/authController');
const authService = require('../../services/authService');
const { User } = require('../../models');

describe('AuthController Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('应该成功登录有效用户', async () => {
      req.body = { username: 'testuser', password: 'password123' };
      
      const loginResult = {
        user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'viewer' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      };
      
      authService.login.mockResolvedValue(loginResult);

      await authController.login(req, res);

      expect(authService.login).toHaveBeenCalledWith('testuser', 'password123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '登录成功',
        data: loginResult
      });
    });

    it('应该拒绝无效的登录请求', async () => {
      req.body = { username: '', password: 'password123' };

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'VALIDATION_ERROR',
        message: '用户名不能为空'
      });
    });

    it('应该处理登录失败', async () => {
      req.body = { username: 'testuser', password: 'wrongpassword' };
      authService.login.mockRejectedValue(new Error('用户名或密码错误'));

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'LOGIN_FAILED',
        message: '用户名或密码错误'
      });
    });
  });

  describe('register', () => {
    it('应该成功注册新用户', async () => {
      req.body = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        role: 'viewer'
      };

      User.findOne.mockResolvedValue(null);
      authService.hashPassword.mockResolvedValue('hashed-password');
      
      const mockUser = {
        id: 1,
        username: 'newuser',
        email: 'new@example.com',
        role: 'viewer'
      };
      
      User.create.mockResolvedValue(mockUser);
      authService.generateAccessToken.mockReturnValue('access-token');
      authService.generateRefreshToken.mockReturnValue('refresh-token');

      await authController.register(req, res);

      expect(User.create).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'new@example.com',
        password_hash: 'hashed-password',
        role: 'viewer'
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '注册成功',
        data: {
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      });
    });

    it('应该拒绝已存在的用户名', async () => {
      req.body = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'password123'
      };

      User.findOne.mockResolvedValue({ username: 'existinguser' });

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'USER_EXISTS',
        message: '用户名已存在'
      });
    });

    it('应该验证注册参数', async () => {
      req.body = {
        username: 'ab', // 太短
        email: 'invalid-email',
        password: '123' // 太短
      };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'VALIDATION_ERROR',
        message: '用户名至少3个字符'
      });
    });
  });

  describe('refreshToken', () => {
    it('应该成功刷新令牌', async () => {
      req.body = { refreshToken: 'valid-refresh-token' };
      
      const refreshResult = { accessToken: 'new-access-token' };
      authService.refreshAccessToken.mockResolvedValue(refreshResult);

      await authController.refreshToken(req, res);

      expect(authService.refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '令牌刷新成功',
        data: refreshResult
      });
    });

    it('应该拒绝缺少刷新令牌的请求', async () => {
      req.body = {};

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'MISSING_REFRESH_TOKEN',
        message: '缺少刷新令牌'
      });
    });
  });

  describe('getProfile', () => {
    it('应该返回用户信息', async () => {
      req.user = { userId: 1 };
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'viewer',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      User.findByPk.mockResolvedValue(mockUser);

      await authController.getProfile(req, res);

      expect(User.findByPk).toHaveBeenCalledWith(1, {
        attributes: ['id', 'username', 'email', 'role', 'created_at', 'updated_at']
      });
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });

    it('应该处理用户不存在的情况', async () => {
      req.user = { userId: 999 };
      User.findByPk.mockResolvedValue(null);

      await authController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'USER_NOT_FOUND',
        message: '用户不存在'
      });
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      req.user = { userId: 1 };
    });

    it('应该成功更新邮箱', async () => {
      req.body = { email: 'newemail@example.com' };
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'old@example.com',
        role: 'viewer',
        update: jest.fn().mockResolvedValue()
      };
      
      User.findByPk.mockResolvedValue(mockUser);
      User.findOne.mockResolvedValue(null); // 邮箱不存在

      await authController.updateProfile(req, res);

      expect(mockUser.update).toHaveBeenCalledWith({
        email: 'newemail@example.com'
      });
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '用户信息更新成功',
        data: {
          id: 1,
          username: 'testuser',
          email: 'old@example.com',
          role: 'viewer'
        }
      });
    });

    it('应该成功更新密码', async () => {
      req.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      };
      
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'old-hash',
        role: 'viewer',
        update: jest.fn().mockResolvedValue()
      };
      
      User.findByPk.mockResolvedValue(mockUser);
      authService.verifyPassword.mockResolvedValue(true);
      authService.hashPassword.mockResolvedValue('new-hash');

      await authController.updateProfile(req, res);

      expect(authService.verifyPassword).toHaveBeenCalledWith('oldpassword', 'old-hash');
      expect(mockUser.update).toHaveBeenCalledWith({
        password_hash: 'new-hash'
      });
    });

    it('应该拒绝错误的当前密码', async () => {
      req.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };
      
      const mockUser = {
        password_hash: 'old-hash'
      };
      
      User.findByPk.mockResolvedValue(mockUser);
      authService.verifyPassword.mockResolvedValue(false);

      await authController.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'INVALID_CURRENT_PASSWORD',
        message: '当前密码错误'
      });
    });
  });

  describe('getUsers', () => {
    it('应该返回用户列表', async () => {
      req.query = { page: '1', limit: '10' };
      
      const mockUsers = [
        { id: 1, username: 'user1', email: 'user1@example.com', role: 'viewer' },
        { id: 2, username: 'user2', email: 'user2@example.com', role: 'operator' }
      ];
      
      User.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: mockUsers
      });

      await authController.getUsers(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          users: mockUsers,
          pagination: {
            total: 2,
            page: 1,
            limit: 10,
            pages: 1
          }
        }
      });
    });

    it('应该支持搜索和过滤', async () => {
      req.query = { page: '1', limit: '10', role: 'admin', search: 'test' };

      User.findAndCountAll.mockResolvedValue({
        count: 0,
        rows: []
      });

      await authController.getUsers(req, res);

      expect(User.findAndCountAll).toHaveBeenCalledWith({
        where: expect.objectContaining({
          role: 'admin'
        }),
        attributes: ['id', 'username', 'email', 'role', 'created_at', 'updated_at'],
        limit: 10,
        offset: 0,
        order: [['created_at', 'DESC']]
      });
    });
  });

  describe('updateUserRole', () => {
    beforeEach(() => {
      req.user = { userId: 1, username: 'admin' };
    });

    it('应该成功更新用户角色', async () => {
      req.params = { userId: '2' };
      req.body = { role: 'operator' };
      
      const mockUser = {
        id: 2,
        username: 'testuser',
        email: 'test@example.com',
        role: 'viewer',
        update: jest.fn().mockResolvedValue()
      };
      
      User.findByPk.mockResolvedValue(mockUser);

      await authController.updateUserRole(req, res);

      expect(mockUser.update).toHaveBeenCalledWith({ role: 'operator' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '用户角色更新成功',
        data: {
          id: 2,
          username: 'testuser',
          email: 'test@example.com',
          role: 'viewer'
        }
      });
    });

    it('应该拒绝无效的角色', async () => {
      req.params = { userId: '2' };
      req.body = { role: 'invalid' };

      await authController.updateUserRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'INVALID_ROLE',
        message: '无效的用户角色'
      });
    });

    it('应该防止管理员修改自己的角色', async () => {
      req.params = { userId: '1' };
      req.body = { role: 'viewer' };
      
      const mockUser = { id: 1 };
      User.findByPk.mockResolvedValue(mockUser);

      await authController.updateUserRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CANNOT_MODIFY_OWN_ROLE',
        message: '不能修改自己的角色'
      });
    });
  });

  describe('deleteUser', () => {
    beforeEach(() => {
      req.user = { userId: 1, username: 'admin' };
    });

    it('应该成功删除用户', async () => {
      req.params = { userId: '2' };
      
      const mockUser = {
        id: 2,
        username: 'testuser',
        destroy: jest.fn().mockResolvedValue()
      };
      
      User.findByPk.mockResolvedValue(mockUser);

      await authController.deleteUser(req, res);

      expect(mockUser.destroy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '用户删除成功'
      });
    });

    it('应该防止管理员删除自己', async () => {
      req.params = { userId: '1' };
      
      const mockUser = { id: 1 };
      User.findByPk.mockResolvedValue(mockUser);

      await authController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CANNOT_DELETE_SELF',
        message: '不能删除自己的账户'
      });
    });

    it('应该处理用户不存在的情况', async () => {
      req.params = { userId: '999' };
      User.findByPk.mockResolvedValue(null);

      await authController.deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'USER_NOT_FOUND',
        message: '用户不存在'
      });
    });
  });
});