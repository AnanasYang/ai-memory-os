# AI News Digest - 生产环境部署指南

## 架构概述

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI News Digest System                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Data Sources │  │  Processing  │  │     Delivery         │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤  │
│  │ • QbitAI     │  │ • Merge      │  │ • Feishu (Primary)  │  │
│  │ • Tavily     │  │ • Deduplicate│  │ • Fallback Chain    │  │
│  │ • Browser*   │  │ • Categorize │  │ • Error Notification│  │
│  │ • Summarize* │  │ • Generate   │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Cron Scheduler  │
                    │  (OpenClaw Cron)  │
                    └───────────────────┘
```

*可选增强功能

---

## 与现有 Cron 任务的整合

当前已有 2 个 AI 追踪任务运行中：

| 任务 | 时间 | 类型 | 建议 |
|------|------|------|------|
| Bruce每日AI前沿追踪 | 10:00 daily | isolated agentTurn | **保留** - 使用 LLM 智能搜索 |
| Bruce每周AI前沿总结 | 10:00 Sun | isolated agentTurn | **保留** - 深度分析总结 |

**建议方案**：让现有任务和 ai-news-digest skill **并行运行**，互相补充

### 分工建议

| 维度 | 现有 Cron 任务 | ai-news-digest skill |
|------|---------------|---------------------|
| **信息源** | LLM 主动搜索 | RSS + Tavily API |
| **内容深度** | 深度分析 + 洞察 | 结构化汇总 + 分类 |
| **格式** | 简报形式 | 分层报告 (核心/近/外延) |
| **稳定性** | 依赖 LLM 可用性 | 结构化数据，更稳定 |
| **用途** | 深度洞察 | 信息覆盖 + 归档 |

---

## 部署步骤

### 1. 环境配置

```bash
# 设置环境变量
export TAVILY_API_KEY="tvly-dev-..."
export FEISHU_CHAT_ID="oc_..."

# 添加到 ~/.bashrc 或 ~/.zshrc
echo 'export TAVILY_API_KEY="your_key"' >> ~/.bashrc
echo 'export FEISHU_CHAT_ID="your_chat_id"' >> ~/.bashrc
```

### 2. 安装依赖

```bash
cd /home/bruce/.openclaw/workspace/skills/ai-news-digest
npm install xml2js
```

### 3. 配置 Cron 任务

**方案 A：使用 OpenClaw Cron（推荐）**

```bash
# 添加日报任务
openclaw cron add \
  --name "ai-news-digest-daily" \
  --schedule "0 9 * * *" \
  --command "/home/bruce/.openclaw/workspace/skills/ai-news-digest/scripts/run-digest-v2.sh daily $FEISHU_CHAT_ID" \
  --session-target isolated

# 添加周报任务
openclaw cron add \
  --name "ai-news-digest-weekly" \
  --schedule "0 9 * * 0" \
  --command "/home/bruce/.openclaw/workspace/skills/ai-news-digest/scripts/run-digest-v2.sh weekly $FEISHU_CHAT_ID" \
  --session-target isolated
```

**方案 B：使用系统 Crontab**

```bash
# 编辑 crontab
crontab -e

# 添加以下行
# AI News Digest - Daily at 9:00 AM
0 9 * * * cd /home/bruce/.openclaw/workspace/skills/ai-news-digest && ./scripts/run-digest-v2.sh daily $FEISHU_CHAT_ID >> workspace/cron.log 2>&1

# AI News Digest - Weekly at 9:00 AM on Sunday
0 9 * * 0 cd /home/bruce/.openclaw/workspace/skills/ai-news-digest && ./scripts/run-digest-v2.sh weekly $FEISHU_CHAT_ID >> workspace/cron.log 2>&1
```

---

## 监控与告警

### 日志查看

```bash
# 实时查看日志
tail -f /home/bruce/.openclaw/workspace/skills/ai-news-digest/workspace/cron.log

# 查看最近运行状态
openclaw cron list
```

### 健康检查

```bash
# 手动测试运行
./scripts/run-digest-v2.sh daily $FEISHU_CHAT_ID

# 检查文章抓取
node scripts/fetch-qbitai.js --since 2026-03-10 --limit 5 | jq '. | length'
node scripts/fetch-tavily.js --days 1 --limit 5 | jq '. | length'
```

---

## 故障排查

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 文章数为 0 | RSS/API 不可用 | 检查网络连接，查看日志 |
| 发送失败 | FEISHU_CHAT_ID 错误 | 验证 chat_id 正确性 |
| Tavily 失败 | API Key 无效 | 检查 TAVILY_API_KEY |
| 报告格式错乱 | 编码问题 | 确保使用 UTF-8 |

### 错误通知

脚本已内置错误通知机制：
- 运行失败时自动发送飞书消息
- 包含错误类型和时间戳
- 指向日志文件位置

---

## 扩展功能（可选）

### 1. 使用 agent-browser 抓取 JS 网站

针对机器之心等 React 渲染的网站：

```javascript
// 示例：抓取机器之心
const browser = require('../../agent-browser/scripts/browser.js');
await browser.navigate('https://www.jiqizhixin.com');
const content = await browser.extract();
```

### 2. 使用 summarize 总结长文

```bash
# 在 fetch 后总结内容
summarize "https://example.com/article" --model google/gemini-3-flash-preview
```

### 3. 使用 proactive-agent 模式

- 在报告前主动检查数据源可用性
- 预测可能的失败并提前通知
- 自动重试机制

---

## 数据流

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   QbitAI    │────▶│             │     │             │
│   (RSS)     │     │   Merge &   │     │   Generate  │
└─────────────┘     │  Deduplicate│────▶│    Report   │────▶ Feishu
┌─────────────┐     │             │     │             │
│   Tavily    │────▶│             │     │             │
│   (API)     │     │  Enrich     │     │  Categorize │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │   Archive   │
                    │ (7 days)    │
                    └─────────────┘
```

---

## 性能指标

| 指标 | 目标 | 备注 |
|------|------|------|
| 每日文章数 | 15-30 | 中文+英文 |
| 运行时间 | < 2 min | 完整流程 |
| 成功率 | > 95% | 包括降级方案 |
| 报告大小 | < 50KB | 飞书限制 |

---

## 更新维护

### 定期检查清单

- [ ] 每周检查日志，确认无错误
- [ ] 每月检查数据源可用性
- [ ] 每季度评估是否需要新增数据源
- [ ] 每年审查报告格式和内容相关性

### 备份

```bash
# 备份配置
cp references/config.json references/config.json.backup

# 备份历史报告
tar -czf archive/reports-$(date +%Y%m).tar.gz workspace/archive/
```
