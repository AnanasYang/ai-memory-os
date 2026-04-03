'use client';

import { motion } from 'framer-motion';
import { MemoryNode, LAYER_CONFIG, LayerKey } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MemoryGalaxyProps {
  memories: MemoryNode[];
  onNodeClick?: (node: MemoryNode) => void;
}

export function MemoryGalaxy({ memories, onNodeClick }: MemoryGalaxyProps) {
  const layerCounts = memories.reduce((acc, m) => {
    acc[m.level] = (acc[m.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const layers: LayerKey[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'Intent', 'Meta'];

  return (
    <div className="relative w-full h-[600px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }} />
      </div>

      {/* Central Core */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      >
        <div className="relative w-32 h-32">
          {layers.map((layer, i) => {
            const config = LAYER_CONFIG[layer];
            const count = layerCounts[layer] || 0;
            const radius = 60 + i * 35;
            
            return (
              <motion.div
                key={layer}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed"
                style={{
                  width: radius * 2,
                  height: radius * 2,
                  borderColor: config.color,
                  opacity: count > 0 ? 0.6 : 0.2,
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 30 + i * 10, repeat: Infinity, ease: 'linear' }}
              >
                {/* Layer Label */}
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: config.color, color: '#fff' }}
                >
                  {layer}
                </div>
                
                {/* Memory Nodes */}
                {memories
                  .filter((m) => m.level === layer)
                  .slice(0, 8)
                  .map((memory, j) => {
                    const angle = (j / Math.min(count, 8)) * 2 * Math.PI;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    
                    return (
                      <motion.div
                        key={memory.id}
                        className={cn(
                          'absolute w-3 h-3 rounded-full cursor-pointer',
                          'hover:scale-150 transition-transform'
                        )}
                        style={{
                          backgroundColor: config.color,
                          left: `calc(50% + ${x}px - 6px)`,
                          top: `calc(50% + ${y}px - 6px)`,
                        }}
                        onClick={() => onNodeClick?.(memory)}
                        whileHover={{ scale: 1.5 }}
                        title={memory.title}
                      />
                    );
                  })}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Center Hub */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-white font-bold text-lg">AI</span>
      </motion.div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 flex flex-wrap gap-2 max-w-xs">
        {layers.map((layer) => {
          const config = LAYER_CONFIG[layer];
          const count = layerCounts[layer] || 0;
          
          return (
            <div
              key={layer}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800/80 text-xs"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-slate-300">{config.nameZh}</span>
              <span className="text-slate-500">({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
