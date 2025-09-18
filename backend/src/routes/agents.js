const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const auth = require('../middleware/auth');

// 所有路由都需要认证
router.use(auth.authenticate);

// 代理CRUD操作
router.post('/', agentController.createAgent);
router.get('/', agentController.getAgents);
router.get('/stats', agentController.getAgentStats);
router.get('/processes', agentController.getAllProcessInfo);
router.get('/:id', agentController.getAgentById);
router.put('/:id', agentController.updateAgent);
router.delete('/:id', agentController.deleteAgent);

// 进程管理操作
router.post('/:id/start', agentController.startAgent);
router.post('/:id/stop', agentController.stopAgent);
router.post('/:id/restart', agentController.restartAgent);
router.get('/:id/process', agentController.getAgentProcessInfo);
router.get('/:id/health', agentController.checkAgentHealth);

// 配置验证
router.post('/validate-config', agentController.validateConfig);

module.exports = router;