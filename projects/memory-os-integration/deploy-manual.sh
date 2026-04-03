#!/bin/bash
# deploy-to-netlify.sh - 手动部署脚本

echo "🚀 AI Memory OS - Netlify 手动部署指南"
echo "========================================"
echo ""
echo "由于网络问题，GitHub 推送失败。"
echo "请使用以下手动步骤完成部署："
echo ""
echo "步骤 1: 创建 GitHub 仓库"
echo "------------------------"
echo "1. 访问 https://github.com/new"
echo "2. 仓库名称: ai-memory-os"
echo "3. 设置为 Public"
echo "4. 不要初始化 README"
echo ""
echo "步骤 2: 本地推送（在终端执行）"
echo "------------------------------"
cat << 'EOF'
cd /home/bruce/.openclaw/workspace/projects/memory-os-integration

# 添加远程仓库
git remote add origin https://github.com/AnanasYang/ai-memory-os.git

# 或者使用 SSH（如果 HTTPS 失败）
# git remote add origin git@github.com:AnanasYang/ai-memory-os.git

# 推送代码
git push -u origin main
EOF
echo ""
echo "步骤 3: Netlify 部署"
echo "--------------------"
echo "1. 访问 https://app.netlify.com/"
echo "2. 点击 'Add new site' → 'Import an existing project'"
echo "3. 选择 GitHub → 授权 → 选择 ai-memory-os 仓库"
echo "4. 构建设置："
echo "   - Build command: 留空（使用已构建的 dist）"
echo "   - Publish directory: dist"
echo "5. 点击 'Deploy site'"
echo ""
echo "备选方案：直接上传"
echo "------------------"
echo "如果 GitHub 推送一直失败，可以直接在 Netlify 上传："
echo "1. 访问 https://app.netlify.com/drop"
echo "2. 将 dist/ 文件夹压缩为 zip"
echo "3. 拖拽上传到 Netlify"
echo ""
echo "✅ 项目已准备就绪！"
echo "项目位置: /home/bruce/.openclaw/workspace/projects/memory-os-integration/"
echo "构建输出: dist/index.html"
