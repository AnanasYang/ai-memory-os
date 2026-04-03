#!/bin/bash
#
# AI 日报/周报 - OpenClaw 专用版
# 生成报告并创建飞书云文档
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${SCRIPT_DIR}/../workspace"
LOG_FILE="${WORK_DIR}/cron.log"
CONFIG_FILE="${SCRIPT_DIR}/../references/config.json"

# 读取参数
TYPE="${1:-daily}"

# 记录日志
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "${LOG_FILE}"
}

# 读取配置
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

mkdir -p "${WORK_DIR}"

log "=========================================="
log "AI News Digest - ${TYPE}"
log "Sources - QbitAI: ${QBITAI_ENABLED}, Tavily: ${TAVILY_ENABLED}"

# 计算日期
if [ "$TYPE" = "weekly" ]; then
  SINCE_DATE=$(date -d '7 days ago' '+%Y-%m-%d')
  TAVILY_DAYS=7
  LIMIT=50
else
  SINCE_DATE=$(date -d '1 day ago' '+%Y-%m-%d')
  TAVILY_DAYS=1
  LIMIT=30
fi

# 文件路径
ARTICLES_FILE="${WORK_DIR}/articles.json"
QBITAI_FILE="${WORK_DIR}/articles_qbitai.json"
TAVILY_FILE="${WORK_DIR}/articles_tavily.json"
REPORT_FILE="${WORK_DIR}/report.md"

rm -f "${QBITAI_FILE}" "${TAVILY_FILE}"

# 步骤 1: 抓取数据
if [ "$QBITAI_ENABLED" = "true" ]; then
  log "[1a] Fetching QbitAI..."
  if node "${SCRIPT_DIR}/fetch-qbitai.js" --since "${SINCE_DATE}" --limit ${LIMIT} > "${QBITAI_FILE}" 2>> "${LOG_FILE}"; then
    QBITAI_COUNT=$(node -e "console.log(require('${QBITAI_FILE}').length)")
    log "[1a] QbitAI: ${QBITAI_COUNT} articles"
  else
    echo "[]" > "${QBITAI_FILE}"
  fi
else
  echo "[]" > "${QBITAI_FILE}"
fi

if [ "$TAVILY_ENABLED" = "true" ]; then
  log "[1b] Fetching Tavily..."
  if [ -z "$TAVILY_API_KEY" ]; then
    echo "[]" > "${TAVILY_FILE}"
  else
    if node "${SCRIPT_DIR}/fetch-tavily.js" --days ${TAVILY_DAYS} --limit ${LIMIT} > "${TAVILY_FILE}" 2>> "${LOG_FILE}"; then
      TAVILY_COUNT=$(node -e "console.log(require('${TAVILY_FILE}').length)")
      log "[1b] Tavily: ${TAVILY_COUNT} articles"
    else
      echo "[]" > "${TAVILY_FILE}"
    fi
  fi
else
  echo "[]" > "${TAVILY_FILE}"
fi

# 步骤 2: 合并
log "[2] Merging..."
node -e "
const fs = require('fs');
const qbitai = JSON.parse(fs.readFileSync('${QBITAI_FILE}', 'utf-8'));
const tavily = JSON.parse(fs.readFileSync('${TAVILY_FILE}', 'utf-8'));
const merged = [...qbitai, ...tavily];
const seen = new Set();
const unique = merged.filter(a => {
  const url = a.link || a.url || '';
  if (!url || seen.has(url)) return false;
  seen.add(url);
  return true;
});
unique.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
console.log(JSON.stringify(unique, null, 2));
" > "${ARTICLES_FILE}"

ARTICLE_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').length)")
log "[2] Total unique: ${ARTICLE_COUNT}"

if [ "$ARTICLE_COUNT" -eq 0 ]; then
  log "[ERROR] No articles"
  exit 1
fi

# 步骤 3: 生成报告
log "[3] Generating report..."
if node "${SCRIPT_DIR}/generate-report.js" \
  --type "${TYPE}" \
  --data "${ARTICLES_FILE}" \
  --output "${REPORT_FILE}" 2>> "${LOG_FILE}"; then
  log "[3] Report generated"
else
  log "[3] Report generation failed"
  exit 1
fi

# 步骤 4: 准备输出文件
if [ "$TYPE" = "weekly" ]; then
  OUTPUT_FILE="${WORK_DIR}/AI周报_$(date +%Y%m%d).md"
else
  OUTPUT_FILE="${WORK_DIR}/AI日报_$(date +%Y%m%d).md"
fi
cp "${REPORT_FILE}" "${OUTPUT_FILE}"

# 步骤 5: 输出结果
log "[4] Completed"
log "=========================================="

echo ""
echo "=== AI_NEWS_DIGEST_RESULT ==="
echo "STATUS: SUCCESS"
echo "TYPE: ${TYPE}"
echo "ARTICLES: ${ARTICLE_COUNT}"
echo "REPORT_FILE: ${REPORT_FILE}"
echo "OUTPUT_FILE: ${OUTPUT_FILE}"
echo "DATE: $(date +%Y-%m-%d)"
echo "=== END_RESULT ==="
echo ""
echo "下一步: 使用 message 工具发送文件"
echo "  filePath: ${OUTPUT_FILE}"
echo ""

# 清理
rm -f "${QBITAI_FILE}" "${TAVILY_FILE}"
