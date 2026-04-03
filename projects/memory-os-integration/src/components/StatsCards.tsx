'use client';

import { motion } from 'framer-motion';
import { MemoryStats, LAYER_CONFIG, LayerKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Layers,
  Clock,
  RefreshCw,
  Activity,
  Target,
  FileText,
} from 'lucide-react';

interface StatsCardsProps {
  stats: MemoryStats;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: '总记忆数',
      value: stats.total,
      icon: Layers,
      color: 'from-blue-500 to-cyan-500',
      description: '所有层级记忆总数',
    },
    {
      title: '活跃 L1',
      value: stats.byLevel['L1'] || 0,
      icon: Clock,
      color: 'from-cyan-500 to-teal-500',
      description: '近期情境记忆',
    },
    {
      title: '行为模式',
      value: stats.byLevel['L2'] || 0,
      icon: RefreshCw,
      color: 'from-violet-500 to-purple-500',
      description: '已沉淀的行为习惯',
    },
    {
      title: '认知框架',
      value: stats.byLevel['L3'] || 0,
      icon: Activity,
      color: 'from-pink-500 to-rose-500',
      description: '思维模式与知识',
    },
    {
      title: '核心身份',
      value: stats.byLevel['L4'] || 0,
      icon: Target,
      color: 'from-amber-500 to-orange-500',
      description: '价值观与身份认同',
    },
    {
      title: '活跃意图',
      value: stats.byLevel['Intent'] || 0,
      icon: FileText,
      color: 'from-emerald-500 to-green-500',
      description: '当前追踪的意图',
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {cards.map((card) => (
        <motion.div
          key={card.title}
          variants={itemVariants}
          className={cn(
            'relative overflow-hidden rounded-xl p-4',
            'bg-gradient-to-br border border-white/10',
            'hover:scale-[1.02] transition-transform cursor-pointer',
            card.color
          )}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <card.icon className="w-5 h-5 text-white/80" />
              <span className="text-xs text-white/60">{card.description}</span>
            </div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
            <div className="text-sm text-white/80">{card.title}</div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
