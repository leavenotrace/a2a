const authService = require('../services/authService');
const { User } = require('../models');
const logger = require('../utils/logger');
const Joi = require('joi');
const { Op } = require('sequelize');

class AuthController {
  /**
   * 用户登录
   */
  async login(req, res) {
    try {
      // 验证请求参数
      const schema = Joi.object({
        username: Joi.string().required().messages({
          'string.empty': '用户名不能为空',
          'any.required': '用户名是必填项'
        }),
        password: Joi.string().required().messages({
          'string.empty': '密码不能为空',
          'any.required': '密码是必填项'
        })
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message
        });
      }

      const { username, password } = value;

      // 执行登录
      const result = await authService.login(username, password);

      res.json({
        success: true,
        message: '登录成功',
        data: result
      });

    } catch (error) {
      logger.error('登录失败:', error);
      res.status(401).json({
        error: 'LOGIN_FAILED',
        message: error.message
      });
    }
  }

  /**
   * 用户注册
   */
  async register(req, res) {
    try {
      // 验证请求参数
      const schema = Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required().messages({
          'string.alphanum': '用户名只能包含字母和数字',
          'string.min': '用户名至少3个字符',
          'string.max': '用户名最多30个字符',
          'any.required': '用户名是必填项'
        }),
        email: Joi.string().email().required().messages({
          'string.email': '请输入有效的邮箱地址',
          'any.required': '邮箱是必填项'
        }),
        password: Joi.string().min(6).required().messages({
          'string.min': '密码至少6个字符',
          'any.required': '密码是必填项'
        }),
        role: Joi.string().valid('admin', 'operator', 'viewer').default('viewer')
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message
        });
      }

      const { username, email, password, role } = value;

      // 检查用户名是否已存在
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ username }, { email }]
        }
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'USER_EXISTS',
          message: existingUser.username === username ? '用户名已存在' : '邮箱已被使用'
        });
      }

      // 创建用户
      const hashedPassword = await authService.hashPassword(password);
      const user = await User.create({
        username,
        email,
        password_hash: hashedPassword,
        role
      });

      // 生成令牌
      const payload = {
        userId: user.id,
        username: user.username,
        role: user.role
      };

      const accessToken = authService.generateAccessToken(payload);
      const refreshToken = authService.generateRefreshToken({ userId: user.id });

      logger.info(`新用户注册: ${username}`);

      res.status(201).json({
        success: true,
        message: '注册成功',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          },
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      logger.error('注册失败:', error);
      res.status(500).json({
        error: 'REGISTRATION_FAILED',
        message: '注册失败，请稍后重试'
      });
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: 'MISSING_REFRESH_TOKEN',
          message: '缺少刷新令牌'
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      res.json({
        success: true,
        message: '令牌刷新成功',
        data: result
      });

    } catch (error) {
      logger.error('令牌刷新失败:', error);
      res.status(401).json({
        error: 'TOKEN_REFRESH_FAILED',
        message: error.message
      });
    }
  }

  /**
   * 获取当前用户信息
   */
  async getProfile(req, res) {
    try {
      const user = await User.findByPk(req.user.userId, {
        attributes: ['id', 'username', 'email', 'role', 'created_at', 'updated_at']
      });

      if (!user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        });
      }

      res.json({
        success: true,
        data: user
      });

    } catch (error) {
      logger.error('获取用户信息失败:', error);
      res.status(500).json({
        error: 'PROFILE_FETCH_FAILED',
        message: '获取用户信息失败'
      });
    }
  }

  /**
   * 更新用户信息
   */
  async updateProfile(req, res) {
    try {
      // 验证请求参数
      const schema = Joi.object({
        email: Joi.string().email().messages({
          'string.email': '请输入有效的邮箱地址'
        }),
        currentPassword: Joi.string().when('newPassword', {
          is: Joi.exist(),
          then: Joi.required(),
          otherwise: Joi.optional()
        }),
        newPassword: Joi.string().min(6).messages({
          'string.min': '新密码至少6个字符'
        })
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message
        });
      }

      const { email, currentPassword, newPassword } = value;
      const userId = req.user.userId;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        });
      }

      const updateData = {};

      // 更新邮箱
      if (email && email !== user.email) {
        // 检查邮箱是否已被使用
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
          return res.status(409).json({
            error: 'EMAIL_EXISTS',
            message: '邮箱已被使用'
          });
        }
        updateData.email = email;
      }

      // 更新密码
      if (newPassword) {
        // 验证当前密码
        const isValidPassword = await authService.verifyPassword(currentPassword, user.password_hash);
        if (!isValidPassword) {
          return res.status(400).json({
            error: 'INVALID_CURRENT_PASSWORD',
            message: '当前密码错误'
          });
        }

        updateData.password_hash = await authService.hashPassword(newPassword);
      }

      // 执行更新
      if (Object.keys(updateData).length > 0) {
        await user.update(updateData);
        logger.info(`用户信息更新: ${user.username}`);
      }

      res.json({
        success: true,
        message: '用户信息更新成功',
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });

    } catch (error) {
      logger.error('更新用户信息失败:', error);
      res.status(500).json({
        error: 'PROFILE_UPDATE_FAILED',
        message: '更新用户信息失败'
      });
    }
  }

  /**
   * 用户登出
   */
  async logout(req, res) {
    try {
      // 在实际应用中，这里可以将令牌加入黑名单
      // 或者在Redis中记录已登出的令牌
      
      logger.info(`用户登出: ${req.user.username}`);

      res.json({
        success: true,
        message: '登出成功'
      });

    } catch (error) {
      logger.error('登出失败:', error);
      res.status(500).json({
        error: 'LOGOUT_FAILED',
        message: '登出失败'
      });
    }
  }

  /**
   * 获取用户列表（管理员功能）
   */
  async getUsers(req, res) {
    try {
      const { page = 1, limit = 10, role, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      
      if (role) {
        whereClause.role = role;
      }

      if (search) {
        whereClause[Op.or] = [
          { username: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ];
      }

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        attributes: ['id', 'username', 'email', 'role', 'created_at', 'updated_at'],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      logger.error('获取用户列表失败:', error);
      res.status(500).json({
        error: 'USERS_FETCH_FAILED',
        message: '获取用户列表失败'
      });
    }
  }

  /**
   * 更新用户角色（管理员功能）
   */
  async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      // 验证角色
      if (!['admin', 'operator', 'viewer'].includes(role)) {
        return res.status(400).json({
          error: 'INVALID_ROLE',
          message: '无效的用户角色'
        });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        });
      }

      // 防止管理员修改自己的角色
      if (parseInt(userId) === req.user.userId && role !== 'admin') {
        return res.status(400).json({
          error: 'CANNOT_MODIFY_OWN_ROLE',
          message: '不能修改自己的角色'
        });
      }

      await user.update({ role });

      logger.info(`管理员 ${req.user.username} 更新用户 ${user.username} 的角色为 ${role}`);

      res.json({
        success: true,
        message: '用户角色更新成功',
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });

    } catch (error) {
      logger.error('更新用户角色失败:', error);
      res.status(500).json({
        error: 'ROLE_UPDATE_FAILED',
        message: '更新用户角色失败'
      });
    }
  }

  /**
   * 删除用户（管理员功能）
   */
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: '用户不存在'
        });
      }

      // 防止管理员删除自己
      if (parseInt(userId) === req.user.userId) {
        return res.status(400).json({
          error: 'CANNOT_DELETE_SELF',
          message: '不能删除自己的账户'
        });
      }

      await user.destroy();

      logger.info(`管理员 ${req.user.username} 删除用户 ${user.username}`);

      res.json({
        success: true,
        message: '用户删除成功'
      });

    } catch (error) {
      logger.error('删除用户失败:', error);
      res.status(500).json({
        error: 'USER_DELETE_FAILED',
        message: '删除用户失败'
      });
    }
  }
}

module.exports = new AuthController();