#!/bin/bash
#
# AI News Digest Pro - 主执行脚本
# 稳定、可移植的日报/周报生成系统
#

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${SCRIPT_DIR}/../workspace"
CONFIG_FILE="${SCRIPT_DIR}/../config/sources.json"

# 参数
TYPE="${1:-daily}"
DATE_STR=$(date +%Y%m%d)
DATE_FMT=$(date +%Y-%m-%d)

# 记录日志
log() {
  echo "[$(date '+%H:%M:%S')] $1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "${WORK_DIR}/run.log"
}

# 创建工作目录
mkdir -p "${WORK_DIR}"

log "=========================================="
log "AI News Digest Pro - ${TYPE}"
log "Date: ${DATE_FMT}"
log "=========================================="

# 检查依赖
if [ -z "$TAVILY_API_KEY" ]; then
  log "[WARN] TAVILY_API_KEY not set, Tavily sources will be skipped"
fi

# 设置时间范围（使用上海时区）
if [ "$TYPE" = "weekly" ]; then
  # 周报：过去7天（包含今天）
  SINCE_DATE=$(TZ=Asia/Shanghai date -d '6 days ago' '+%Y-%m-%d')
  TAVILY_DAYS=7
  LIMIT=50
  OUTPUT_NAME="简报_周报_${DATE_STR}.md"
else
  # 日报：昨天到今天
  SINCE_DATE=$(TZ=Asia/Shanghai date -d '1 day ago' '+%Y-%m-%d')
  TAVILY_DAYS=1
  LIMIT=30
  OUTPUT_NAME="简报_日报_${DATE_STR}.md"
fi

log "[Config] Since date: ${SINCE_DATE}"
log "[Config] Tavily days: ${TAVILY_DAYS}"

# 文件路径
ARTICLES_FILE="${WORK_DIR}/articles.json"
QBITAI_FILE="${WORK_DIR}/qbitai.json"
CHINESE_FILE="${WORK_DIR}/chinese.json"
TAVILY_EN_FILE="${WORK_DIR}/tavily_en.json"
TAVILY_CN_FILE="${WORK_DIR}/tavily_cn.json"
BRIEF_FILE="${WORK_DIR}/${OUTPUT_NAME}"

# 清理旧文件
rm -f "${QBITAI_FILE}" "${CHINESE_FILE}" "${TAVILY_EN_FILE}" "${TAVILY_CN_FILE}"

# ==========================================
# Step 1: 抓取量子位
# ==========================================
log "[Step 1/4] Fetching 量子位..."
if node "${SCRIPT_DIR}/fetch-qbitai.js" --since "${SINCE_DATE}" --limit ${LIMIT} > "${QBITAI_FILE}" 2>> "${WORK_DIR}/error.log"; then
  COUNT=$(node -e "console.log(require('${QBITAI_FILE}').length)")
  log "[Step 1/4] ✓ 量子位: ${COUNT} articles"
else
  log "[Step 1/4] ✗ 量子位 failed"
  echo "[]" > "${QBITAI_FILE}"
fi

# ==========================================
# Step 2: 抓取中文RSS (36氪, InfoQ等)
# ==========================================
log "[Step 2/4] Fetching 中文RSS源..."
if node "${SCRIPT_DIR}/fetch-chinese.js" --since "${SINCE_DATE}" --limit ${LIMIT} > "${CHINESE_FILE}" 2>> "${WORK_DIR}/error.log"; then
  COUNT=$(node -e "console.log(require('${CHINESE_FILE}').length)")
  log "[Step 2/4] ✓ 中文RSS: ${COUNT} articles"
else
  log "[Step 2/4] ✗ 中文RSS failed"
  echo "[]" > "${CHINESE_FILE}"
fi

# ==========================================
# Step 3: 抓取Tavily英文
# ==========================================
if [ -n "$TAVILY_API_KEY" ]; then
  log "[Step 3/4] Fetching Tavily English..."
  if node "${SCRIPT_DIR}/fetch-tavily.js" --days ${TAVILY_DAYS} --limit ${LIMIT} > "${TAVILY_EN_FILE}" 2>> "${WORK_DIR}/error.log"; then
    COUNT=$(node -e "console.log(require('${TAVILY_EN_FILE}').length)")
    log "[Step 3/4] ✓ Tavily EN: ${COUNT} articles"
  else
    log "[Step 3/4] ✗ Tavily EN failed"
    echo "[]" > "${TAVILY_EN_FILE}"
  fi
