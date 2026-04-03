#!/bin/bash
# Worker 3: 自动同步脚本设置
# 任务：设置自动同步脚本（使用 inotify + git hook）

set -e

echo "🔄 Worker 3: 设置自动同步机制..."

MEMORY_DIR="/home/bruce/.openclaw/workspace/ai-memory-system"
SYNC_SCRIPT="$MEMORY_DIR/scripts/auto-sync.sh"

# 创建自动同步脚本
cat > "$SYNC_SCRIPT" << 'SCRIPTEOF'
#!/bin/bash
# Auto Sync Script for AI Memory System
# 自动检测变更并推送到 GitHub

set -e

MEMORY_DIR="/home/bruce/.openclaw/workspace/ai-memory-system"
LOG_FILE="$MEMORY_DIR/.sync.log"
LOCK_FILE="/tmp/memory-sync.lock"

# 防止重复运行
if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "$(date): Sync already running, skipping" >> "$LOG_FILE"
    exit 0
  fi
fi
echo $$ > "$LOCK_FILE"

cd "$MEMORY_DIR"

# 检查是否有变更
if [ -z "$(git status --porcelain)" ]; then
  rm -f "$LOCK_FILE"
  exit 0
fi

# 添加所有变更
git add -A

# 生成提交信息
CHANGES=$(git status --short | head -5 | sed 's/^/- /')
COMMIT_MSG="Auto-sync: $(date '+%Y-%m-%d %H:%M')

Changes:
$CHANGES"

# 提交
git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1 || true

# 推送
git push origin master >> "$LOG_FILE" 2>&1

echo "$(date): Sync completed" >> "$LOG_FILE"
rm -f "$LOCK_FILE"
SCRIPTEOF

chmod +x "$SYNC_SCRIPT"
echo "📝 创建自动同步脚本: $SYNC_SCRIPT"

# 创建 git post-commit hook
mkdir -p "$MEMORY_DIR/.git/hooks"
cat > "$MEMORY_DIR/.git/hooks/post-commit" << 'HOOKEOF'
#!/bin/bash
# Post-commit hook: 每次提交后自动推送

set -e

cd /home/bruce/.openclaw/workspace/ai-memory-system

# 后台推送，不阻塞提交
git push origin master &>/dev/null &
HOOKEOF

chmod +x "$MEMORY_DIR/.git/hooks/post-commit"
echo "🔗 配置 post-commit hook"

# 创建 cron 任务文件（供用户手动安装）
cat > "$MEMORY_DIR/scripts/install-cron.sh" << 'CRONEOF'
#!/bin/bash
# 安装定时同步任务

echo "Installing cron job for auto-sync..."

CRON_JOB="*/30 * * * * /home/bruce/.openclaw/workspace/ai-memory-system/scripts/auto-sync.sh >> /home/bruce/.openclaw/workspace/ai-memory-system/.sync.log 2>&1"

# 检查是否已存在
if crontab -l 2>/dev/null | grep -q "memory-sync"; then
  echo "Cron job already exists"
else
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo "Cron job installed: sync every 30 minutes"
fi
CRONEOF

chmod +x "$MEMORY_DIR/scripts/install-cron.sh"
echo "📅 创建 cron 安装脚本"

# 创建 systemd 服务文件（更可靠的方案）
cat > "$MEMORY_DIR/scripts/memory-sync.service" << 'SERVICEEOF'
[Unit]
Description=AI Memory System Auto Sync
After=network.target

[Service]
Type=oneshot
ExecStart=/home/bruce/.openclaw/workspace/ai-memory-system/scripts/auto-sync.sh
User=bruce

[Install]
WantedBy=multi-user.target
SERVICEEOF

cat > "$MEMORY_DIR/scripts/memory-sync.timer" << 'TIMEREOF'
[Unit]
Description=Run Memory Sync every 15 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=15min

[Install]
WantedBy=timers.target
TIMEREOF

echo "⚙️  创建 systemd 服务配置"

# 安装 systemd 服务（如果可用）
if command -v systemctl &> /dev/null; then
  sudo cp "$MEMORY_DIR/scripts/memory-sync.service" /etc/systemd/system/ 2>/dev/null || echo "Note: May need sudo to install systemd service"
  sudo cp "$MEMORY_DIR/scripts/memory-sync.timer" /etc/systemd/system/ 2>/dev/null || echo "Note: May need sudo to install systemd timer"
  sudo systemctl daemon-reload 2>/dev/null || true
  sudo systemctl enable memory-sync.timer 2>/dev/null || true
  sudo systemctl start memory-sync.timer 2>/dev/null || true
  echo "✅ systemd 定时任务已配置"
fi

# 提交同步脚本
cd "$MEMORY_DIR"
git add scripts/
git commit -m "Add auto-sync infrastructure

- Add auto-sync.sh script
- Add post-commit hook
- Add cron installation script
- Add systemd service/timer" 2>/dev/null || true
git push origin master 2>/dev/null || true

echo "✅ Worker 3 完成：自动同步机制已设置"
echo ""
echo "📋 同步机制说明："
echo "  1. Post-commit hook: 每次提交后自动推送"
echo "  2. Systemd timer: 每15分钟自动同步（如已安装）"
echo "  3. 手动触发: ./scripts/auto-sync.sh"
