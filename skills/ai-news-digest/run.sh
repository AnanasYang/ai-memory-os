#!/bin/bash
# run.sh - AI News Digest 日报生成脚本
# 稳定版：直接生成 Markdown 文件并发送

set -e

echo "=== AI News Digest - $(date '+%Y-%m-%d') ==="

# 设置环境
export TAVILY_API_KEY="${TAVILY_API_KEY:-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}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📍 工作目录: $(pwd)"
echo "🔑 API Key: ${TAVILY_API_KEY:0:10}..."

# 检查依赖
echo ""
echo "🔍 检查依赖..."
if [ ! -f "../tavily-search/scripts/search.mjs" ]; then
    echo "❌ Tavily skill 不存在"
    exit 1
fi

# 执行 Node.js 脚本生成日报
echo ""
echo "🚀 执行日报生成脚本..."
node scripts/main.mjs

# 检查输出
echo ""
echo "✅ 日报生成完成"
echo "📄 输出文件: reports/日报_$(date '+%Y-%m-%d').md"

exit 0
