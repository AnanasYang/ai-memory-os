# AI News Digest - Cron 配置指南

## 配置步骤

### 1. 设置环境变量

在 `~/.bashrc` 或 `~/.zshrc` 中添加：

```bash
export FEISHU_CHAT_ID="your_chat_id_here"
```

### 2. 创建 Cron 任务

```bash
# 编辑 crontab
crontab -e

# 添加以下内容（假设 skill 安装在 ~/.openclaw/workspace/skills/ai-news-digest）

# 每天上午 10:00 发送日报
0 10 * * * cd ~/.openclaw/workspace/skills/ai-news-digest && ./scripts/run-digest.sh daily $FEISHU_CHAT_ID >> ./workspace/cron.log 2>&1

# 每周日上午 10:00 发送周报
0 10 * * 0 cd ~/.openclaw/workspace/skills/ai-news-digest && ./scripts/run-digest.sh weekly $FEISHU_CHAT_ID >> ./workspace/cron.log 2>&1
```

### 3. 使用 OpenClaw Cron 管理（推荐）

通过 OpenClaw 的 cron 工具管理：

```bash
# 添加日报任务
openclaw cron add \
  --name "ai-daily-digest" \
  --schedule "0 10 * * *" \
  --command "~/.openclaw/workspace/skills/ai-news-digest/scripts/run-digest.sh daily $FEISHU_CHAT_ID"

# 添加周报任务  
openclaw cron add \
  --name "ai-weekly-digest" \
  --schedule "0 10 * * 0" \
  --command "~/.openclaw/workspace/skills/ai-news-digest/scripts/run-digest.sh weekly $FEISHU_CHAT_ID"
```

### 4. 手动测试

```bash
# 生成日报（不发送）
./scripts/run-digest.sh daily

# 生成并发送日报
./scripts/run-digest.sh daily your_chat_id

# 生成周报
./scripts/run-digest.sh weekly your_chat_id
```

## 输出文件

运行后会在 `workspace/` 目录下生成：

- `articles.json` - 抓取的文章原始数据
- `report.md` - 生成的报告
- `cron.log` - Cron 执行日志

## 自定义配置

编辑 `references/config.json` 可调整：

- 信息源启用/禁用
- 日报/周报参数
- 分类规则
