# OpenClaw Cron 配置 - 文件发送版

## 文件发送方式

使用 `message` 工具的 `filePath` 参数发送文件：

```javascript
message({
  action: "send",
  filePath: "/home/bruce/.openclaw/workspace/skills/ai-news-digest/workspace/AI日报_20260311.md",
  message: "📄 AI日报 2026-03-11"
})
```

详见 [references/file-sending.md](references/file-sending.md)

## Cron 任务配置

### 日报任务（每天 9:00）

```bash
openclaw cron add \
  --name "ai-news-digest-daily" \
  --schedule "0 9 * * *" \
  --session-target isolated \
  --payload '{
    "kind": "agentTurn",
    "message": "执行 AI News Digest 日报：1) cd /home/bruce/.openclaw/workspace/skills/ai-news-digest && export TAVILY_API_KEY=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 && ./scripts/run-openclaw.sh daily; 2) 使用 message 工具发送文件，filePath 为 workspace/AI日报_*.md",
    "model": "kimi-coding/k2p5",
    "thinking": "low"
  }' \
  --delivery '{"mode":"announce","channel":"feishu","to":"ou_a997dd39e688226bfd2f1ccfc0d1e3f2"}'
```

### 周报任务（每周日 9:00）

```bash
openclaw cron add \
  --name "ai-news-digest-weekly" \
  --schedule "0 9 * * 0" \
  --session-target isolated \
  --payload '{
    "kind": "agentTurn",
    "message": "执行 AI News Digest 周报：1) cd /home/bruce/.openclaw/workspace/skills/ai-news-digest && export TAVILY_API_KEY=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 && ./scripts/run-openclaw.sh weekly; 2) 使用 message 工具发送文件，filePath 为 workspace/AI周报_*.md",
    "model": "kimi-coding/k2p5",
    "thinking": "low"
  }' \
  --delivery '{"mode":"announce","channel":"feishu","to":"ou_a997dd39e688226bfd2f1ccfc0d1e3f2"}'
```

## 输出文件格式

生成的 markdown 文件：
- 日报：`workspace/AI日报_YYYYMMDD.md`
- 周报：`workspace/AI周报_YYYYMMDD.md`

文件包含：
- 今日/本周概览（文章数量、来源）
- 核心层（可直接落地的技术）
- 近层（行业前沿）
- 外延层（拓展视野）
- 分析与建议

## 手动执行测试

```bash
cd /home/bruce/.openclaw/workspace/skills/ai-news-digest
export TAVILY_API_KEY="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"
./scripts/run-openclaw.sh daily

# 查看生成的文件
ls -la workspace/AI日报_*.md
```

## 与现有任务整合

| 时间 | 任务 | 类型 | 内容 |
|------|------|------|------|
| 9:00 | ai-news-digest | 结构化报告（文件） | RSS + Tavily 数据聚合 |
| 10:00 | Bruce每日AI前沿追踪 | LLM 智能搜索 | 深度分析简报 |

## 管理命令

```bash
# 列出所有 cron 任务
openclaw cron list

# 手动触发测试
openclaw cron run --job-id <job-id> --mode force

# 删除任务
openclaw cron remove --job-id <job-id>
```

## 环境变量配置

```bash
export TAVILY_API_KEY="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"
```

## 日志查看

```bash
tail -f workspace/cron.log
```
