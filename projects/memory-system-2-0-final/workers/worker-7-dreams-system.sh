#!/bin/bash
# Worker 7: Dreams 系统完善
# 任务：完善 Daily/Weekly Dreams 系统

set -e

echo "🌙 Worker 7: 完善 Dreams 系统..."

MEMORY_DIR="/home/bruce/.openclaw/workspace/ai-memory-system"

# 1. 创建统一调度脚本
cat > "$MEMORY_DIR/scripts/dream-scheduler.mjs" << 'EOFMJS'
#!/usr/bin/env node
/**
 * Dreams 统一调度器
 * 协调 Daily Dream 和 Weekly Dream 的执行
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const MEMORY_ROOT = process.env.MEMORY_ROOT || '/home/bruce/.openclaw/workspace/ai-memory-system';

const SCHEDULE = {
  daily: {
    script: 'daily-dream-integrated.mjs',
    cron: '0 23 * * *', // 每天 23:00
    description: 'Generate daily episodic memories'
  },
  weekly: {
    script: 'weekly-dream-integrated.mjs',
    cron: '0 10 * * 0', // 每周日 10:00
    description: 'Generate weekly review'
  }
};

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function runDream(type) {
  const config = SCHEDULE[type];
  if (!config) {
    log(`❌ Unknown dream type: ${type}`);
    return;
  }
  
  const scriptPath = `${MEMORY_ROOT}/scripts/${config.script}`;
  if (!existsSync(scriptPath)) {
    log(`❌ Script not found: ${scriptPath}`);
    return;
  }
  
  log(`🌙 Starting ${type} dream...`);
  log(`   Script: ${config.script}`);
  
  try {
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      cwd: MEMORY_ROOT
    });
    log(`✅ ${type} dream completed`);
    
    // 触发同步
    log('🔄 Triggering sync...');
    execSync('make sync', { cwd: MEMORY_ROOT });
    
  } catch (error) {
    log(`❌ ${type} dream failed: ${error.message}`);
    process.exit(1);
  }
}

function showSchedule() {
  console.log('🗓️ Dreams Schedule:\n');
  for (const [type, config] of Object.entries(SCHEDULE)) {
    console.log(`${type.toUpperCase()}:`);
    console.log(`  Cron: ${config.cron}`);
    console.log(`  Script: ${config.script}`);
    console.log(`  Description: ${config.description}`);
    console.log('');
  }
}

function installCron() {
  const cronLines = [
    '# AI Memory System - Dreams Scheduler',
    `${SCHEDULE.daily.cron} cd ${MEMORY_ROOT} && node scripts/dream-scheduler.mjs daily >> .dreams.log 2>&1`,
    `${SCHEDULE.weekly.cron} cd ${MEMORY_ROOT} && node scripts/dream-scheduler.mjs weekly >> .dreams.log 2>&1`
  ];
  
  console.log('Add these lines to your crontab:\n');
  console.log(cronLines.join('\n'));
  console.log('\nRun: crontab -e');
}

// 主流程
const command = process.argv[2];

switch (command) {
  case 'daily':
    runDream('daily');
    break;
  case 'weekly':
    runDream('weekly');
    break;
  case 'schedule':
    showSchedule();
    break;
  case 'install':
    installCron();
    break;
  default:
    console.log('Usage: dream-scheduler.mjs [daily|weekly|schedule|install]');
    showSchedule();
}
EOFMJS

chmod +x "$MEMORY_DIR/scripts/dream-scheduler.mjs"

# 2. 创建 Dreams 状态看板
cat > "$MEMORY_DIR/scripts/dream-dashboard.mjs" << 'EOFMJS'
#!/usr/bin/env node
/**
 * Dreams 状态看板
 * 显示 Dreams 系统的运行状态和统计
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const MEMORY_ROOT = process.env.MEMORY_ROOT || '/home/bruce/.openclaw/workspace/ai-memory-system';

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter(f => f.endsWith('.md')).length;
}

function getLastRun(type) {
  const logFile = join(MEMORY_ROOT, '.dreams.log');
  if (!existsSync(logFile)) return 'Never';
  
  const lines = readFileSync(logFile, 'utf-8').split('\n').filter(l => l.includes(type));
  if (lines.length === 0) return 'Never';
  
  const lastLine = lines[lines.length - 1];
  const match = lastLine.match(/\[(.*?)\]/);
  return match ? match[1] : 'Unknown';
}

function getGitStatus() {
  try {
    const { execSync } = require('child_process');
    const status = execSync('git status --short', { cwd: MEMORY_ROOT, encoding: 'utf-8' });
    return status.trim().split('\n').filter(l => l);
  } catch {
    return [];
  }
}

function printDashboard() {
  console.clear();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           🤖 AI Memory System - Dreams Dashboard         ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║                                                          ║');
  
  // 记忆统计
  console.log('║  📊 Memory Statistics                                    ║');
  console.log('║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║');
  console.log(`║  L1 Episodic:    ${String(countFiles(join(MEMORY_ROOT, 'Memory/L1-episodic'))).padEnd(6)} files                          ║`);
  console.log(`║  L2 Procedural:  ${String(countFiles(join(MEMORY_ROOT, 'Memory/L2-procedural'))).padEnd(6)} files                          ║`);
  console.log(`║  L3 Semantic:    ${String(countFiles(join(MEMORY_ROOT, 'Memory/L3-semantic'))).padEnd(6)} files                          ║`);
  console.log(`║  Weekly Reviews: ${String(countFiles(join(MEMORY_ROOT, 'Meta/reviews/weekly'))).padEnd(6)} files                          ║`);
  console.log('║                                                          ║');
  
  // Dreams 运行状态
  console.log('║  🌙 Dreams Status                                        ║');
  console.log('║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║');
  console.log(`║  Last Daily:   ${getLastRun('daily').padEnd(40)}  ║`);
  console.log(`║  Last Weekly:  ${getLastRun('weekly').padEnd(40)}  ║`);
  console.log('║                                                          ║');
  
  // Git 状态
  const gitStatus = getGitStatus();
  console.log('║  🔄 Git Status                                           ║');
  console.log('║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║');
  if (gitStatus.length === 0) {
    console.log('║  ✅ All changes synced                                   ║');
  } else {
    console.log(`║  ⚠️  ${String(gitStatus.length).padEnd(3)} files pending sync                           ║`);
  }
  console.log('║                                                          ║');
  
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Commands:');
  console.log('  make daily    - Run daily dream');
  console.log('  make weekly   - Run weekly review');
  console.log('  make sync     - Sync to GitHub');
  console.log('');
}

printDashboard();
EOFMJS

chmod +x "$MEMORY_DIR/scripts/dream-dashboard.mjs"

# 3. 更新 Makefile 添加 dreams 命令
if ! grep -q "dream-dashboard" "$MEMORY_DIR/Makefile" 2>/dev/null; then
  cat >> "$MEMORY_DIR/Makefile" << 'EOF'

# Dreams commands
dreams-status:
	@node scripts/dream-dashboard.mjs

dreams-install:
	@node scripts/dream-scheduler.mjs install
EOF
fi

echo "✅ Worker 7 完成：Dreams 系统已完善"
echo ""
echo "新增组件:"
echo "  - dream-scheduler.mjs   : 统一调度器"
echo "  - dream-dashboard.mjs   : 状态看板"
echo ""
echo "使用方法:"
echo "  node scripts/dream-scheduler.mjs daily      - 运行每日 dream"
echo "  node scripts/dream-scheduler.mjs weekly     - 运行每周 dream"
echo "  make dreams-status                          - 查看状态看板"
echo "  node scripts/dream-scheduler.mjs install    - 显示 cron 配置"

# 提交变更
cd "$MEMORY_DIR"
git add scripts/dream-scheduler.mjs scripts/dream-dashboard.mjs Makefile 2>/dev/null || true
git commit -m "Enhance Dreams system

- Add dream-scheduler.mjs for unified scheduling
- Add dream-dashboard.mjs for status visualization
- Update Makefile with dreams commands" 2>/dev/null || true
git push origin master 2>/dev/null || true
