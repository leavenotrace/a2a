const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// 公开路由（不需要认证）
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh', authController.refreshToken);

// 需要认证的路由
router.use(authenticateToken);

// 用户个人信息管理
router.get('/profile', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.post('/logout', authController.logout);

// 管理员功能（需要管理员权限）
router.get('/users', requireRole('admin'), authController.getUsers);
router.put('/users/:userId/role', requireRole('admin'), authController.updateUserRole);
router.delete('/users/:userId', requireRole('admin'), authController.deleteUser);

module.exports = router;