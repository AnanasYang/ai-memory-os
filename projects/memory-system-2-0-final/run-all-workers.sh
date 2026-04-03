#!/bin/bash
# Master execution script for Memory System 2.0 Final
# 按依赖顺序执行所有 Worker

set -e

PROJECT_DIR="/home/bruce/.openclaw/workspace/projects/memory-system-2-0-final"
WORKERS_DIR="$PROJECT_DIR/workers"
MEMORY_DIR="/home/bruce/.openclaw/workspace/ai-memory-system"

echo "═══════════════════════════════════════════════════════════════"
echo "     Memory System 2.0 完整重构 - Master 执行脚本"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 执行函数
execute_worker() {
    local worker=$1
    local name=$2
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  🚀 执行 $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if bash "$WORKERS_DIR/$worker"; then
        echo "✅ $name 完成"
        return 0
    else
        echo "❌ $name 失败"
        return 1
    fi
}

# Phase 1: GitHub 仓库准备 (并行)
echo ""
echo "📦 Phase 1: GitHub 仓库准备"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

execute_worker "worker-1-github-repo.sh" "Worker 1: GitHub 仓库创建"
execute_worker "worker-2-git-commit.sh" "Worker 2: 记忆文件整理提交"
execute_worker "worker-3-auto-sync.sh" "Worker 3: 自动同步脚本设置"

# Phase 2: 重新分析 (串行)
echo ""
echo "📊 Phase 2: 重新分析"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

execute_worker "worker-4-system-analysis.sh" "Worker 4: 系统状态分析"
execute_worker "worker-5-design-proposal.sh" "Worker 5: 改进方案设计"

# Phase 3: 系统实现
echo ""
echo "⚙️ Phase 3: 系统实现"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

execute_worker "worker-6-core-mechanisms.sh" "Worker 6: L0-L4 核心机制"
execute_worker "worker-7-dreams-system.sh" "Worker 7: Dreams 系统"
execute_worker "worker-8-memory-os.sh" "Worker 8: Memory OS"

# Phase 4: 测试与部署
echo ""
echo "🧪 Phase 4: 测试与部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

execute_worker "worker-9-end-to-end-test.sh" "Worker 9: 端到端测试"
execute_worker "worker-10-deploy.sh" "Worker 10: 部署与文档"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "     🎉 Memory System 2.0 完整重构完成！"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 项目产出："
echo "  • GitHub 仓库: https://github.com/AnanasYang/ai-memory-system"
echo "  • 项目报告: $PROJECT_DIR/COMPLETION-REPORT.md"
echo "  • 系统文档: $MEMORY_DIR/SYSTEM.md"
echo ""
echo "🚀 快速开始："
echo "  cd $MEMORY_DIR && make status"
echo ""
