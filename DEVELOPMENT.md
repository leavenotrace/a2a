# 开发环境设置指南

## 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- MySQL >= 8.0
- Redis >= 6.0

## 快速启动

### 1. 安装依赖

```bash
# 安装所有依赖
npm run install:all
```

### 2. 启动数据库服务 (使用Docker)

```bash
# 启动MySQL和Redis
docker-compose -f docker-compose.dev.yml up -d
```

### 3. 配置环境变量

```bash
# 复制后端环境变量模板
cp backend/.env.example backend/.env

# 根据需要修改配置
vim backend/.env
```

### 4. 初始化数据库

数据库会在Docker启动时自动初始化，包含：
- 创建所有必要的表
- 插入默认管理员用户 (admin/admin123)
- 插入示例代理模板

### 5. 启动开发服务器

```bash
# 同时启动前端和后端开发服务器
npm run dev
```

或者分别启动：

```bash
# 启动后端 (端口3000)
npm run dev:backend

# 启动前端 (端口5173)
npm run dev:frontend
```

## 访问地址

- 前端应用: http://localhost:5173
- 后端API: http://localhost:3000
- API健康检查: http://localhost:3000/health

## 开发工具

### 代码格式化

```bash
# 后端代码检查
cd backend && npm run lint

# 前端代码检查
cd frontend && npm run lint
```

### 运行测试

```bash
# 运行所有测试
npm test

# 后端测试
npm run test:backend

# 前端测试
npm run test:frontend
```

## 数据库管理

### 连接信息

- 主机: localhost
- 端口: 3306
- 数据库: agent_management
- 用户名: root
- 密码: password

### 默认用户

- 用户名: admin
- 密码: admin123
- 角色: admin

## 项目结构

```
agent-management-system/
├── frontend/              # Vue.js前端
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── views/         # 页面
│   │   ├── router/        # 路由
│   │   └── store/         # 状态管理
│   └── package.json
├── backend/               # Node.js后端
│   ├── src/
│   │   ├── controllers/   # 控制器
│   │   ├── services/      # 服务层
│   │   ├── models/        # 数据模型
│   │   ├── middleware/    # 中间件
│   │   ├── routes/        # 路由
│   │   └── utils/         # 工具函数
│   └── package.json
├── database/              # 数据库脚本
└── docs/                  # 文档
```

## 常见问题

### 数据库连接失败

1. 确保MySQL服务正在运行
2. 检查环境变量配置
3. 确认数据库用户权限

### 前端代理错误

1. 确保后端服务正在运行
2. 检查vite.config.js中的代理配置
3. 确认端口没有被占用

### Redis连接失败

1. 确保Redis服务正在运行
2. 检查Redis配置
3. 确认端口6379没有被占用