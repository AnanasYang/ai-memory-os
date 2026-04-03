#!/bin/bash
# Worker 2: 记忆文件整理提交
# 任务：整理并提交所有记忆文件到 GitHub

set -e

echo "📁 Worker 2: 整理并提交记忆文件..."

cd /home/bruce/.openclaw/workspace/ai-memory-system

# 创建 .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.next/
dist/

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Large files
*.tgz
*.zip

# Temporary
*.tmp
*.temp
EOF

echo "📝 创建 .gitignore"

# 创建 README 如果不存在或更新
if [ ! -f README.md ]; then
  cat > README.md << 'EOF'
# AI Memory System

基于 5 层记忆架构 + Intent 轨道 + Meta 元数据的用户画像系统。

## 目录结构

```
ai-memory-system/
├── Memory/                   # 被动沉淀轨道（从对话自动提炼）
│   ├── L0-state/            # 状态层：当前会话上下文
│   ├── L1-episodic/         # 情境层：近期对话摘要（每周review）
│   ├── L2-procedural/       # 行为层：习惯与偏好（每月review）
│   ├── L3-semantic/         # 认知层：思维模式（每季度review）
│   └── L4-core/             # 核心层：价值观与身份（每年/人工）
├── Intent/                   # 主动输入轨道（用户主动设定）
│   ├── goals/               # 目标与规划
│   ├── preferences/         # 偏好与要求
│   └── boundaries/          # 约束与边界
├── Meta/                     # 系统元数据
│   ├── reviews/             # 复盘记录
│   ├── evolutions/          # 演变历史
│   └── insights/            # AI 检测到的模式
└── scripts/                  # 自动化脚本
    ├── daily-dream.mjs      # 每日梦境生成
    └── weekly-dream.mjs     # 每周复盘生成
```

## 使用说明

1. **L0 状态层**: 实时捕获当前会话上下文
2. **L1 情境层**: 每日自动总结，每周 review
3. **L2 行为层**: 识别重复模式，每月 review
4. **L3 认知层**: 提炼思维框架，每季度 review
5. **L4 核心层**: 核心价值观，仅人工修改

## 自动化

- Daily Dream: 每天自动生成 L1 记忆
- Weekly Dream: 每周自动生成复盘
- Git Sync: 自动同步到 GitHub

---

*System initialized: 2026-03-05*
*Last updated: 2026-04-03*
EOF
fi

# 添加所有文件
echo "➕ 添加文件到 git..."
git add -A

# 检查是否有变更需要提交
if git diff --cached --quiet; then
  echo "ℹ️ 没有变更需要提交"
else
  echo "💾 提交变更..."
  git config user.email "bruce@ai-memory.system"
  git config user.name "Bruce's AI Memory System"
  git commit -m "Initial commit: Memory System 2.0 structure

- Add 5-layer memory architecture
- Add Intent track
- Add Meta metadata
- Add automation scripts
- Configure GitHub sync"
fi

# 推送到 GitHub
echo "🚀 推送到 GitHub..."
git branch -M master
git push -u origin master --force || echo "⚠️ 推送可能需要手动处理"

echo "✅ Worker 2 完成：文件已提交到 GitHub"
