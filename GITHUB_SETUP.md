# GitHub 仓库设置指南

## 📋 步骤说明

### 1. 创建GitHub仓库

1. 访问 [GitHub](https://github.com)
2. 点击右上角的 "+" 按钮，选择 "New repository"
3. 填写仓库信息：
   - **Repository name**: `agent-management-system`
   - **Description**: `🤖 AI代理管理系统 - 提供完整的代理生命周期管理、实时监控和进程控制功能`
   - **Visibility**: Public (推荐) 或 Private
   - **不要**勾选 "Add a README file"、"Add .gitignore"、"Choose a license"（因为我们已经有了这些文件）

4. 点击 "Create repository"

### 2. 配置远程仓库

如果你的GitHub用户名不是 `your-username`，请更新远程仓库地址：

```bash
# 移除当前远程仓库
git remote remove origin

# 添加你的GitHub仓库地址
git remote add origin https://github.com/YOUR_USERNAME/agent-management-system.git
```

### 3. 推送代码

```bash
# 推送代码到GitHub
git push -u origin main
```

或者使用我们提供的部署脚本：

```bash
./deploy.sh
```

### 4. 更新README

推送完成后，请更新README.md中的以下内容：

1. 将所有 `your-username` 替换为你的实际GitHub用户名
2. 更新克隆地址：
   ```bash
   git clone https://github.com/YOUR_USERNAME/agent-management-system.git
   ```
3. 更新维护者信息

### 5. 设置GitHub Pages（可选）

如果你想要部署文档网站：

1. 进入仓库的 Settings 页面
2. 滚动到 "Pages" 部分
3. 在 "Source" 下选择 "Deploy from a branch"
4. 选择 "main" 分支和 "/ (root)" 文件夹
5. 点击 "Save"

### 6. 配置GitHub Actions（可选）

项目已经准备好CI/CD配置，你可以添加GitHub Actions工作流：

创建 `.github/workflows/ci.yml` 文件来自动运行测试。

## 🔧 故障排除

### 认证问题

如果推送时遇到认证问题：

1. **使用Personal Access Token**:
   - 访问 GitHub Settings > Developer settings > Personal access tokens
   - 生成新的token，选择适当的权限
   - 使用token作为密码进行推送

2. **使用SSH**:
   ```bash
   # 生成SSH密钥
   ssh-keygen -t ed25519 -C "your_email@example.com"
   
   # 添加到GitHub账户
   # 然后更改远程仓库地址为SSH格式
   git remote set-url origin git@github.com:YOUR_USERNAME/agent-management-system.git
   ```

### 推送被拒绝

如果遇到 "Updates were rejected" 错误：

```bash
# 强制推送（仅在确定没有其他人协作时使用）
git push -f origin main
```

## 📞 需要帮助？

如果遇到任何问题，请：

1. 检查GitHub仓库是否正确创建
2. 确认远程仓库地址是否正确
3. 验证你的GitHub认证是否有效
4. 查看Git错误信息获取更多详情

---

完成设置后，你的项目将在以下地址可用：
`https://github.com/YOUR_USERNAME/agent-management-system`