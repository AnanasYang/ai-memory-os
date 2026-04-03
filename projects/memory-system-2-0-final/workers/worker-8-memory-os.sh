#!/bin/bash
# Worker 8: Memory OS Web 界面完善
# 任务：完善 Memory OS Web 界面

set -e

echo "🖥️ Worker 8: 完善 Memory OS Web 界面..."

MEMORY_DIR="/home/bruce/.openclaw/workspace/ai-memory-system"
OS_DIR="$MEMORY_DIR/agent-os"

# 确保 agent-os 目录存在
mkdir -p "$OS_DIR"

# 1. 创建系统状态 API
cat > "$OS_DIR/lib/memory-api.ts" << 'EOFTS'
/**
 * Memory System API
 * 提供记忆系统的状态查询接口
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const MEMORY_ROOT = process.env.MEMORY_ROOT || '/home/bruce/.openclaw/workspace/ai-memory-system';

export interface MemoryStats {
  l1Count: number;
  l2Count: number;
  l3Count: number;
  l4Count: number;
  weeklyReviews: number;
  lastSync: string;
  syncStatus: 'synced' | 'pending' | 'error';
}

export interface DreamStatus {
  lastDaily: string;
  lastWeekly: string;
  pendingReviews: string[];
}

export function getMemoryStats(): MemoryStats {
  const l1Dir = join(MEMORY_ROOT, 'Memory', 'L1-episodic');
  const l2Dir = join(MEMORY_ROOT, 'Memory', 'L2-procedural');
  const l3Dir = join(MEMORY_ROOT, 'Memory', 'L3-semantic');
  const l4Dir = join(MEMORY_ROOT, 'Memory', 'L4-core');
  const weeklyDir = join(MEMORY_ROOT, 'Meta', 'reviews', 'weekly');
  
  const countFiles = (dir: string) => {
    if (!existsSync(dir)) return 0;
    return readdirSync(dir).filter(f => f.endsWith('.md')).length;
  };
  
  // 读取最后同步时间
  let lastSync = 'Never';
  let syncStatus: MemoryStats['syncStatus'] = 'synced';
  
  try {
    const syncLog = join(MEMORY_ROOT, '.sync.log');
    if (existsSync(syncLog)) {
      const lines = readFileSync(syncLog, 'utf-8').split('\n').filter(l => l);
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        lastSync = lastLine.split(':')[0] || 'Unknown';
      }
    }
    
    // 检查是否有未提交的变更
    const { execSync } = require('child_process');
    const status = execSync('git status --short', { cwd: MEMORY_ROOT, encoding: 'utf-8' });
    if (status.trim()) {
      syncStatus = 'pending';
    }
  } catch {
    syncStatus = 'error';
  }
  
  return {
    l1Count: countFiles(l1Dir),
    l2Count: countFiles(l2Dir),
    l3Count: countFiles(l3Dir),
    l4Count: countFiles(l4Dir),
    weeklyReviews: countFiles(weeklyDir),
    lastSync,
    syncStatus
  };
}

export function getDreamStatus(): DreamStatus {
  const dreamsLog = join(MEMORY_ROOT, '.dreams.log');
  let lastDaily = 'Never';
  let lastWeekly = 'Never';
  
  if (existsSync(dreamsLog)) {
    const content = readFileSync(dreamsLog, 'utf-8');
    const lines = content.split('\n').filter(l => l);
    
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('daily') && lastDaily === 'Never') {
        const match = lines[i].match(/\[(.*?)\]/);
        if (match) lastDaily = match[1];
      }
      if (lines[i].includes('weekly') && lastWeekly === 'Never') {
        const match = lines[i].match(/\[(.*?)\]/);
        if (match) lastWeekly = match[1];
      }
    }
  }
  
  // 获取待 review 的 L2
  const l2Dir = join(MEMORY_ROOT, 'Memory', 'L2-procedural');
  const pendingReviews: string[] = [];
  
  if (existsSync(l2Dir)) {
    const files = readdirSync(l2Dir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(join(l2Dir, file), 'utf-8');
      if (content.includes('review_status: pending')) {
        pendingReviews.push(file.replace('.md', ''));
      }
    }
  }
  
  return { lastDaily, lastWeekly, pendingReviews };
}
EOFTS

# 2. 创建状态页面组件
mkdir -p "$OS_DIR/components/dashboard"

cat > "$OS_DIR/components/dashboard/stats-card.tsx" << 'EOFTS'
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatsCard({ title, value, subtitle, trend }: StatsCardProps) {
  const trendColor = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-gray-500'
  }[trend || 'neutral'];
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className={`text-xs ${trendColor}`}>{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
EOFTS

cat > "$OS_DIR/components/dashboard/sync-status.tsx" << 'EOFTS'
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface SyncStatusProps {
  status: 'synced' | 'pending' | 'error';
  lastSync: string;
}

export function SyncStatus({ status, lastSync }: SyncStatusProps) {
  const config = {
    synced: { icon: CheckCircle, color: 'text-green-500', text: '已同步' },
    pending: { icon: RefreshCw, color: 'text-yellow-500', text: '待同步' },
    error: { icon: AlertCircle, color: 'text-red-500', text: '同步错误' }
  }[status];
  
  const Icon = config.icon;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">同步状态</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.color}`} />
          <span className="font-medium">{config.text}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">最后同步: {lastSync}</p>
      </CardContent>
    </Card>
  );
}
EOFTS

# 3. 更新主页显示状态
cat > "$OS_DIR/app/page.tsx" << 'EOFTS'
import { Suspense } from 'react';
import { getMemoryStats, getDreamStatus } from '@/lib/memory-api';
import { StatsCard } from '@/components/dashboard/stats-card';
import { SyncStatus } from '@/components/dashboard/sync-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const stats = getMemoryStats();
  const dreams = getDreamStatus();
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Memory System 2.0</h1>
          <p className="text-gray-500">AI 记忆系统状态看板</p>
        </div>
        <div className="text-sm text-gray-400">
          最后更新: {new Date().toLocaleString()}
        </div>
      </div>
      
      {/* 记忆统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="L1 情境记忆" value={stats.l1Count} subtitle="近期对话摘要" />
        <StatsCard title="L2 行为模式" value={stats.l2Count} subtitle="习惯与偏好" />
        <StatsCard title="L3 认知框架" value={stats.l3Count} subtitle="思维模式" />
        <StatsCard title="L4 核心价值观" value={stats.l4Count} subtitle="身份认同" />
        <StatsCard title="每周复盘" value={stats.weeklyReviews} subtitle="历史记录" />
      </div>
      
      {/* 系统状态 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SyncStatus status={stats.syncStatus} lastSync={stats.lastSync} />
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Dreams 状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">上次 Daily:</span>
              <span className="text-sm font-medium">{dreams.lastDaily}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">上次 Weekly:</span>
              <span className="text-sm font-medium">{dreams.lastWeekly}</span>
            </div>
            {dreams.pendingReviews.length > 0 && (
              <div className="pt-2 border-t">
                <span className="text-sm text-yellow-600">
                  ⚠️ {dreams.pendingReviews.length} 个待 review 项目
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <a 
              href="/review" 
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              查看 Review
            </a>
            <button 
              onClick={() => fetch('/api/sync', { method: 'POST' })}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              立即同步
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
EOFTS

# 4. 创建 API 路由（如果 Next.js 支持）
mkdir -p "$OS_DIR/app/api/sync"

cat > "$OS_DIR/app/api/sync/route.ts" << 'EOFTS'
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST() {
  try {
    const MEMORY_ROOT = process.env.MEMORY_ROOT || '/home/bruce/.openclaw/workspace/ai-memory-system';
    
    execSync('make sync', { 
      cwd: MEMORY_ROOT,
      timeout: 30000 
    });
    
    return NextResponse.json({ success: true, message: 'Sync completed' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
EOFTS

echo "✅ Worker 8 完成：Memory OS Web 界面已完善"
echo ""
echo "更新组件:"
echo "  - lib/memory-api.ts              : 系统状态 API"
echo "  - components/dashboard/*         : 状态卡片组件"
echo "  - app/page.tsx                   : 主页看板"
echo "  - app/api/sync/route.ts          : 同步 API"
echo ""
echo "启动 Memory OS:"
echo "  cd agent-os && npm run dev"

# 提交变更
cd "$MEMORY_DIR"
git add agent-os/ 2>/dev/null || true
git commit -m "Enhance Memory OS Web UI

- Add memory-api for system status queries
- Add dashboard components
- Update homepage with stats view
- Add sync API endpoint" 2>/dev/null || true
git push origin master 2>/dev/null || true