else
  log "[Step 3/4] ⏭ Tavily EN skipped (no API key)"
  echo "[]" > "${TAVILY_EN_FILE}"
fi

# ==========================================
# Step 4: 抓取Tavily中文
# ==========================================
if [ -n "$TAVILY_API_KEY" ]; then
  log "[Step 4/4] Fetching Tavily Chinese..."
  if node "${SCRIPT_DIR}/fetch-tavily-chinese.js" --days ${TAVILY_DAYS} --limit ${LIMIT} > "${TAVILY_CN_FILE}" 2>> "${WORK_DIR}/error.log"; then
    COUNT=$(node -e "console.log(require('${TAVILY_CN_FILE}').length)")
    log "[Step 4/4] ✓ Tavily CN: ${COUNT} articles"
  else
    log "[Step 4/4] ✗ Tavily CN failed"
    echo "[]" > "${TAVILY_CN_FILE}"
  fi
else
  log "[Step 4/4] ⏭ Tavily CN skipped (no API key)"
  echo "[]" > "${TAVILY_CN_FILE}"
fi

# ==========================================
# Step 5: 合并所有数据
# ==========================================
log "[Merge] Merging all sources..."

node -e "
const fs = require('fs');
const qbitai = JSON.parse(fs.readFileSync('${QBITAI_FILE}', 'utf-8'));
const chinese = JSON.parse(fs.readFileSync('${CHINESE_FILE}', 'utf-8'));
const tavilyEn = JSON.parse(fs.readFileSync('${TAVILY_EN_FILE}', 'utf-8'));
const tavilyCn = JSON.parse(fs.readFileSync('${TAVILY_CN_FILE}', 'utf-8'));

const merged = [...qbitai, ...chinese, ...tavilyEn, ...tavilyCn];

// 去重
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
  fetchedAt: new Date().toISOString()
}));

// 按日期排序
enriched.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

console.log(JSON.stringify(enriched, null, 2));
" > "${ARTICLES_FILE}"

TOTAL_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').length)")
log "[Merge] ✓ Total unique articles: ${TOTAL_COUNT}"

if [ "$TOTAL_COUNT" -eq 0 ]; then
  log "[ERROR] No articles fetched from any source"
  exit 1
fi

# 统计
QBITAI_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').filter(a=>a.categories?.includes('量子位')).length)")
CHINESE_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').filter(a=>a.categories?.includes('中文来源')&&!a.categories?.includes('量子位')).length)")
EN_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').filter(a=>a.categories?.includes('英文来源')).length)")

log "[Stats] 量子位: ${QBITAI_COUNT}, 其他中文: ${CHINESE_COUNT}, 英文: ${EN_COUNT}"

# ==========================================
# Step 6: 生成标准格式简报
# ==========================================
log "[Brief] Generating standardized brief..."

if node "${SCRIPT_DIR}/generate-brief.js" \
  --type "${TYPE}" \
  --data "${ARTICLES_FILE}" \
  --output "${BRIEF_FILE}" 2>> "${WORK_DIR}/error.log"; then
  
  BRIEF_SIZE=$(stat -c%s "${BRIEF_FILE}" 2>/dev/null || echo "0")
  log "[Brief] ✓ Brief generated: ${BRIEF_FILE} (${BRIEF_SIZE} bytes)"
else
  log "[Brief] ✗ Brief generation failed"
  exit 1
fi

# ==========================================
# Step 7: 完成
# ==========================================
log "[Done] All steps completed successfully!"
log "=========================================="

echo ""
echo "=== AI_NEWS_DIGEST_PRO_RESULT ==="
echo "STATUS: SUCCESS"
echo "TYPE: ${TYPE}"
echo "DATE: ${DATE_FMT}"
echo "TOTAL_ARTICLES: ${TOTAL_COUNT}"
echo "QBITAI: ${QBITAI_COUNT}"
echo "CHINESE: ${CHINESE_COUNT}"
echo "ENGLISH: ${EN_COUNT}"
echo "BRIEF_FILE: ${BRIEF_FILE}"
echo "=== END_RESULT ==="
echo ""
echo "下一步: 使用 message 工具发送文件"
echo "  filePath: ${BRIEF_FILE}"
echo ""

# 清理临时文件
rm -f "${QBITAI_FILE}" "${CHINESE_FILE}" "${TAVILY_EN_FILE}" "${TAVILY_CN_FILE}"
