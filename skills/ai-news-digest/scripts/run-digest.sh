#!/bin/bash
#
# AI 日报/周报主任务脚本
# 由 cron 调用，执行完整的抓取 -> 生成 -> 发送流程
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${SCRIPT_DIR}/../workspace"
CONFIG_FILE="${SCRIPT_DIR}/../references/config.json"

# 读取配置
TYPE="${1:-daily}"  # daily 或 weekly
CHAT_ID="${2:-${FEISHU_CHAT_ID}}"

# 从配置文件读取启用状态
QBITAI_ENABLED=$(node -e "console.log(require('${CONFIG_FILE}').sources.qbitai.enabled || false)")
TAVILY_ENABLED=$(node -e "console.log(require('${CONFIG_FILE}').sources.tavily?.enabled || false)")

# 创建工作目录
mkdir -p "${WORK_DIR}"

echo "[INFO] Starting AI News Digest - ${TYPE}"
echo "[INFO] Working directory: ${WORK_DIR}"
echo "[INFO] Sources - QbitAI: ${QBITAI_ENABLED}, Tavily: ${TAVILY_ENABLED}"

# 计算日期范围
if [ "$TYPE" = "weekly" ]; then
  SINCE_DATE=$(date -d '7 days ago' '+%Y-%m-%d')
  TAVILY_DAYS=7
  LIMIT=50
else
  SINCE_DATE=$(date -d '1 day ago' '+%Y-%m-%d')
  TAVILY_DAYS=1
  LIMIT=20
fi

ARTICLES_FILE="${WORK_DIR}/articles.json"
QBITAI_FILE="${WORK_DIR}/articles_qbitai.json"
TAVILY_FILE="${WORK_DIR}/articles_tavily.json"

# 步骤 1: 抓取量子位数据（如果启用）
if [ "$QBITAI_ENABLED" = "true" ]; then
  echo "[INFO] Step 1a: Fetching QbitAI articles..."
  if node "${SCRIPT_DIR}/fetch-qbitai.js" --since "${SINCE_DATE}" --limit ${LIMIT} > "${QBITAI_FILE}"; then
    echo "[INFO] QbitAI articles saved"
  else
    echo "[WARN] Failed to fetch QbitAI, continuing..."
    echo "[]" > "${QBITAI_FILE}"
  fi
else
  echo "[INFO] Step 1a: QbitAI disabled, skipping..."
  echo "[]" > "${QBITAI_FILE}"
fi

# 步骤 1b: 抓取 Tavily 英文新闻（如果启用）
if [ "$TAVILY_ENABLED" = "true" ]; then
  echo "[INFO] Step 1b: Fetching Tavily English articles..."
  if node "${SCRIPT_DIR}/fetch-tavily.js" --days ${TAVILY_DAYS} --limit ${LIMIT} > "${TAVILY_FILE}"; then
    echo "[INFO] Tavily articles saved"
  else
    echo "[WARN] Failed to fetch Tavily, continuing..."
    echo "[]" > "${TAVILY_FILE}"
  fi
else
  echo "[INFO] Step 1b: Tavily disabled, skipping..."
  echo "[]" > "${TAVILY_FILE}"
fi

# 合并文章数据
echo "[INFO] Merging articles from all sources..."
node -e "
const qbitai = require('${QBITAI_FILE}');
const tavily = require('${TAVILY_FILE}');
const merged = [...qbitai, ...tavily];
// 去重基于 URL
const seen = new Set();
const unique = merged.filter(a => {
  if (seen.has(a.link)) return false;
  seen.add(a.link);
  return true;
});
// 按日期排序
unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
console.log(JSON.stringify(unique, null, 2));
" > "${ARTICLES_FILE}"

ARTICLE_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').length)")
echo "[INFO] Total unique articles: ${ARTICLE_COUNT}"

# 步骤 2: 生成报告
echo "[INFO] Step 2: Generating ${TYPE} report..."
REPORT_FILE="${WORK_DIR}/report.md"
node "${SCRIPT_DIR}/generate-report.js" \
  --type "${TYPE}" \
  --data "${ARTICLES_FILE}" \
  --output "${REPORT_FILE}"
echo "[INFO] Report saved to ${REPORT_FILE}"

# 步骤 3: 发送到飞书（如果提供了 chat_id）
if [ -n "${CHAT_ID}" ]; then
  echo "[INFO] Step 3: Sending to Feishu..."
  if node "${SCRIPT_DIR}/send-feishu.js" \
    --chat-id "${CHAT_ID}" \
    --file "${REPORT_FILE}"; then
    echo "[INFO] Sent to Feishu successfully"
  else
    echo "[ERROR] Failed to send to Feishu"
    exit 1
  fi
else
  echo "[INFO] Step 3: Skipped (no chat_id provided)"
  echo "[INFO] Report location: ${REPORT_FILE}"
fi

# 清理临时文件
rm -f "${QBITAI_FILE}" "${TAVILY_FILE}"

echo "[INFO] Task completed successfully!"
