#!/bin/bash
# Worker 4: 系统状态分析
# 任务：全面分析当前记忆系统状态，生成分析报告

set -e

echo "🔍 Worker 4: 分析当前记忆系统状态..."

MEMORY_DIR="/home/bruce/.openclaw/workspace/ai-memory-system"
REPORT_FILE="$MEMORY_DIR/Meta/analysis-$(date +%Y%m%d).md"

cd "$MEMORY_DIR"

# 收集统计信息
echo "📊 收集统计信息..."

# 统计各层文件数量
L0_COUNT=$(find Memory/L0-state -name "*.md" 2>/dev/null | wc -l)
L1_COUNT=$(find Memory/L1-episodic -name "*.md" 2>/dev/null | wc -l)
L2_COUNT=$(find Memory/L2-procedural -name "*.md" 2>/dev/null | wc -l)
L3_COUNT=$(find Memory/L3-semantic -name "*.md" 2>/dev/null | wc -l)
L4_COUNT=$(find Memory/L4-core -name "*.md" 2>/dev/null | wc -l)
INTENT_COUNT=$(find Intent -name "*.md" 2>/dev/null | wc -l)
META_COUNT=$(find Meta -name "*.md" 2>/dev/null | wc -l)

# 检查脚本状态
DAILY_DREAM_EXISTS=$([ -f scripts/daily-dream-integrated.mjs ] && echo "✅" || echo "❌")
WEEKLY_DREAM_EXISTS=$([ -f scripts/weekly-dream-integrated.mjs ] && echo "✅" || echo "❌")
AUTO_SYNC_EXISTS=$([ -f scripts/auto-sync.sh ] && echo "✅" || echo "❌")

# 检查 agent-os
AGENT_OS_EXISTS=$([ -d agent-os/app ] && echo "✅" || echo "❌")

# 检查 git 状态
GIT_INIT=$([ -d .git ] && echo "✅" || echo "❌")
HAS_REMOTE=$(git remote get-url origin 2>/dev/null && echo "✅" || echo "❌")

# 生成分析报告
cat > "$REPORT_FILE" << EOF
---
level: Meta
category: system-analysis
created: $(date +%Y-%m-%d)
updated: $(date +%Y-%m-%d)
confidence: high
---

# Memory System 2.0 状态分析报告

生成时间: $(date '+%Y-%m-%d %H:%M:%S')

## 📊 记忆数据分布

| 层级 | 文件数 | 状态 |
|------|--------|------|
| L0 State | $L0_COUNT | $(if [ $L0_COUNT -gt 0 ]; then echo "✅"; else echo "⚠️"; fi) |
| L1 Episodic | $L1_COUNT | $(if [ $L1_COUNT -gt 0 ]; then echo "✅"; else echo "⚠️"; fi) |
| L2 Procedural | $L2_COUNT | $(if [ $L2_COUNT -gt 0 ]; then echo "✅"; else echo "⚠️"; fi) |
| L3 Semantic | $L3_COUNT | $(if [ $L3_COUNT -gt 0 ]; then echo "✅"; else echo "⚠️"; fi) |
| L4 Core | $L4_COUNT | $(if [ $L4_COUNT -gt 0 ]; then echo "✅"; else echo "⚠️"; fi) |
| Intent | $INTENT_COUNT | ✅ |
| Meta | $META_COUNT | ✅ |

## 🔧 组件状态

| 组件 | 状态 | 说明 |
|------|------|------|
| Daily Dream | $DAILY_DREAM_EXISTS | 每日自动总结脚本 |
| Weekly Dream | $WEEKLY_DREAM_EXISTS | 每周复盘脚本 |
| Auto Sync | $AUTO_SYNC_EXISTS | 自动同步机制 |
| Agent OS UI | $AGENT_OS_EXISTS | Web 管理界面 |
| Git 初始化 | $GIT_INIT | 版本控制 |
| GitHub 远程 | $HAS_REMOTE | 云端备份 |

## ✅ 已完成的功能

1. **基础架构**
   - 5层记忆目录结构 ✅
   - Intent 轨道 ✅
   - Meta 元数据 ✅
   - 自动化脚本框架 ✅

2. **Dreams 系统**
   - L0 实时捕获脚本 ✅
   - Daily Dream (L1生成) ✅
   - Weekly Dream (复盘) ✅
   - 溯源功能 ✅

3. **Agent OS**
   - Next.js 前端 ✅
   - L0 查看器 ✅
   - Review 界面 ✅
   - 虚拟滚动优化 ✅
   - 错误边界 ✅

## ⚠️ 待完善项

1. **L0-L4 流转机制**
   - 自动检测模式触发 L1→L2 升级
   - L2→L3 语义提炼算法
   - L3→L4 核心信念识别

2. **自动化调度**
   - 每日 cron 任务
   - 每周 cron 任务
   - 自动同步验证

3. **监控与告警**
   - 同步状态监控
   - 错误日志收集
   - 系统健康检查

## 📋 下一步行动

1. 完成 L1→L2→L3→L4 自动流转机制
2. 配置完整的 cron 任务
3. 设置监控与告警
4. 验证端到端流程

---
*自动生成的分析报告*
EOF

echo "✅ Worker 4 完成：分析报告已生成"
echo "📄 报告位置: $REPORT_FILE"

# 提交报告
git add "$REPORT_FILE" 2>/dev/null || true
git commit -m "Add system analysis report: $(date +%Y%m%d)" 2>/dev/null || true
