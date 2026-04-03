---
name: ai-news-digest-pro
version: "3.0.0"
description: |
  AI 日报/周报专业版 - 结构化新闻简报系统。
  整合多中文源+英文源，精选整合后输出标准格式简报。
  
  特点：
  - 多源数据抓取（量子位、36氪、InfoQ、机器之心、Tavily等）
  - 智能分层（核心层/近层/外延层/支撑层）
  - 精选整合（不是罗列，是提炼关键信息）
  - 标准格式输出（类似示例简报格式）
  - 稳定可移植（不依赖LLM每次重新理解）
  
  使用方法：
  1. ./scripts/run-digest.sh [daily|weekly]
  2. 生成标准格式简报文件
  3. 使用 message 工具 filePath 参数发送

---

# AI News Digest Pro

专业级 AI 新闻简报系统，专为传统车企 AI 团队定制。

## 快速开始

```bash
# 生成日报
./scripts/run-digest.sh daily

# 生成周报  
./scripts/run-digest.sh weekly
```

## 数据流程

```
多源抓取 → 智能分层 → 精选整合 → 标准格式 → 文件发送
   ↑                                              ↓
量子位/RSS/Tavily                          message filePath
```

## 输出格式

```
【今日AI前沿 - YYYY-MM-DD】
报送人：小爪
日期：YYYY-MM-DD
范围：过去24小时关键动态

🔴 核心层（可落地的开源项目/模型/范式）
一、xxx
关键信息：
  • 要点1
  • 要点2
💡 对你：具体建议
来源：量子位 | 机器之心

🟡 近层（行业动态/产品发布/技术路线）
...

🟢 外延层（观点思辨/跨领域启发）
...

⚪ 支撑层（政策/投资/宏观）
...

📋 今日行动建议
【短期】...
【中期】...
【学习】...

📊 今日动态分布
```

## 目录结构

```
ai-news-digest-pro/
├── scripts/
│   ├── fetch-qbitai.js      # 量子位 RSS
│   ├── fetch-chinese.js     # 36氪、InfoQ等中文RSS
│   ├── fetch-tavily.js      # Tavily 英文搜索
│   ├── fetch-tavily-cn.js   # Tavily 中文搜索
│   ├── categorize.js        # 智能分层
│   ├── generate-brief.js    # 生成标准格式简报
│   └── run-digest.sh        # 主执行脚本
├── config/
│   └── sources.json         # 数据源配置
└── workspace/               # 输出目录
```

## 配置

### 环境变量

```bash
export TAVILY_API_KEY="your_api_key"
```

### 数据源配置 (config/sources.json)

```json
{
  "sources": {
    "qbitai": { "enabled": true, "priority": 1 },
    "36kr": { "enabled": true, "priority": 2 },
    "infoq": { "enabled": true, "priority": 2 },
    "tavily_en": { "enabled": true, "priority": 3 },
    "tavily_cn": { "enabled": true, "priority": 3 }
  }
}
```

## Cron 部署

### 日报（每天 10:00）

```bash
openclaw cron add \
  --name "ai-daily-brief" \
  --schedule "0 10 * * *" \
  --session-target isolated \
  --payload '{
    "kind": "agentTurn",
    "message": "执行 AI News Digest Pro 日报：1) cd /path/to/ai-news-digest-pro && export TAVILY_API_KEY=xxx && ./scripts/run-digest.sh daily; 2) 使用 message 工具发送文件，filePath 为 workspace/简报_YYYYMMDD.md",
    "model": "kimi-coding/k2p5"
  }' \
  --delivery '{"mode":"announce","channel":"feishu","to":"user_id"}'
```

## 与现有任务对比

| 维度 | 原 Cron 任务 | 本 Skill |
|------|-------------|---------|
| 执行方式 | LLM 每次搜索生成 | 结构化脚本执行 |
| 稳定性 | 依赖 LLM 可用性 | 脚本可靠执行 |
| 可移植性 | 需重新配置 | 即插即用 |
| 数据源 | Tavily 搜索 | 多源 RSS + Tavily |
| 输出格式 | LLM 自由生成 | 标准固定格式 |
| 成本 | 高（每次 LLM 调用） | 低（脚本执行） |

## 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 文章数少 | RSS 失效 | 检查 config/sources.json |
| Tavily 失败 | API Key | 检查环境变量 |
| 发送失败 | 文件路径 | 使用绝对路径 |

---
*AI News Digest Pro - 稳定、可移植、专业*
