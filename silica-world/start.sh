#!/bin/bash
# Silica World 启动脚本

cd /home/bruce/.openclaw/workspace/silica-world

echo "🌊 启动 Silica World..."
echo ""

# 检查依赖
echo "📦 检查代码..."
python3 -c "from core.physics import World, Food; from agents.agent import SilicaAgent; from core.manager import SilicaWorldManager; print('✅ 代码检查通过')" || exit 1

echo ""
echo "🚀 启动服务器..."
echo "   地址: http://localhost:8080"
echo ""

# 启动服务器
exec python3 launch.py --port 8080
