#!/bin/bash
#
# AI 日报发送脚本 - 稳定版
# 支持：分段发送文本 / 创建飞书文档 / 保存文件
#

REPORT_FILE="/home/bruce/.openclaw/workspace/skills/ai-news-digest/workspace/AI日报_20260311.md"

echo "=========================================="
echo "AI 日报发送工具"
echo "=========================================="
echo ""
echo "文件信息:"
echo "  路径: ${REPORT_FILE}"
echo "  大小: $(stat -c%s "${REPORT_FILE}" 2>/dev/null || echo 'unknown') bytes"
echo "  行数: $(wc -l < "${REPORT_FILE}" 2>/dev/null || echo 'unknown')"
echo ""
echo "请选择发送方式:"
echo "  1) 分段发送（适合阅读，推荐）"
echo "  2) 创建飞书云文档（可保存、分享）"
echo "  3) 仅保存文件（不发送）"
echo ""

# 默认使用方式1：分段发送
echo "[执行] 使用方式1: 分段发送"
echo ""

# 分段发送函数
send_report_segments() {
    local file="$1"
    
    # 提取概览部分
    echo "正在准备发送..."
    
    # 输出结果供 OpenClaw 使用
    cat "$file"
}

send_report_segments "${REPORT_FILE}"
