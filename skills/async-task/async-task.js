#!/usr/bin/env node

/**
 * OpenClaw Async Task - 异步任务执行器
 * 
 * 解决 AI 执行耗时任务时的 HTTP 超时问题。
 * 使用 OpenClaw/Clawdbot 原生 sessions API 推送结果，零配置即用。
 * 
 * 增强版：新增 run 命令，支持超时监控、心跳汇报、自动完成/失败检测
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 状态文件路径
const STATE_DIR = process.env.OPENCLAW_STATE_DIR || 
                  process.env.CLAWDBOT_STATE_DIR ||
                  path.join(process.env.HOME, '.openclaw');
const STATE_FILE = path.join(STATE_DIR, 'async-task-state.json');

// 自定义推送端点（可选，高级用户）
const CUSTOM_PUSH_URL = process.env.ASYNC_TASK_PUSH_URL || '';
const CUSTOM_AUTH_TOKEN = process.env.ASYNC_TASK_AUTH_TOKEN || '';

// 检测 CLI 命令（openclaw 优先，fallback 到 clawdbot）
function getCLI() {
  try {
    execSync('which openclaw', { stdio: 'pipe' });
    return 'openclaw';
  } catch {
    try {
      execSync('which clawdbot', { stdio: 'pipe' });
      return 'clawdbot';
    } catch {
      return null;
    }
  }
}

const CLI = getCLI();

// 确保状态目录存在
function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

// 读取状态
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { currentTask: null, history: [] };
  }
}

// 保存状态
function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// 获取当前活跃 session
function getActiveSession() {
  // 1. 环境变量（向后兼容）
  if (process.env.OPENCLAW_SESSION || process.env.CLAWDBOT_PUSH_SESSION) {
    return process.env.OPENCLAW_SESSION || process.env.CLAWDBOT_PUSH_SESSION;
  }

  // 2. 通过 CLI 获取
  if (!CLI) {
    return null;
  }

  try {
    const output = execSync(`${CLI} sessions --active 5 --json 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 5000
    });
    
    const data = JSON.parse(output);
    if (data.sessions && data.sessions.length > 0) {
      // 返回最近活跃的 session key
      const session = data.sessions[0];
      if (session.key) {
        // 处理不同格式: "webchat:xxx" -> "xxx", "telegram:123" -> keep as is
        const parts = session.key.split(':');
        return parts.length > 1 ? parts.slice(1).join(':') : session.key;
      }
    }
  } catch (err) {
    // 静默失败
  }

  return null;
}

// 通过 CLI 推送（支持多种命令格式）
async function pushViaCLI(sessionKey, content) {
  if (!CLI) {
    throw new Error('OpenClaw/Clawdbot CLI not found');
  }

  // 尝试多种推送方式
  const attempts = [
    // 方式1: clawbot sessions_send (最可能支持)
    ['clawbot', ['sessions_send', sessionKey, content]],
    // 方式2: openclaw message send
    ['openclaw', ['message', 'send', '--session', sessionKey, content]],
    // 方式3: openclaw sessions send (如果支持)
    ['openclaw', ['sessions', 'send', '--session', sessionKey, content]],
  ];

  for (const [cmd, args] of attempts) {
    try {
      // 检查命令是否存在
      execSync(`which ${cmd}`, { stdio: 'pipe' });
      
      return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on('close', (code) => {
          if (code === 0) {
            resolve(stdout);
          } else {
            reject(new Error(`${cmd} failed (exit ${code}): ${stderr || stdout}`));
          }
        });

        proc.on('error', (err) => {
          reject(new Error(`Failed to spawn ${cmd}: ${err.message}`));
        });
      });
    } catch (err) {
      // 尝试下一个
      continue;
    }
  }

  throw new Error('No working push method found. Tried: clawbot sessions_send, openclaw message send');
}

// 通过自定义 HTTP 端点推送（高级用户）
async function pushViaHTTP(sessionId, content) {
  const https = require('https');
  const http = require('http');
  
  if (!CUSTOM_PUSH_URL) {
    throw new Error('No custom push URL configured');
  }

  return new Promise((resolve, reject) => {
    const url = new URL(CUSTOM_PUSH_URL);
    const lib = url.protocol === 'https:' ? https : http;

    const data = JSON.stringify({
      sessionId: sessionId,
      content: content,
      role: 'assistant'
    });

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };

    if (CUSTOM_AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${CUSTOM_AUTH_TOKEN}`;
    }

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 推送消息（自动选择方式）
async function pushMessage(sessionId, content) {
  // 优先使用自定义 HTTP 端点（如果配置了）
  if (CUSTOM_PUSH_URL) {
    return pushViaHTTP(sessionId, content);
  }

  // 否则使用 CLI
  return pushViaCLI(sessionId, content);
}

// 模拟推送（用于测试）
async function mockPushMessage(sessionId, content) {
  console.log(`\n📤 [MOCK PUSH to ${sessionId}]:`);
  console.log(content.split('\n').map(l => '   ' + l).join('\n'));
  console.log('');
  return Promise.resolve();
}

// 增强版：run 命令 - 执行命令并监控
async function runCommand(options) {
  const { description, command, timeout = 300, heartbeat = 30, captureOutput = true, mockMode = false } = options;
  
  const sessionId = getActiveSession() || 'test-session';
  const pushFn = mockMode ? mockPushMessage : pushMessage;

  // 记录任务开始
  const state = loadState();
  const taskId = Date.now().toString();
  state.currentTask = {
    id: taskId,
    description,
    command,
    startedAt: new Date().toISOString(),
    sessionId,
    status: 'running'
  };
  saveState(state);

  // 立即通知用户任务开始
  console.log(`⏳ ${description}`);
  console.log(`   Command: ${command}`);
  console.log(`   Timeout: ${timeout}s | Heartbeat: ${heartbeat}s`);
  
  try {
    await pushFn(sessionId, `⏳ ${description}\n   超时设定: ${timeout}秒 | 命令: ${command.slice(0, 50)}${command.length > 50 ? '...' : ''}`);
  } catch (err) {
    console.error(`   [Push failed: ${err.message}]`);
  }

  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
    let isCompleted = false;

    // 启动子进程
    const child = spawn('bash', ['-c', command], {
      stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'ignore'
    });

    // 收集输出
    if (captureOutput && child.stdout) {
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
    }

    if (captureOutput && child.stderr) {
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    // 心跳定时器
    let heartbeatCount = 0;
    const heartbeatTimer = heartbeat > 0 ? setInterval(async () => {
      if (isCompleted) return;
      heartbeatCount++;
      const elapsed = heartbeatCount * heartbeat;
      try {
        await pushFn(sessionId, `⏳ ${description} (已运行 ${elapsed}秒...)`);
      } catch (err) {
        console.error(`   [Heartbeat push failed: ${err.message}]`);
      }
    }, heartbeat * 1000) : null;

    // 超时定时器
    const timeoutTimer = timeout > 0 ? setTimeout(async () => {
      if (isCompleted) return;
      isCompleted = true;
      
      // 终止子进程
      child.kill('SIGTERM');
      
      // 给 5 秒优雅退出时间
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);

      const errorMsg = `⚠️ 任务超时 (${timeout}秒)，已终止: ${description}`;
      console.error(`\n${errorMsg}`);
      
      try {
        await pushFn(sessionId, errorMsg);
      } catch (err) {
        console.error(`   [Timeout push failed: ${err.message}]`);
      }

      // 更新状态
      const currentState = loadState();
      if (currentState.currentTask?.id === taskId) {
        currentState.history.push({
          ...currentState.currentTask,
          status: 'timeout',
          error: `Timeout after ${timeout}s`,
          completedAt: new Date().toISOString()
        });
        currentState.currentTask = null;
        saveState(currentState);
      }

      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reject(new Error(`Task timed out after ${timeout}s`));
    }, timeout * 1000) : null;

    // 进程退出处理
    child.on('exit', async (code, signal) => {
      if (isCompleted) return;
      isCompleted = true;

      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);

      const duration = Math.round((Date.now() - new Date(state.currentTask.startedAt).getTime()) / 1000);
      
      // 更新状态
      const currentState = loadState();
      if (currentState.currentTask?.id === taskId) {
        currentState.currentTask = null;
        
        if (code === 0) {
          currentState.history.push({
            id: taskId,
            description,
            command,
            startedAt: state.currentTask.startedAt,
            completedAt: new Date().toISOString(),
            status: 'done',
            duration,
            output: output.slice(0, 10000) // 限制存储大小
          });
          saveState(currentState);

          const resultMsg = `✅ ${description}\n   耗时: ${duration}秒\n\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``;
          console.log(`\n✓ Task completed in ${duration}s`);
          
          try {
            await pushFn(sessionId, resultMsg);
          } catch (err) {
            console.error(`   [Completion push failed: ${err.message}]`);
          }
          
          resolve({ code: 0, output, duration });
        } else {
          const errorMsg = signal 
            ? `❌ ${description}\n   被信号终止: ${signal}\n   耗时: ${duration}秒\n\n错误输出:\n\`\`\`\n${errorOutput.slice(0, 1000)}\n\`\`\``
            : `❌ ${description}\n   退出码: ${code}\n   耗时: ${duration}秒\n\n错误输出:\n\`\`\`\n${errorOutput.slice(0, 1000)}\n\`\`\``;
          
          currentState.history.push({
            id: taskId,
            description,
            command,
            startedAt: state.currentTask.startedAt,
            completedAt: new Date().toISOString(),
            status: 'failed',
            duration,
            exitCode: code,
            signal,
            error: errorOutput.slice(0, 5000)
          });
          saveState(currentState);

          console.error(`\n✗ Task failed with code ${code}`);
          
          try {
            await pushFn(sessionId, errorMsg);
          } catch (err) {
            console.error(`   [Failure push failed: ${err.message}]`);
          }
          
          reject(new Error(`Task failed with exit code ${code}${signal ? ` (signal: ${signal})` : ''}`));
        }
      }
    });

    child.on('error', async (err) => {
      if (isCompleted) return;
      isCompleted = true;

      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);

      const errorMsg = `❌ ${description}\n   启动失败: ${err.message}`;
      console.error(`\n${errorMsg}`);
      
      try {
        await pushFn(sessionId, errorMsg);
      } catch (pushErr) {
        console.error(`   [Error push failed: ${pushErr.message}]`);
      }

      // 更新状态
      const currentState = loadState();
      if (currentState.currentTask?.id === taskId) {
        currentState.history.push({
          ...currentState.currentTask,
          status: 'error',
          error: err.message,
          completedAt: new Date().toISOString()
        });
        currentState.currentTask = null;
        saveState(currentState);
      }

      reject(err);
    });
  });
}

// 解析 run 命令的参数
function parseRunArgs(args) {
  const options = {
    description: '',
    command: '',
    timeout: 300,
    heartbeat: 30,
    captureOutput: true,
    mockMode: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--desc':
      case '-d':
        options.description = args[++i] || '';
        break;
      case '--cmd':
      case '-c':
        options.command = args[++i] || '';
        break;
      case '--timeout':
      case '-t':
        options.timeout = parseInt(args[++i]) || 300;
        break;
      case '--heartbeat':
      case '-h':
        options.heartbeat = parseInt(args[++i]) || 30;
        break;
      case '--no-output':
        options.captureOutput = false;
        break;
      case '--mock':
        options.mockMode = true;
        break;
      default:
        // 如果位置参数没有 -- 前缀，可能是旧式用法
        if (!arg.startsWith('--') && !arg.startsWith('-')) {
          if (!options.description) {
            options.description = arg;
          } else if (!options.command) {
            options.command = arg;
          }
        }
        break;
    }
  }

  return options;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'start': {
      const message = args.slice(1).join(' ');
      if (!message) {
        console.error('Usage: async-task start "<task description>"');
        process.exit(1);
      }

      const sessionId = getActiveSession();
      
      const state = loadState();
      state.currentTask = {
        description: message,
        startedAt: new Date().toISOString(),
        sessionId: sessionId
      };
      saveState(state);

      console.log(`⏳ ${message}`);
      console.log('\n[Task started. Call "async-task done" or "async-task fail" when finished.]');
      break;
    }

    case 'done': {
      const message = args.slice(1).join(' ');
      if (!message) {
        console.error('Usage: async-task done "<result message>"');
        process.exit(1);
      }

      const state = loadState();
      const sessionId = state.currentTask?.sessionId || getActiveSession();

      if (!sessionId) {
        console.error('Error: No session ID. Set OPENCLAW_SESSION or ensure CLI is available.');
        process.exit(1);
      }

      try {
        await pushMessage(sessionId, `✅ ${message}`);
        console.log(`✓ Result pushed to session: ${sessionId}`);

        if (state.currentTask) {
          state.history.push({
            ...state.currentTask,
            result: message,
            completedAt: new Date().toISOString(),
            status: 'done'
          });
          if (state.history.length > 20) {
            state.history = state.history.slice(-20);
          }
        }
        state.currentTask = null;
        saveState(state);
      } catch (err) {
        console.error('Push failed:', err.message);
        process.exit(1);
      }
      break;
    }

    case 'fail': {
      const message = args.slice(1).join(' ');
      if (!message) {
        console.error('Usage: async-task fail "<error message>"');
        process.exit(1);
      }

      const state = loadState();
      const sessionId = state.currentTask?.sessionId || getActiveSession();

      if (!sessionId) {
        console.error('Error: No session ID available.');
        process.exit(1);
      }

      try {
        await pushMessage(sessionId, `❌ Task failed: ${message}`);
        console.log(`✓ Failure pushed to session: ${sessionId}`);

        if (state.currentTask) {
          state.history.push({
            ...state.currentTask,
            error: message,
            completedAt: new Date().toISOString(),
            status: 'failed'
          });
          if (state.history.length > 20) {
            state.history = state.history.slice(-20);
          }
        }
        state.currentTask = null;
        saveState(state);
      } catch (err) {
        console.error('Push failed:', err.message);
        process.exit(1);
      }
      break;
    }

    case 'push': {
      const message = args.slice(1).join(' ');
      if (!message) {
        console.error('Usage: async-task push "<message>"');
        process.exit(1);
      }

      const sessionId = getActiveSession();

      if (!sessionId) {
        console.error('Error: No session ID available.');
        process.exit(1);
      }

      try {
        await pushMessage(sessionId, message);
        console.log(`✓ Pushed to session: ${sessionId}`);
      } catch (err) {
        console.error('Push failed:', err.message);
        process.exit(1);
      }
      break;
    }

    case 'run': {
      // 新增：一键执行+监控模式
      const options = parseRunArgs(args.slice(1));
      
      // 如果没有提供 description 或 command，尝试从剩余参数解析
      if (!options.description) {
        console.error('Usage: async-task run --desc "<description>" --cmd "<command>" [--timeout 300] [--heartbeat 30]');
        console.error('   or: async-task run "<description>" "<command>"');
        console.error('');
        console.error('Options:');
        console.error('  --desc, -d "<text>"     Task description (shown to user)');
        console.error('  --cmd, -c "<command>"   Shell command to execute');
        console.error('  --timeout, -t <seconds> Timeout limit (default: 300)');
        console.error('  --heartbeat, -h <sec>   Progress update interval (default: 30, 0=disable)');
        console.error('  --no-output             Don\'t capture command output');
        console.error('  --mock                  Mock mode (for testing, no real push)');
        process.exit(1);
      }

      if (!options.command) {
        console.error('Error: --cmd is required');
        process.exit(1);
      }

      try {
        await runCommand(options);
      } catch (err) {
        console.error('Task execution failed:', err.message);
        process.exit(1);
      }
      break;
    }

    case 'status': {
      const state = loadState();
      if (state.currentTask) {
        console.log('Current task:');
        console.log(`  Description: ${state.currentTask.description}`);
        console.log(`  Started: ${state.currentTask.startedAt}`);
        console.log(`  Session: ${state.currentTask.sessionId || '(unknown)'}`);
        if (state.currentTask.command) {
          console.log(`  Command: ${state.currentTask.command}`);
        }
      } else {
        console.log('No active task.');
      }

      if (state.history.length > 0) {
        console.log(`\nRecent history (last 5):`);
        state.history.slice(-5).forEach((task) => {
          const icon = task.status === 'done' ? '✅' : 
                       task.status === 'timeout' ? '⏱️' : '❌';
          const duration = task.duration ? ` (${task.duration}s)` : '';
          console.log(`  ${icon} ${task.description}${duration}`);
        });
      }
      break;
    }

    default:
      console.log(`
async-task - Async Task Executor for OpenClaw/Clawdbot

Solve HTTP timeout issues when AI executes long-running tasks.

Usage:
  async-task start "<description>"  Start task, confirm immediately
  async-task done "<result>"        Complete task, push result
  async-task fail "<error>"         Fail task, push error
  async-task push "<message>"       Push message directly
  async-task status                 Show current task status
  
  NEW: async-task run               Execute with monitoring (recommended)

Run Command (Enhanced):
  async-task run --desc "<desc>" --cmd "<command>" [options]

  Options:
    --desc, -d "<text>"     Task description (shown to user)
    --cmd, -c "<command>"   Shell command to execute
    --timeout, -t <seconds> Timeout limit (default: 300)
    --heartbeat, -h <sec>   Progress update interval (default: 30, 0=disable)
    --no-output             Don't capture command output
    --mock                  Mock mode for testing (no real push)

  Example:
    async-task run --desc "Count files" --cmd "find . -type f | wc -l" --timeout 60

Environment Variables:
  OPENCLAW_SESSION          Target session ID (auto-detected if not set)
  ASYNC_TASK_PUSH_URL       Custom HTTP push endpoint
  ASYNC_TASK_AUTH_TOKEN     Auth token for custom endpoint

Legacy Mode (Manual Start/Done):
  async-task start "Analyzing large codebase..."
  # ... do work ...
  async-task done "Found 42 TODO comments"
`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
