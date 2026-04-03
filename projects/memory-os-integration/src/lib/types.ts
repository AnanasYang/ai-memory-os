// Memory Data Models
export interface MemoryNode {
  id: string;
  level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'Intent' | 'Meta';
  category: string;
  title: string;
  content: string;
  created: string;
  updated: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  reviewed?: string;
  status?: string;
  path: string;
  tags: string[];
}

export interface MemoryStats {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  recentUpdates: MemoryNode[];
  evolution: { date: string; count: number }[];
}

export interface IntentItem {
  id: string;
  type: 'goal' | 'preference' | 'boundary';
  timeframe?: 'short' | 'mid' | 'long';
  title: string;
  content: string;
  priority: number;
  active: boolean;
}

export interface EvolutionEvent {
  date: string;
  type: 'L1' | 'L2' | 'L3' | 'L4';
  count: number;
  description: string;
}

// Layer Configuration
export const LAYER_CONFIG = {
  L0: {
    name: 'State Layer',
    nameZh: '状态层',
    color: '#3b82f6',
    bgColor: 'bg-blue-500',
    description: 'Current session context',
    reviewCycle: 'Real-time',
  },
  L1: {
    name: 'Episodic Layer',
    nameZh: '情境层',
    color: '#06b6d4',
    bgColor: 'bg-cyan-500',
    description: 'Recent conversation summaries',
    reviewCycle: 'Weekly',
  },
  L2: {
    name: 'Procedural Layer',
    nameZh: '行为层',
    color: '#8b5cf6',
    bgColor: 'bg-violet-500',
    description: 'Habits and preferences',
    reviewCycle: 'Monthly',
  },
  L3: {
    name: 'Semantic Layer',
    nameZh: '认知层',
    color: '#ec4899',
    bgColor: 'bg-pink-500',
    description: 'Thinking patterns',
    reviewCycle: 'Quarterly',
  },
  L4: {
    name: 'Core Layer',
    nameZh: '核心层',
    color: '#f59e0b',
    bgColor: 'bg-amber-500',
    description: 'Values and identity',
    reviewCycle: 'Yearly',
  },
  Intent: {
    name: 'Intent Track',
    nameZh: '意图轨道',
    color: '#10b981',
    bgColor: 'bg-emerald-500',
    description: 'Active intentions',
    reviewCycle: 'Continuous',
  },
  Meta: {
    name: 'Meta Layer',
    nameZh: '元数据层',
    color: '#6b7280',
    bgColor: 'bg-gray-500',
    description: 'System metadata',
    reviewCycle: 'Event-based',
  },
} as const;

export type LayerKey = keyof typeof LAYER_CONFIG;

// Helper functions
export function getLayerColor(level: LayerKey): string {
  return LAYER_CONFIG[level]?.color || '#6b7280';
}

export function getLayerName(level: LayerKey): string {
  return LAYER_CONFIG[level]?.name || level;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    result[groupKey] = result[groupKey] || [];
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function sortByDate<T extends { updated: string }>(
  items: T[],
  order: 'asc' | 'desc' = 'desc'
): T[] {
  return [...items].sort((a, b) => {
    const diff = new Date(a.updated).getTime() - new Date(b.updated).getTime();
    return order === 'asc' ? diff : -diff;
  });
}