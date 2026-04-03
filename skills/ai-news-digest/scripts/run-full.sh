#!/bin/bash
#
# AI 日报/周报 - 完整版（多中文源）
# 整合：量子位 + 36氪 + InfoQ + Tavily中英文 + 更多中文源
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${SCRIPT_DIR}/../workspace"
LOG_FILE="${WORK_DIR}/cron.log"
CONFIG_FILE="${SCRIPT_DIR}/../references/config.json"

TYPE="${1:-daily}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "${LOG_FILE}"
}

# 读取配置
QBITAI_ENABLED=$(node -e "try { const c=require('${CONFIG_FILE}'); console.log(c.sources.qbitai.enabled||false) } catch { console.log('false') }")
CHINESE_ENABLED=$(node -e "try { const c=require('${CONFIG_FILE}'); console.log(c.sources.chinese?.enabled||true) } catch { console.log('true') }")
TAVILY_ENABLED=$(node -e "try { const c=require('${CONFIG_FILE}'); console.log(c.sources.tavily?.enabled||true) } catch { console.log('true') }")

mkdir -p "${WORK_DIR}"

log "=========================================="
log "AI News Digest Full - ${TYPE}"
log "Sources - QbitAI: ${QBITAI_ENABLED}, Chinese: ${CHINESE_ENABLED}, Tavily: ${TAVILY_ENABLED}"

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

# 数据文件
ARTICLES_FILE="${WORK_DIR}/articles.json"
QBITAI_FILE="${WORK_DIR}/articles_qbitai.json"
CHINESE_FILE="${WORK_DIR}/articles_chinese.json"
TAVILY_EN_FILE="${WORK_DIR}/articles_tavily_en.json"
TAVILY_CN_FILE="${WORK_DIR}/articles_tavily_cn.json"

rm -f "${QBITAI_FILE}" "${CHINESE_FILE}" "${TAVILY_EN_FILE}" "${TAVILY_CN_FILE}"

# ==========================================
# 数据源 1: 量子位
# ==========================================
if [ "$QBITAI_ENABLED" = "true" ]; then
  log "[Source 1/4] Fetching 量子位..."
  if node "${SCRIPT_DIR}/fetch-qbitai.js" --since "${SINCE_DATE}" --limit ${LIMIT} > "${QBITAI_FILE}" 2>> "${LOG_FILE}"; then
    COUNT=$(node -e "console.log(require('${QBITAI_FILE}').length)")
    log "[Source 1/4] ✓ 量子位: ${COUNT} articles"
  else
    log "[Source 1/4] ✗ 量子位 failed"
    echo "[]" > "${QBITAI_FILE}"
  fi
else
  echo "[]" > "${QBITAI_FILE}"
fi

# ==========================================
# 数据源 2: 其他中文 RSS (36氪, InfoQ等)
# ==========================================
if [ "$CHINESE_ENABLED" = "true" ]; then
  log "[Source 2/4] Fetching 中文 RSS 源..."
  if node "${SCRIPT_DIR}/fetch-chinese.js" --limit ${LIMIT} > "${CHINESE_FILE}" 2>> "${LOG_FILE}"; then
    COUNT=$(node -e "console.log(require('${CHINESE_FILE}').length)")
    log "[Source 2/4] ✓ 中文 RSS: ${COUNT} articles"
  else
    log "[Source 2/4] ✗ 中文 RSS failed"
    echo "[]" > "${CHINESE_FILE}"
  fi
else
  echo "[]" > "${CHINESE_FILE}"
fi

# ==========================================
# 数据源 3: Tavily 英文
# ==========================================
if [ "$TAVILY_ENABLED" = "true" ] && [ -n "$TAVILY_API_KEY" ]; then
  log "[Source 3/4] Fetching Tavily English..."
  if node "${SCRIPT_DIR}/fetch-tavily.js" --days ${TAVILY_DAYS} --limit ${LIMIT} > "${TAVILY_EN_FILE}" 2>> "${LOG_FILE}"; then
    COUNT=$(node -e "console.log(require('${TAVILY_EN_FILE}').length)")
    log "[Source 3/4] ✓ Tavily EN: ${COUNT} articles"
  else
    log "[Source 3/4] ✗ Tavily EN failed"
    echo "[]" > "${TAVILY_EN_FILE}"
  fi
