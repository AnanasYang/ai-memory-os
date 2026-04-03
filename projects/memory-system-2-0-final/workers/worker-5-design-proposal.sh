#!/bin/bash
# Worker 5: 改进方案设计
# 任务：基于分析结果设计系统改进方案

set -e

echo "🎨 Worker 5: 设计系统改进方案..."

MEMORY_DIR="/home/bruce/.openclaw/workspace/ai-memory-system"
DESIGN_FILE="$MEMORY_DIR/Meta/design-proposal-$(date +%Y%m%d).md"

cat > "$DESIGN_FILE" << 'EOF'
---
level: Meta
category: design-proposal
created: 2026-04-03
updated: 2026-04-03
confidence: high
---

# Memory System 2.0 改进方案设计

## 🎯 设计目标

1. **可靠性**: 所有记忆数据自动备份到 GitHub
2. **自动化**: 最小化人工干预，自动流转和同步
3. **可观测**: 清晰的状态看板和监控
4. **可扩展**: 支持未来增加新的记忆类型和处理流程

## 📐 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Memory System 2.0                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   L0 State  │→ │   L1-L4     │→ │    GitHub       │ │
│  │  (Session)  │  │  (Memory)   │  │   (Backup)      │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│         ↓                ↓                  ↓          │
│  ┌───────────────────────────────────────────────────┐ │
│  │              Dreams (Daily/Weekly)                 │ │
│  └───────────────────────────────────────────────────┘ │
│                         ↓                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │              Memory OS (Web UI)                    │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 🔧 核心机制设计

### 1. L0→L1 流转 (Daily Dream)

**触发条件:**
- 每天 23:00 自动执行
- 手动触发: `make daily-dream`

**处理流程:**
```
L0 Session Data
      ↓
Pattern Detection (对话主题、情绪、关键信息)
      ↓
Memory Formation (生成结构化 L1 记忆)
      ↓
Save to Memory/L1-episodic/
      ↓
Update Meta/reviews/weekly/
      ↓
Git Commit & Push
```

### 2. L1→L2 流转 (Pattern Recognition)

**触发条件:**
- 同一模式出现 3 次
- 每周 review 时检测

**检测算法:**
```javascript
// 简单的模式检测
function detectPatterns(l1Memories) {
  const patterns = {};
  
  for (const memory of l1Memories) {
    const key = extractPatternKey(memory); // 主题/行为/偏好
    patterns[key] = (patterns[key] || 0) + 1;
    
    if (patterns[key] >= 3) {
      promoteToL2(key, memory);
    }
  }
}
```

### 3. L2→L3 流转 (Semantic Abstraction)

**触发条件:**
- 每月 review
- 多个 L2 指向同一认知框架

**处理方式:**
- 提取共同的主题/原则
- 生成抽象的认知模型
- 人工确认后写入 L3

### 4. L3→L4 流转 (Core Value Extraction)

**触发条件:**
- 每季度 review
- 人工确认（必须）

**注意:** L4 只能人工修改！

## 🔄 自动同步设计

### 方案 A: Git Hook (已实施)

```
Post-commit Hook
      ↓
Git Push to GitHub
```

**优点:** 简单，每次提交自动推送
**缺点:** 仅在有 commit 时触发

### 方案 B: Systemd Timer (已实施)

```
Timer: Every 15min
      ↓
Check for changes
      ↓
Auto-commit & Push
```

**优点:** 定期同步，不依赖手动提交
**缺点:** 需要 systemd

### 方案 C: File Watcher (备选)

```
inotify → Detect change → Debounce (30s) → Commit & Push
```

**优点:** 实时同步
**缺点:** 可能有延迟

## 📊 监控看板设计

### 状态指标

```yaml
memory_system_status:
  last_sync: 2026-04-03T10:30:00Z
  sync_status: success | pending | error
  
  layer_counts:
    l0: 5      # active sessions
    l1: 12     # episodic memories
    l2: 4      # procedural patterns
    l3: 2      # semantic frameworks
    l4: 1      # core values
  
  pending_reviews:
    weekly: 0
    monthly: 1
    quarterly: 0
  
  github_status:
    last_push: 2026-04-03T10:30:00Z
    commit_count: 156
    repo_size: 2.3MB
```

### 告警规则

1. **同步失败**: 30分钟未成功同步
2. **积压告警**: L1 超过 7 天未 review
3. **存储告警**: 单个文件超过 1MB

## 🚀 实施计划

### Phase 1: GitHub 同步 ✅
- [x] 创建 GitHub 仓库
- [x] 提交所有现有文件
- [x] 配置自动同步

### Phase 2: 流转机制
- [ ] 完善 L0→L1 捕获
- [ ] 实现 L1→L2 自动检测
- [ ] 设计 L2→L3 升级流程
- [ ] 确认 L3→L4 人工流程

### Phase 3: 监控与UI
- [ ] 状态看板 API
- [ ] Memory OS 集成
- [ ] 告警通知

### Phase 4: 测试与文档
- [ ] 端到端测试
- [ ] 文档完善
- [ ] 系统交付

## 📝 文件命名规范

### Memory ID 格式
```
L1-{date}-{sequence:03d}
例: L1-2026-04-03-001
```

### Review 文件命名
```
weekly/YYYY-W{week}.md
monthly/YYYY-MM-L2-review.md
quarterly/YYYY-Q{quarter}-L3-review.md
```

## 🔐 安全考虑

1. **GitHub Token**: 存储在本地，不上传
2. **敏感内容**: L4-Core 仅本地维护
3. **访问控制**: 仓库设置为私有
4. **备份策略**: GitHub + 本地双备份

---
*设计方案版本: v1.0*
*设计日期: 2026-04-03*
EOF

echo "✅ Worker 5 完成：设计方案已生成"
echo "📄 设计文档: $DESIGN_FILE"

# 提交设计文档
cd "$MEMORY_DIR"
git add "$DESIGN_FILE" 2>/dev/null || true
git commit -m "Add system design proposal: $(date +%Y%m%d)" 2>/dev/null || true
