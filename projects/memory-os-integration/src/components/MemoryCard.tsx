'use client';

import { motion } from 'framer-motion';
import { MemoryNode, LAYER_CONFIG, LayerKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Tag,
  Shield,
  AlertCircle,
  CheckCircle,
  MinusCircle,
} from 'lucide-react';

interface MemoryCardProps {
  memory: MemoryNode;
  onClick?: () => void;
  compact?: boolean;
}

const confidenceIcons = {
  high: CheckCircle,
  medium: MinusCircle,
  low: AlertCircle,
};

export function MemoryCard({ memory, onClick, compact }: MemoryCardProps) {
  const config = LAYER_CONFIG[memory.level as LayerKey];
  const ConfidenceIcon = confidenceIcons[memory.confidence];

  if (compact) {
    return (
      <motion.div
        className={cn(
          'group p-3 rounded-lg border cursor-pointer',
          'bg-slate-800/50 border-slate-700/50',
          'hover:bg-slate-800 hover:border-slate-600',
          'transition-all duration-200'
        )}
        onClick={onClick}
        whileHover={{ y: -2 }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-2 h-2 mt-1.5 rounded-full shrink-0"
            style={{ backgroundColor: config.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                {memory.level}
              </span>
              <h3 className="text-sm font-medium text-slate-200 truncate">
                {memory.title}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">
              {memory.content.slice(0, 60)}...
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        'group p-4 rounded-xl border cursor-pointer',
        'bg-slate-800/50 border-slate-700/50',
        'hover:bg-slate-800 hover:border-slate-600',
        'transition-all duration-200'
      )}
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {memory.level}
          </span>
          <span className="text-xs text-slate-500">{memory.category}</span>
        </div>
        <ConfidenceIcon
          className={cn(
            'w-4 h-4',
            memory.confidence === 'high' && 'text-green-400',
            memory.confidence === 'medium' && 'text-yellow-400',
            memory.confidence === 'low' && 'text-red-400'
          )}
        />
      </div>

      {/* Content */}
      <h3 className="text-base font-semibold text-slate-100 mb-2">
        {memory.title}
      </h3>
      <p className="text-sm text-slate-400 line-clamp-3 mb-3">
        {memory.content.slice(0, 200)}...
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {memory.updated}
          </span>
          {memory.tags.length > 0 && (
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {memory.tags.slice(0, 3).join(', ')}
            </span>
          )}
        </div>
        <span className="text-slate-600">{memory.source}</span>
      </div>
    </motion.div>
  );
}
