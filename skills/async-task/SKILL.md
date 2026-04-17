# OpenClaw Async Task

## Description

Execute long-running tasks without HTTP timeouts. Use when you need to:
- Run commands that may take more than 5 seconds
- Analyze large files or codebases
- Perform multi-step operations
- Call external APIs with unpredictable latency

**IMPORTANT**: When a task might timeout, you MUST use this skill to avoid `empty response from server` errors.

**NEW**: Enhanced `run` command with automatic timeout protection, heartbeat progress updates, and exit code detection. No more silent failures!

Triggers: "async task", "long running", "timeout", "background task", "push result"

## Installation

```bash
# Already installed via clawhub
# Located at: ~/.openclaw/workspace/skills/async-task/async-task.js
```

## Commands

### Enhanced Mode (Recommended)

```bash
async-task run --desc "<description>" --cmd "<command>" [options]
```

**Options:**
| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--desc` | `-d` | required | Task description (shown to user) |
| `--cmd` | `-c` | required | Shell command to execute |
| `--timeout` | `-t` | 300 | Timeout limit in seconds (0 = no timeout) |
| `--heartbeat` | `-h` | 30 | Progress update interval in seconds (0 = disable) |
| `--no-output` | - | - | Don't capture and display command output |

**Features:**
- ✅ **Timeout protection** - Auto-terminates hung tasks
- ✅ **Heartbeat progress** - Regular updates so user knows it's alive
- ✅ **Exit code detection** - Automatic success/failure notification
- ✅ **Output capture** - Returns command output to user
- ✅ **No manual pairing** - Single command, no `start`/`done` needed

### Legacy Mode (Manual Control)

```bash
async-task start "<description>"  # Start task, returns immediately
async-task done "<result>"        # Complete task, push result to user
async-task fail "<error>"         # Task failed, push error message
async-task push "<message>"       # Push message directly (no start needed)
async-task status                 # Show current task status
```

## Usage Examples

### Using `run` Command (Recommended)

**Count files with timeout protection:**
```bash
async-task run --desc "统计文件数量" --cmd "find . -type f | wc -l" --timeout 60
```

**Long analysis with progress updates:**
```bash
async-task run \
  --desc "分析代码库" \
  --cmd "find . -name '*.py' -exec wc -l {} + | tail -1" \
  --timeout 300 \
  --heartbeat 60
```

**Quick command without output capture:**
```bash
async-task run --desc "清理缓存" --cmd "rm -rf /tmp/cache/*" --no-output --timeout 30
```

### Using Legacy Mode

User asks: "Count all TypeScript files in this project"

```bash
# Step 1: Acknowledge immediately
async-task start "Counting TypeScript files..."

# Step 2: Do the actual work
 count=$(find . -name "*.ts" | wc -l)

# Step 3: Push the result
async-task done "Found $count TypeScript files"
```

## How It Works

### Enhanced `run` Mode
1. Parse command and options
2. Spawn child process with real-time monitoring
3. Start heartbeat timer for progress updates
4. Start timeout timer for protection
5. Wait for process exit or timeout
6. Automatically push result/failure to user

### Legacy Mode
1. `start` saves task state and returns confirmation immediately
2. You execute whatever commands needed
3. `done`/`fail` uses OpenClaw/Clawdbot CLI to push result to the active session

**Zero configuration required** - automatically detects active session via `openclaw sessions` or `clawdbot sessions`.

## Advanced: Custom Push Endpoint

For custom webchat or notification systems:

```bash
export ASYNC_TASK_PUSH_URL="https://your-server.com/api/push"
export ASYNC_TASK_AUTH_TOKEN="your-token"
```

The endpoint receives:
```json
{
  "sessionId": "session-id",
  "content": "message",
  "role": "assistant"
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCLAW_SESSION` | No | Target session (auto-detected if not set) |
| `ASYNC_TASK_PUSH_URL` | No | Custom HTTP push endpoint |
| `ASYNC_TASK_AUTH_TOKEN` | No | Auth token for custom endpoint |

## Error Handling & Edge Cases

### Timeout Protection
```bash
# Task will be killed after 60 seconds
async-task run --desc "Risky task" --cmd "potentially_hanging_command" --timeout 60
```
**Result:** User receives "⚠️ 任务超时 (60秒)，已终止"

### Command Failure Detection
```bash
async-task run --desc "Deploy app" --cmd "npm run deploy" --timeout 120
```
**If command exits with non-zero:** User receives "❌ Deploy app\n   退出码: 1\n   错误输出: ..."

### Heartbeat for Long Tasks
```bash
async-task run --desc "Training model" --cmd "python train.py" --timeout 3600 --heartbeat 300
```
**Result:** User receives progress update every 5 minutes

## Critical Rules

### For `run` Command:
- **Always set appropriate timeout** - Default 300s (5 min), adjust based on task
- **Use heartbeat for >60s tasks** - Keep user informed of progress
- **Check command exit codes** - Non-zero exit = automatic failure notification

### For Legacy Mode:
- **MUST** pair `start` with `done` or `fail`
- **NEVER** start without completing
- **NEVER** say "will push later" then forget

## Comparison: run vs Legacy

| Feature | `run` Command | Legacy (start/done) |
|---------|---------------|---------------------|
| Timeout protection | ✅ Built-in | ❌ Manual |
| Progress updates | ✅ Heartbeat | ❌ None |
| Exit code detection | ✅ Automatic | ❌ Manual |
| Output capture | ✅ Automatic | ❌ Manual |
| Complexity | Simple | Requires pairing |
| Use case | One-shot commands | Complex multi-step |

## Links

- [GitHub](https://github.com/Enderfga/openclaw-async-task)
- [OpenClaw](https://openclaw.ai)
