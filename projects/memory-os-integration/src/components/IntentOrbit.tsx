'use client';

import { motion } from 'framer-motion';
import { MemoryNode, LAYER_CONFIG } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Target,
  Heart,
  Shield,
  Zap,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface IntentOrbitProps {
  memories: MemoryNode[];
}

const intentIcons: Record<string, typeof Target> = {
  goals: Target,
  preferences: Heart,
  boundaries: Shield,
  default: Zap,
};

export function IntentOrbit({ memories }: IntentOrbitProps) {
  const intentMemories = memories.filter((m) => m.level === 'Intent');
  
  // Group by category
  const byCategory = intentMemories.reduce((acc, m) => {
    const cat = m.category || 'default';
    acc[cat] = acc[cat] || [];
    acc[cat].push(m);
    return acc;
  }, {} as Record<string, MemoryNode[]>);

  const categories = Object.keys(byCategory);

  if (intentMemories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Target className="w-12 h-12 mb-4 opacity-50" />
        <p>暂无活跃意图</p>
      </div>
    );
  }

  return (
    <div className="relative h-[400px]">
      {/* Center */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        <div className="relative w-64 h-64">
          {/* Orbit Rings */}
          {categories.map((cat, i) => {
            const items = byCategory[cat];
            const Icon = intentIcons[cat] || intentIcons.default;
            const radius = 80 + i * 30;
            
            return (
              <motion.div
                key={cat}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/30"
                style={{
                  width: radius * 2,
                  height: radius * 2,
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 20 + i * 5, repeat: Infinity, ease: 'linear' }}
              >
                {items.map((item, j) => {
                  const angle = (j / items.length) * 2 * Math.PI;
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;
                  
                  return (
                    <motion.div
                      key={item.id}
                      className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full bg-slate-800 border border-emerald-500/50 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                      style={{
                        left: `calc(50% + ${x}px)`,
                        top: `calc(50% + ${y}px)`,
                      }}
                      whileHover={{ scale: 1.2 }}
                      title={item.title}
                    >
                      <Icon className="w-4 h-4 text-emerald-400" />
                    </motion.div>
                  );
                })}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Center Hub */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
        <Target className="w-8 h-8 text-white" />
      </div>

      {/* Legend */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-wrap justify-center gap-4">
        {categories.map((cat) => {
          const Icon = intentIcons[cat] || intentIcons.default;
          return (
            <div key={cat} className="flex items-center gap-2 text-sm text-slate-400">
              <Icon className="w-4 h-4 text-emerald-400" />
              <span className="capitalize">{cat}</span>
              <span className="text-slate-600">({byCategory[cat].length})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
