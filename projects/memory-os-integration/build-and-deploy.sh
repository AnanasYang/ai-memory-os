#!/bin/bash
# build-and-deploy.sh - 构建并部署

cd /home/bruce/.openclaw/workspace/projects/memory-os-integration

echo "🔧 安装依赖..."
npm install

echo "🏗️ 构建项目..."
npm run build

echo "✅ 构建完成！"
echo "检查 dist/ 目录..."
ls -la dist/

echo ""
echo "下一步: 推送到 GitHub"
echo "git add -A && git commit -m 'build: production' && git push origin main"