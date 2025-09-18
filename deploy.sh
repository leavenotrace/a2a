#!/bin/bash

# Agent Management System 部署脚本

echo "🚀 Agent Management System 部署脚本"
echo "=================================="

# 检查Git状态
echo "📋 检查Git状态..."
git status

# 添加所有更改
echo "📦 添加所有更改到Git..."
git add .

# 提交更改
echo "💾 提交更改..."
read -p "请输入提交信息 (默认: Update project): " commit_message
commit_message=${commit_message:-"Update project"}
git commit -m "$commit_message"

# 推送到GitHub
echo "🌐 推送到GitHub..."
echo "请确保你已经："
echo "1. 在GitHub上创建了名为 'agent-management-system' 的仓库"
echo "2. 配置了正确的远程仓库地址"
echo ""
echo "当前远程仓库："
git remote -v
echo ""

read -p "是否继续推送? (y/N): " confirm
if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
    git push -u origin main
    echo "✅ 代码已成功推送到GitHub!"
    echo ""
    echo "🔗 项目链接: https://github.com/your-username/agent-management-system"
    echo "📚 请记得更新README中的GitHub用户名"
else
    echo "❌ 推送已取消"
fi

echo ""
echo "🎉 部署脚本执行完成!"