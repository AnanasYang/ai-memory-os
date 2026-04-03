#!/bin/bash
#
# AI News Digest - OpenClaw Cron 包装脚本
# 生成报告并通过 OpenClaw message 工具发送到飞书
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TYPE="${1:-daily}"

# 获取当前日期
DATE_STR=$(date +%Y-%m-%d)

echo "[INFO] =========================================="
echo "[INFO] AI News Digest - OpenClaw Wrapper"
echo "[INFO] Type: ${TYPE}, Date: ${DATE_STR}"
echo "[INFO] =========================================="

# 1. 运行主脚本生成报告
echo "[INFO] Running ai-news-digest..."
export TAVILY_API_KEY="${TAVILY_API_KEY:-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}"
cd "${SCRIPT_DIR}/.."

if "${SCRIPT_DIR}/run-digest-v2.sh" "${TYPE}"; then
  echo "[INFO] Report generated successfully"
else
  echo "[ERROR] Failed to generate report"
  exit 1
fi

# 2. 读取生成的报告
REPORT_FILE="${SCRIPT_DIR}/../workspace/report.md"
if [ ! -f "${REPORT_FILE}" ]; then
  echo "[ERROR] Report file not found: ${REPORT_FILE}"
  exit 1
fi

# 3. 准备发送内容（截断以适应飞书限制）
# 提取概览和核心内容
SUMMARY=$(head -100 "${REPORT_FILE}")

# 构建发送消息
cat << 'EOF'
🤖 AI News Digest 报告已生成

Type: TYPE_PLACEHOLDER
Date: DATE_PLACEHOLDER
Articles: ARTICLES_PLACEHOLDER

报告完整内容请查看 workspace/report.md
EOF

echo "[INFO] =========================================="
echo "[INFO] Wrapper completed"
echo "[INFO] Report: ${REPORT_FILE}"
echo "[INFO] =========================================="
