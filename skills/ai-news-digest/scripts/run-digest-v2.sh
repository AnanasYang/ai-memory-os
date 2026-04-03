#!/bin/bash
#
# AI 日报/周报 - 增强版主任务脚本
# 整合所有可用 skills，确保稳定运行
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${SCRIPT_DIR}/../workspace"
LOG_FILE="${WORK_DIR}/cron.log"
CONFIG_FILE="${SCRIPT_DIR}/../references/config.json"

# 读取配置
TYPE="${1:-daily}"
CHAT_ID="${2:-${FEISHU_CHAT_ID}}"

# 记录日志的函数
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

# 错误处理
error_exit() {
  log "[ERROR] $1"
  # 发送错误通知（如果有 chat_id）
  if [ -n "${CHAT_ID}" ]; then
    send_error_notification "$1"
  fi
  exit 1
}

# 发送错误通知
send_error_notification() {
  local error_msg="$1"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  
  # 使用飞书发送错误通知
  curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"chat_id\": \"${CHAT_ID}\",
      \"msg_type\": \"text\",
      \"content\": {
        \"text\": \"⚠️ AI News Digest 运行异常\\n\\n时间: ${timestamp}\\n类型: ${TYPE}\\n错误: ${error_msg}\\n\\n请检查日志: ${LOG_FILE}\"
      }
    }" \
    "https://open.feishu.cn/open-apis/message/v4/send/" 2>/dev/null || true
}

# 从配置文件读取启用状态
get_config() {
  node -e "
    const config = require('${CONFIG_FILE}');
    console.log(JSON.stringify(config));
  " 2>/dev/null || echo '{}'
}

