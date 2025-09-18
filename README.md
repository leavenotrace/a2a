# Agent Management System

🤖 AI代理管理系统，提供完整的代理生命周期管理、实时监控和进程控制功能。

## ✨ 功能特性

- 🚀 **代理管理**: 完整的CRUD操作，支持配置验证和模板复用
- 🔄 **进程控制**: 代理启动/停止/重启，支持优雅关闭和强制终止
- 📊 **实时监控**: 进程状态监控、心跳检测和性能指标收集
- 🔐 **权限管理**: 基于JWT的用户认证和权限控制
- 📝 **日志系统**: 完整的操作日志和错误追踪
- 🎯 **健康检查**: 自动故障检测和重启机制
- 🌐 **RESTful API**: 完整的REST API接口
- ⚡ **WebSocket**: 实时状态推送和通信

## 🛠 技术栈

- **后端**: Node.js + Express.js + Sequelize ORM
- **数据库**: MySQL 8.0 + Redis
- **认证**: JWT + bcrypt
- **进程管理**: Node.js child_process
- **测试**: Jest + Supertest
- **文档**: JSDoc + Swagger

## 📁 项目结构

```
agent-management-system/
├── backend/                    # Node.js 后端服务
│   ├── src/
│   │   ├── controllers/        # 控制器层
│   │   ├── services/          # 业务逻辑层
│   │   ├── models/            # 数据模型
│   │   ├── routes/            # 路由定义
│   │   ├── middleware/        # 中间件
│   │   ├── utils/             # 工具类
│   │   ├── scripts/           # 脚本文件
│   │   ├── config/            # 配置文件
│   │   └── tests/             # 测试文件
│   ├── package.json
│   └── jest.config.js
├── database/                   # 数据库相关
│   ├── init.sql               # 初始化脚本
│   ├── migrations/            # 数据迁移
│   └── README.md
├── .kiro/                     # Kiro IDE 配置
│   └── specs/                 # 项目规范文档
└── README.md
```

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- MySQL >= 8.0
- Redis >= 6.0
- npm >= 8.0.0

### 1. 克隆项目

```bash
git clone https://github.com/leavenotrace/a2a.git
cd a2a
```

### 2. 安装依赖

```bash
cd backend
npm install
```

### 3. 配置环境变量

```bash
cp backend/.env.example backend/.env
```

编辑 `.env` 文件，配置数据库连接等信息：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=agent_management
DB_USER=root
DB_PASSWORD=your_password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# 服务器配置
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### 4. 初始化数据库

```bash
# 创建数据库
mysql -u root -p < database/init.sql

# 运行迁移
cd backend
npm run migrate
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 6. 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 生成测试覆盖率报告
npm run test:coverage
```

## 📚 API 文档

### 认证接口

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "admin",
  "email": "admin@example.com",
  "password": "password123"
}
```

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

### 代理管理接口

#### 创建代理
```http
POST /api/agents
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "my-agent",
  "description": "测试代理",
  "config": {
    "model": "gpt-3.5-turbo",
    "temperature": 0.7,
    "max_tokens": 1000
  },
  "templateId": 1
}
```

#### 获取代理列表
```http
GET /api/agents?page=1&limit=10&status=running&search=test
Authorization: Bearer <token>
```

#### 获取代理详情
```http
GET /api/agents/:id
Authorization: Bearer <token>
```

#### 更新代理
```http
PUT /api/agents/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "updated-agent",
  "description": "更新后的代理",
  "config": {
    "model": "gpt-4",
    "temperature": 0.5
  }
}
```

#### 删除代理
```http
DELETE /api/agents/:id
Authorization: Bearer <token>
```

### 进程管理接口

#### 启动代理
```http
POST /api/agents/:id/start
Authorization: Bearer <token>
```

#### 停止代理
```http
POST /api/agents/:id/stop
Authorization: Bearer <token>
Content-Type: application/json

{
  "force": false
}
```

#### 重启代理
```http
POST /api/agents/:id/restart
Authorization: Bearer <token>
```

#### 获取进程信息
```http
GET /api/agents/:id/process
Authorization: Bearer <token>
```

#### 健康检查
```http
GET /api/agents/:id/health
Authorization: Bearer <token>
```

#### 获取所有进程
```http
GET /api/agents/processes
Authorization: Bearer <token>
```

### 统计接口

#### 获取代理统计
```http
GET /api/agents/stats
Authorization: Bearer <token>
```

### 配置验证

#### 验证代理配置
```http
POST /api/agents/validate-config
Authorization: Bearer <token>
Content-Type: application/json

{
  "config": {
    "model": "gpt-3.5-turbo",
    "temperature": 0.7,
    "max_tokens": 1000
  }
}
```

## 🏗 数据库设计

### 核心表结构

- **users**: 用户信息
- **agent_templates**: 代理模板
- **agents**: 代理实例
- **agent_logs**: 代理日志
- **agent_metrics**: 性能指标

详细的数据库设计请参考 [database/README.md](database/README.md)

## 🧪 测试

项目包含完整的测试套件：

- **单元测试**: 服务层和控制器层的单元测试
- **集成测试**: API接口的集成测试
- **进程测试**: 进程管理功能测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- --testPathPattern="agentService"

# 生成覆盖率报告
npm run test:coverage
```

## 🔧 开发指南

### 代码规范

- 使用 ESLint 进行代码检查
- 遵循 JavaScript Standard Style
- 使用 JSDoc 编写文档注释

### 提交规范

使用 Conventional Commits 规范：

```
feat: 添加新功能
fix: 修复bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建过程或辅助工具的变动
```

### 分支管理

- `main`: 主分支，用于生产环境
- `develop`: 开发分支
- `feature/*`: 功能分支
- `hotfix/*`: 热修复分支

## 📈 性能优化

- 使用连接池管理数据库连接
- Redis 缓存热点数据
- 进程级别的资源监控
- 自动故障恢复机制

## 🔒 安全特性

- JWT 令牌认证
- 密码加密存储
- SQL 注入防护
- XSS 攻击防护
- 请求频率限制

## 🚀 部署

### Docker 部署

```bash
# 构建镜像
docker build -t agent-management-system .

# 运行容器
docker run -p 3000:3000 agent-management-system
```

### PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status
```

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👥 维护者

- [@leavenotrace](https://github.com/leavenotrace)

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！

---

如果你觉得这个项目有用，请给它一个 ⭐️！