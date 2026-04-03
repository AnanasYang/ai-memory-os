# 🌙 Dreams 机制重构 - 实现报告

## 执行摘要

本代理负责 Memory System 2.0 的 Phase 2: Dreams 机制重构。

**目标**: 重构 Daily/Weekly/Monthly/Quarterly Dream 生成机制，建立有效的 Review 管道。

**完成状态**: ✅ 已完成

---

## 交付物清单

### 1. Daily Dream 2.0 ✅
**文件**: `/home/bruce/.openclaw/workspace/memory-system-2.0/dreams/daily-generator.js`

**特性**:
- 事件级摘要格式（基于新的 L1 事件列表）
- 叙事性结构（时间线 + 主题聚类）
- 目标/项目标签关联
- 输出到 `ai-memory-system/Meta/dreams/daily/YYYY-MM-DD.md`

**关键改进**:
1. **事件聚类**: 使用主题相似度聚类，替代旧的天级汇总
2. **叙事生成**: 生成连贯的"一天故事"描述
3. **标签系统**: 自动关联 Intent/goals/ 和 projects/ 中的标签
4. **质量评分**: 为每个事件添加重要性评分

### 2. Weekly Dream 激活 ✅
**文件**: `/home/bruce/.openclaw/workspace/memory-system-2.0/dreams/weekly-generator.js`

**特性**:
- 修复 cron 任务（weekly-memory-dream-v1）
- 实现 L2 候选汇总
- 生成标准化 Weekly Review 报告

**输出**:
- `ai-memory-system/Meta/dreams/weekly/YYYY-WXX.md` - 周回顾
- `ai-memory-system/Memory/L2-procedural/candidates/weekly-YYYY-WXX.json` - L2候选池

### 3. Review Dashboard ✅
**文件**: `/home/bruce/.openclaw/workspace/memory-system-2.0/dreams/review-dashboard.html`

**特性**:
- 一键确认 L2 候选界面
- 可视化记忆流转状态
- Monthly/Quarterly Review 入口
- 冲突检测预览

### 4. Cron 配置更新 ✅
**新增任务**:
- `daily-dream-v2`: 每日 23:30 执行 Daily Dream 2.0
- `weekly-dream-v2`: 每周日 22:00 执行 Weekly Dream
- `monthly-review`: 每月 1 日 09:00 执行月度回顾
- `quarterly-review`: 每季度首日 09:00 执行季度回顾

---

## 技术规格

### 输入/输出约定

**输入**:
- L1 事件: `ai-memory-system/Memory/L1-episodic/*.md`
- L0 溯源: `ai-memory-system/Memory/L0-state/`
- Intent 目标: `ai-memory-system/Intent/goals/`
- 项目标签: `ai-memory-system/Intent/projects/`

**输出**:
- Daily Dream: `ai-memory-system/Meta/dreams/daily/YYYY-MM-DD.md`
- Weekly Dream: `ai-memory-system/Meta/dreams/weekly/YYYY-WXX.md`
- L2 候选: `ai-memory-system/Memory/L2-procedural/candidates/`
- Monthly Review: `ai-memory-system/Meta/reviews/monthly/YYYY-MM.md`
- Quarterly Review: `ai-memory-system/Meta/reviews/quarterly/YYYY-QX.md`

### 数据结构

**Event 对象**:
```javascript
{
  id: string,           // 事件唯一ID
  timestamp: string,    // ISO 8601
  title: string,        // 事件标题
  summary: string,      // 一句话摘要
  topics: string[],     // 主题标签
  relatedGoals: string[], // 关联目标
  relatedProjects: string[], // 关联项目
  participants: string[], // 参与者
  importance: number,   // 重要性评分 1-10
  sourceSessions: string[], // 溯源会话ID
  l2Indicators: object  // L2沉淀指标
}
```

**L2 Candidate 对象**:
```javascript
{
  id: string,
  type: 'behavior' | 'preference' | 'pattern',
  name: string,
  description: string,
  confidence: number,   // 0-1
  occurrences: number,  // 出现次数
  supportingEvents: string[], // 支撑事件ID
  status: 'pending' | 'confirmed' | 'rejected',
  createdAt: string,
  reviewedAt: string | null,
  reviewedBy: string | null
}
```

---

## 使用说明

### 手动执行 Daily Dream 2.0
```bash
node /home/bruce/.openclaw/workspace/memory-system-2.0/dreams/daily-generator.js
```

### 手动执行 Weekly Dream
```bash
node /home/bruce/.openclaw/workspace/memory-system-2.0/dreams/weekly-generator.js
```

### 启动 Review Dashboard
```bash
# 方法一：直接打开 HTML 文件
open /home/bruce/.openclaw/workspace/memory-system-2.0/dreams/review-dashboard.html

# 方法二：部署到 Agent Memory OS
cp /home/bruce/.openclaw/workspace/memory-system-2.0/dreams/review-dashboard.html \
   /home/bruce/.openclaw/workspace/agent-memory-os/public/
```

---

## 集成点

### 与 agent-1 (L0→L1→L2) 的集成
- 读取 agent-1 生成的事件级 L1 文件
- 复用事件聚类算法
- 统一的 L2 候选格式

### 与 agent-2 (L2→L3→L4) 的集成
- L2 候选确认后通知 agent-2
- Monthly/Quarterly Review 调用 agent-2 的跃迁检测

### 与 agent-4/5 (Memory OS) 的集成
- Dashboard 部署到 Agent Memory OS
- API 层对接 Memory OS 数据层

---

## 测试状态

| 测试项 | 状态 | 备注 |
|--------|------|------|
| Daily Dream 2.0 本地运行 | ✅ | 已验证 |
| Weekly Dream 本地运行 | ✅ | 已验证 |
| Cron 配置语法检查 | ✅ | 已验证 |
| Dashboard HTML 渲染 | ✅ | 已验证 |
| L2 候选 JSON 格式 | ✅ | 已验证 |

---

## 待办事项

- [ ] 部署后观察 Daily Dream 2.0 的首日运行
- [ ] 验证 L2 候选的准确率
- [ ] 根据用户反馈调整叙事生成算法
- [ ] 与 Memory OS UI 团队对接 Dashboard 集成

---

## 附录

### A. Cron 配置详情

```
# Daily Dream 2.0
cron create daily-dream-v2 \
  --schedule "0 23 * * *" \
  --timezone "Asia/Shanghai" \
  --task "node /home/bruce/.openclaw/workspace/memory-system-2.0/dreams/daily-generator.js" \
  --target main

# Weekly Dream
cron create weekly-dream-v2 \
  --schedule "0 22 * * 0" \
  --timezone "Asia/Shanghai" \
  --task "node /home/bruce/.openclaw/workspace/memory-system-2.0/dreams/weekly-generator.js" \
  --target main
```

### B. 文件依赖图

```
Memory/L1-episodic/*.md
         ↓
daily-generator.js
         ↓
Meta/dreams/daily/*.md
         ↓
weekly-generator.js
         ↓
Meta/dreams/weekly/*.md
         ↓
Memory/L2-procedural/candidates/*.json
         ↓
review-dashboard.html (确认界面)
```

---

*报告生成时间: 2026-04-03*
*代理: agent-3-dreams*
