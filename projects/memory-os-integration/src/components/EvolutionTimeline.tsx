'use client';

import { motion } from 'framer-motion';
import { MemoryNode, formatDate } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Clock, ChevronRight } from 'lucide-react';

interface EvolutionTimelineProps {
  memories: MemoryNode[];
}

export function EvolutionTimeline({ memories }: EvolutionTimelineProps) {
  // Group memories by date
  const byDate = memories.reduce((acc, m) => {
    const date = m.created.slice(0, 10);
    acc[date] = acc[date] || [];
    acc[date].push(m);
    return acc;
  }, {} as Record<string, MemoryNode[]>);

  const sortedDates = Object.keys(byDate).sort().reverse();

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-violet-500 to-pink-500" />

      <div className="space-y-6">
        {sortedDates.slice(0, 10).map((date, index) => {
          const dayMemories = byDate[date];
          const hasMultiple = dayMemories.length > 1;

          return (
            <motion.div
              key={date}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative pl-10"
            >
              {/* Timeline Dot */}
              <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-blue-500" />

              {/* Date Header */}
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-300">
                  {formatDate(date)}
                </span>
                <span className="text-xs text-slate-500">
                  ({dayMemories.length} 条记忆)
                </span>
              </div>

              {/* Memory Items */}
              <div className="space-y-2">
                {dayMemories.slice(0, 3).map((memory) => (
                  <div
                    key={memory.id}
                    className="group flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <div
                      className="w-2 h-2 mt-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: getLevelColor(memory.level) }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">
                          {memory.level}
                        </span>
                        <span className="text-sm text-slate-300 truncate">
                          {memory.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {memory.content.slice(0, 100)}...
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                ))}
                {dayMemories.length > 3 && (
                  <div className="text-xs text-slate-500 pl-5">
                    +{dayMemories.length - 3} 更多...
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function getLevelColor(level: string): string {
  const colors: Record<string, string> = {
    L0: '#3b82f6',
    L1: '#06b6d4',
    L2: '#8b5cf6',
    L3: '#ec4899',
    L4: '#f59e0b',
    Intent: '#10b981',
    Meta: '#6b7280',
  };
  return colors[level] || '#6b7280';
}
