'use client';

import { Header } from '@/components/Header';
import { StatsCards } from '@/components/StatsCards';
import { MemoryGalaxy } from '@/components/MemoryGalaxy';
import { EvolutionTimeline } from '@/components/EvolutionTimeline';
import { IntentOrbit } from '@/components/IntentOrbit';
import { MemoryCard } from '@/components/MemoryCard';
import { Sparkles, Activity, Target, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MemoryNode, MemoryStats } from '@/lib/types';

// 静态数据
const staticMemories: MemoryNode[] = [
  {
    id: 'l4-identity',
    level: 'L4',
    category: 'core-identity',
    title: '核心身份',
    content: '# 核心身份\n\n**重要：本层只能由 Bruce 人工修改，AI 不能自动更新。**',
    created: '2026-03-05',
    updated: '2026-03-05',
    source: '用户声明',
    confidence: 'high',
    status: 'active',
    path: 'Memory/L4-core/identity.md',
    tags: ['identity', 'core', 'L4'],
  },
  {
    id: 'intent-tools',
    level: 'Intent',
    category: 'preferences',
    title: '工具偏好',
    content: '# 工具偏好\n\n- Feishu - 协作沟通\n- GitHub - 代码托管',
    created: '2026-03-05',
    updated: '2026-03-05',
    source: '用户声明',
    confidence: 'high',
    status: 'active',
    path: 'Intent/preferences/tools.md',
    tags: ['tools', 'preferences'],
  },
  {
    id: 'intent-communication',
    level: 'Intent',
    category: 'communication',
    title: '沟通风格偏好',
    content: '# 沟通风格偏好\n\n## 偏好\n\n- 简洁直接\n- 技术准确',
    created: '2026-03-05',
    updated: '2026-04-03',
    source: '对话观察',
    confidence: 'high',
    status: 'active',
    path: 'Intent/preferences/communication/style.md',
    tags: ['communication', 'preferences'],
  },
  {
    id: 'meta-review-2026-03',
    level: 'Meta',
    category: 'review',
    title: '2026年3月L2复盘',
    content: '# L2 行为层复盘\n\n## 本月发现的模式',
    created: '2026-03-31',
    updated: '2026-03-31',
    source: 'review',
    confidence: 'medium',
    status: 'active',
    path: 'Meta/reviews/monthly/2026-03-L2-review.md',
    tags: ['review', 'L2', 'monthly'],
  },
];

const staticStats: MemoryStats = {
  total: 4,
  byLevel: { L0: 0, L1: 0, L2: 0, L3: 0, L4: 1, Intent: 2, Meta: 1 },
  byCategory: { 'core-identity': 1, preferences: 1, review: 1, communication: 1 },
  recentUpdates: staticMemories,
  evolution: [
    { date: '2026-03-05', count: 2 },
    { date: '2026-03-31', count: 1 },
    { date: '2026-04-03', count: 1 },
  ],
};

export default function HomePage() {
  const [memories, setMemories] = useState<MemoryNode[]>(staticMemories);
  const [stats, setStats] = useState<MemoryStats>(staticStats);

  useEffect(() => {
    // 客户端可以动态加载数据
    fetch('/data/memories.json')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setMemories(data);
        }
      })
      .catch(() => {
        // 使用静态数据
      });

    fetch('/data/stats.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.total > 0) {
          setStats(data);
        }
      })
      .catch(() => {
        // 使用静态数据
      });
  }, []);

  const recentMemories = [...memories]
    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">
              AI Memory OS
            </h1>
          </div>
          <p className="text-slate-400 text-lg max-w-2xl">
            基于 5 层记忆架构 + Intent 轨道 + Meta 元数据的智能可视化系统
          </p>
        </section>

        {/* Stats Cards */}
        <section className="mb-12">
          <StatsCards stats={stats} />
        </section>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Memory Galaxy */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-semibold text-slate-100">Memory Galaxy</h2>
            </div>
            <MemoryGalaxy memories={memories} />
          </section>

          {/* Intent Orbit */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-500" />
              <h2 className="text-xl font-semibold text-slate-100">Intent Orbit</h2>
            </div>
            <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-4">
              <IntentOrbit memories={memories} />
            </div>
          </section>
        </div>

        {/* Evolution Timeline */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-violet-500" />
            <h2 className="text-xl font-semibold text-slate-100">Evolution Timeline</h2>
          </div>
          <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-6">
            <EvolutionTimeline memories={memories} />
          </div>
        </section>

        {/* Recent Memories */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-100">最近更新</h2>
            <a
              href="/memories/"
              className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
            >
              查看全部 →
            </a>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentMemories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} compact />
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-slate-500 text-sm">
          <p>AI Memory OS © 2026 | 基于 Next.js + Tailwind CSS 构建</p>
          <p className="mt-2">
            数据同步时间: {new Date().toLocaleString('zh-CN')}
          </p>
        </div>
      </footer>
    </div>
  );
}