QBITAI_ENABLED=$(node -e "
  try {
    const config = require('${CONFIG_FILE}');
    console.log(config.sources.qbitai.enabled || false);
  } catch { console.log('false'); }
")

TAVILY_ENABLED=$(node -e "
  try {
    const config = require('${CONFIG_FILE}');
    console.log(config.sources.tavily?.enabled || false);
  } catch { console.log('false'); }
")

# 创建工作目录
mkdir -p "${WORK_DIR}"

log "=========================================="
log "Starting AI News Digest - ${TYPE}"
log "Working directory: ${WORK_DIR}"
log "Sources - QbitAI: ${QBITAI_ENABLED}, Tavily: ${TAVILY_ENABLED}"

# 计算日期范围
if [ "$TYPE" = "weekly" ]; then
  SINCE_DATE=$(date -d '7 days ago' '+%Y-%m-%d')
  TAVILY_DAYS=7
  LIMIT=50
  TOP_N=10
else
  SINCE_DATE=$(date -d '1 day ago' '+%Y-%m-%d')
  TAVILY_DAYS=1
  LIMIT=30
  TOP_N=5
fi

# 文件路径
ARTICLES_FILE="${WORK_DIR}/articles.json"
QBITAI_FILE="${WORK_DIR}/articles_qbitai.json"
TAVILY_FILE="${WORK_DIR}/articles_tavily.json"
REPORT_FILE="${WORK_DIR}/report.md"

# 清理旧文件
rm -f "${QBITAI_FILE}" "${TAVILY_FILE}"

# ==========================================
# 步骤 1: 数据抓取
# ==========================================

# 1a. 抓取量子位（中文源）
if [ "$QBITAI_ENABLED" = "true" ]; then
  log "[Step 1a] Fetching QbitAI articles..."
  if node "${SCRIPT_DIR}/fetch-qbitai.js" --since "${SINCE_DATE}" --limit ${LIMIT} > "${QBITAI_FILE}" 2>> "${LOG_FILE}"; then
    QBITAI_COUNT=$(node -e "console.log(require('${QBITAI_FILE}').length)")
    log "[Step 1a] ✓ QbitAI articles saved: ${QBITAI_COUNT}"
  else
    log "[Step 1a] ✗ Failed to fetch QbitAI, continuing..."
    echo "[]" > "${QBITAI_FILE}"
  fi
else
  log "[Step 1a] QbitAI disabled, skipping..."
  echo "[]" > "${QBITAI_FILE}"
fi

# 1b. 抓取 Tavily（英文源）
if [ "$TAVILY_ENABLED" = "true" ]; then
  log "[Step 1b] Fetching Tavily English articles..."
  
  # 检查 TAVILY_API_KEY
  if [ -z "$TAVILY_API_KEY" ]; then
    log "[Step 1b] ⚠️ TAVILY_API_KEY not set, skipping Tavily..."
    echo "[]" > "${TAVILY_FILE}"
  else
    if node "${SCRIPT_DIR}/fetch-tavily.js" --days ${TAVILY_DAYS} --limit ${LIMIT} > "${TAVILY_FILE}" 2>> "${LOG_FILE}"; then
      TAVILY_COUNT=$(node -e "console.log(require('${TAVILY_FILE}').length)")
      log "[Step 1b] ✓ Tavily articles saved: ${TAVILY_COUNT}"
    else
      log "[Step 1b] ✗ Failed to fetch Tavily, continuing..."
      echo "[]" > "${TAVILY_FILE}"
    fi
  fi
else
  log "[Step 1b] Tavily disabled, skipping..."
  echo "[]" > "${TAVILY_FILE}"
fi

# ==========================================
# 步骤 2: 合并与去重
# ==========================================
log "[Step 2] Merging articles from all sources..."

node -e "
const fs = require('fs');
const qbitai = JSON.parse(fs.readFileSync('${QBITAI_FILE}', 'utf-8'));
const tavily = JSON.parse(fs.readFileSync('${TAVILY_FILE}', 'utf-8'));

// 合并
const merged = [...qbitai, ...tavily];

// 去重（基于 URL）
const seen = new Set();
const unique = merged.filter(a => {
  const url = a.link || a.url || '';
  if (!url || seen.has(url)) return false;
  seen.add(url);
  return true;
});

// 添加元数据
const enriched = unique.map(a => ({
  ...a,
  fetchedAt: new Date().toISOString(),
  fetchSource: a.categories?.includes('英文来源') ? 'tavily' : 'qbitai'
}));

// 按日期排序（如果有日期）
enriched.sort((a, b) => {
  const dateA = new Date(a.pubDate || a.published_date || 0);
  const dateB = new Date(b.pubDate || b.published_date || 0);
  return dateB - dateA;
});

console.log(JSON.stringify(enriched, null, 2));
" > "${ARTICLES_FILE}"

ARTICLE_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').length)")
log "[Step 2] ✓ Total unique articles: ${ARTICLE_COUNT}"

if [ "$ARTICLE_COUNT" -eq 0 ]; then
  error_exit "No articles fetched from any source"
fi

# ==========================================
# 步骤 3: 生成报告
# ==========================================
log "[Step 3] Generating ${TYPE} report..."

if node "${SCRIPT_DIR}/generate-report.js" \
  --type "${TYPE}" \
  --data "${ARTICLES_FILE}" \
  --output "${REPORT_FILE}" 2>> "${LOG_FILE}"; then
  log "[Step 3] ✓ Report saved to ${REPORT_FILE}"
else
  error_exit "Failed to generate report"
fi

# ==========================================
# 步骤 4: 发送到飞书
# ==========================================
if [ -n "${CHAT_ID}" ] || [ -n "${OPENCLAW_SESSION}" ]; then
  log "[Step 4] Sending to Feishu..."
  
  # 检查报告文件大小
  REPORT_SIZE=$(stat -c%s "${REPORT_FILE}" 2>/dev/null || echo "0")
  log "[Step 4] Report size: ${REPORT_SIZE} bytes"
  
  # 读取报告内容
  REPORT_CONTENT=$(cat "${REPORT_FILE}")
  
  # 在 OpenClaw 环境中，通过 stdout 输出供 message 工具使用
  # 在非 OpenClaw 环境中，尝试使用 HTTP API
  if [ -n "${OPENCLAW_SESSION}" ] || [ -n "${OPENCLAW_GATEWAY_URL}" ]; then
    # OpenClaw 环境 - 输出内容，由调用者处理发送
    echo "${REPORT_CONTENT}" > "${WORK_DIR}/last_report.txt"
    log "[Step 4] ✓ Report ready for OpenClaw message tool"
    log "[Step 4] Report saved to: ${WORK_DIR}/last_report.txt"
  else
    # 尝试使用 send-feishu.js（需要 FEISHU_ACCESS_TOKEN）
    if node "${SCRIPT_DIR}/send-feishu.js" \
      --chat-id "${CHAT_ID}" \
      --file "${REPORT_FILE}" 2>> "${LOG_FILE}"; then
      log "[Step 4] ✓ Sent to Feishu successfully"
    else
      log "[Step 4] ⚠️ Failed to send to Feishu via HTTP, report saved locally"
    fi
  fi
else
  log "[Step 4] Skipped (no chat_id provided)"
  log "[Step 4] Report location: ${REPORT_FILE}"
fi

# ==========================================
# 清理与归档
# ==========================================
log "[Step 5] Cleanup..."
rm -f "${QBITAI_FILE}" "${TAVILY_FILE}"

# 归档历史报告（保留最近 7 天）
if [ "$TYPE" = "daily" ]; then
  ARCHIVE_DIR="${WORK_DIR}/archive"
  mkdir -p "${ARCHIVE_DIR}"
  cp "${REPORT_FILE}" "${ARCHIVE_DIR}/report_$(date +%Y%m%d).md"
  find "${ARCHIVE_DIR}" -name "report_*.md" -mtime +7 -delete 2>/dev/null || true
fi

log "=========================================="
log "Task completed successfully!"
log "Total articles: ${ARTICLE_COUNT}"
log "Report: ${REPORT_FILE}"
log "=========================================="
