#!/bin/bash
#
# AI News Digest Pro - 飞书文档发布脚本
# 生成简报并写入飞书文档
#

set -e

# 参数
TYPE="${1:-daily}"
DATE_STR=$(date +%Y%m%d)
DATE_FMT=$(date +%Y-%m-%d)

# 文档配置
DAILY_DOC_ID="YaUpdVUAloFuRwxJczIcR8KMnvd"
WEEKLY_DOC_ID="SSxQdqy1roAPLLxMh9dcg217nqd"

# 根据类型选择文档
if [ "$TYPE" = "weekly" ]; then
  DOC_ID="$WEEKLY_DOC_ID"
  TITLE_PREFIX="周报"
else
  DOC_ID="$DAILY_DOC_ID"
  TITLE_PREFIX="日报"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Step 1: 生成简报
echo "[Publish] 正在生成 $TITLE_PREFIX..."
cd "$SKILL_DIR"
export TAVILY_API_KEY="${TAVILY_API_KEY:-}"

if ! bash "${SKILL_DIR}/scripts/run-digest.sh" "$TYPE"; then
  echo "[Publish] ✗ 简报生成失败"
  exit 1
fi

# Step 2: 获取生成的文件路径
OUTPUT_NAME="简报_${TITLE_PREFIX}_${DATE_STR}.md"
BRIEF_FILE="${SKILL_DIR}/workspace/${OUTPUT_NAME}"

if [ ! -f "$BRIEF_FILE" ]; then
  echo "[Publish] ✗ 简报文件不存在: $BRIEF_FILE"
  exit 1
fi

echo "[Publish] ✓ 简报已生成: $BRIEF_FILE"

# Step 3: 准备飞书文档内容
# 添加日期标题
HEADER="\n\n---\n\n# $DATE_FMT $TITLE_PREFIX\n\n生成时间: $(date '+%Y-%m-%d %H:%M:%S')\n\n"

# Step 4: 输出执行指令（供 cron 任务调用 feishu_doc 工具）
echo ""
echo "=== FEISHU_DOC_INSTRUCTIONS ==="
echo "DOC_ID: $DOC_ID"
echo "BRIEF_FILE: $BRIEF_FILE"
echo "TITLE: $DATE_FMT $TITLE_PREFIX"
echo "=== END_INSTRUCTIONS ==="
echo ""
echo "请使用以下指令写入飞书文档:"
echo "  feishu_doc(action='append', doc_token='$DOC_ID', content='\$BRIEF_CONTENT')"
echo ""

# 返回文件路径供后续处理
echo "$BRIEF_FILE"