else
  echo "[]" > "${TAVILY_EN_FILE}"
fi

# ==========================================
# 数据源 4: Tavily 中文搜索
# ==========================================
if [ "$TAVILY_ENABLED" = "true" ] && [ -n "$TAVILY_API_KEY" ]; then
  log "[Source 4/4] Fetching Tavily Chinese..."
  if node "${SCRIPT_DIR}/fetch-tavily-chinese.js" --days ${TAVILY_DAYS} --limit ${LIMIT} > "${TAVILY_CN_FILE}" 2>> "${LOG_FILE}"; then
    COUNT=$(node -e "console.log(require('${TAVILY_CN_FILE}').length)")
    log "[Source 4/4] ✓ Tavily CN: ${COUNT} articles"
  else
    log "[Source 4/4] ✗ Tavily CN failed"
    echo "[]" > "${TAVILY_CN_FILE}"
  fi
else
  echo "[]" > "${TAVILY_CN_FILE}"
fi

# ==========================================
# 合并所有数据源
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

// 排序
enriched.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

console.log(JSON.stringify(enriched, null, 2));
" > "${ARTICLES_FILE}"

TOTAL_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').length)")
log "[Merge] ✓ Total unique articles: ${TOTAL_COUNT}"

# 统计各来源
QBITAI_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').filter(a=> a.categories?.includes('量子位')).length)")
CHINESE_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').filter(a=> a.categories?.includes('中文来源')&&!a.categories?.includes('量子位')).length)")
EN_COUNT=$(node -e "console.log(require('${ARTICLES_FILE}').filter(a=> a.categories?.includes('英文来源')).length)")

log "[Stats] 量子位: ${QBITAI_COUNT}, 其他中文: ${CHINESE_COUNT}, 英文: ${EN_COUNT}"

if [ "$TOTAL_COUNT" -eq 0 ]; then
  log "[ERROR] No articles fetched"
  exit 1
fi

# ==========================================
# 生成报告
# ==========================================
REPORT_FILE="${WORK_DIR}/report.md"

log "[Report] Generating ${TYPE} report..."
if node "${SCRIPT_DIR}/generate-report.js" \
  --type "${TYPE}" \
  --data "${ARTICLES_FILE}" \
  --output "${REPORT_FILE}" 2>> "${LOG_FILE}"; then
  log "[Report] ✓ Report generated"
else
  log "[Report] ✗ Report generation failed"
  exit 1
fi

# 复制到带日期的文件
if [ "$TYPE" = "weekly" ]; then
  OUTPUT_FILE="${WORK_DIR}/AI周报_$(date +%Y%m%d).md"
else
  OUTPUT_FILE="${WORK_DIR}/AI日报_$(date +%Y%m%d).md"
fi
cp "${REPORT_FILE}" "${OUTPUT_FILE}"

# 输出结果
log "[Done] Completed successfully"
log "=========================================="

echo ""
echo "=== AI_NEWS_DIGEST_RESULT ==="
echo "STATUS: SUCCESS"
echo "TYPE: ${TYPE}"
echo "TOTAL_ARTICLES: ${TOTAL_COUNT}"
echo "QBITAI: ${QBITAI_COUNT}"
echo "CHINESE: ${CHINESE_COUNT}"
echo "ENGLISH: ${EN_COUNT}"
echo "OUTPUT_FILE: ${OUTPUT_FILE}"
echo "DATE: $(date +%Y-%m-%d)"
echo "=== END_RESULT ==="
echo ""
echo "使用 message 工具发送文件:"
echo "  filePath: ${OUTPUT_FILE}"
echo ""

# 清理临时文件
rm -f "${QBITAI_FILE}" "${CHINESE_FILE}" "${TAVILY_EN_FILE}" "${TAVILY_CN_FILE}"
