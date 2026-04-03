/**
 * Memory OS Utils
 * 工具函数 - 数据生成、格式化、计算
 */

import type {
  Memory,
  MemoryLevel,
  MemoryNode,
  Galaxy,
  Intent,
  EvolutionEvent,
  Insight,
  L0Stream,
  L0Event,
  WeeklyReport,
} from '../types';

// ==================== ID 生成器 ====================

export const generateId = (prefix: string = ''): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${prefix ? '_' : ''}${timestamp}_${random}`;
};

// ==================== 时间格式化 ====================

export const formatDate = (timestamp: number, format: 'short' | 'long' | 'relative' = 'short'): string => {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;
  
  if (format === 'relative') {
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    if (days < 30) return `${Math.floor(days / 7)}周前`;
  }
  
  if (format === 'long') {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
};

export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}天 ${hours % 24}小时`;
  if (hours > 0) return `${hours}小时 ${minutes % 60}分`;
  if (minutes > 0) return `${minutes}分钟`;
  return `${seconds}秒`;
};

// ==================== 颜色工具 ====================

export const LEVEL_COLORS: Record<MemoryLevel, string> = {
  L0: '#64748b', // slate-500
  L1: '#3b82f6', // blue-500
  L2: '#8b5cf6', // violet-500
  L3: '#f59e0b', // amber-500
  L4: '#ef4444', // red-500
};

export const GALAXY_COLORS: Record<string, string> = {
  work: '#3b82f6',
  personal: '#10b981',
  learning: '#f59e0b',
  project: '#8b5cf6',
  default: '#64748b',
};

export const hexToRgba = (hex: string, alpha: number = 1): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const interpolateColor = (color1: string, color2: string, factor: number): string => {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// ==================== 数学工具 ====================

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

export const randomRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

export const sphericalToCartesian = (
  radius: number,
  theta: number,
  phi: number
): { x: number; y: number; z: number } => {
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.sin(phi) * Math.sin(theta),
    z: radius * Math.cos(phi),
  };
};

// ==================== 计算晋升分数 ====================

export const calculatePromotionScore = (memory: Memory): number => {
  const now = Date.now();
  const age = now - memory.timestamp;
  const daysSinceCreated = age / 86400000;
  
  let score = memory.confidence;
  
  // 时间衰减 - 越久越稳定
  const timeBonus = Math.min(daysSinceCreated / 30, 1) * 0.2;
  score += timeBonus;
  
  // 连接数量加分
  const connectionBonus = Math.min(memory.connections.length / 5, 0.3);
  score += connectionBonus;
  
  // 审查状态调整
  if (memory.reviewStatus === 'reviewed') score += 0.1;
  if (memory.reviewStatus === 'promoted') score += 0.05;
  
  return clamp(score, 0, 1);
};

// ==================== 生成模拟数据 ====================

export const generateMockMemories = (count: number = 50): Memory[] => {
  const categories = ['work', 'personal', 'learning', 'project'];
  const sources = ['conversation', 'observation', 'manual', 'import'];
  const levels: MemoryLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];
  
  return Array.from({ length: count }, (_, i) => {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const timestamp = Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000;
    
    const memory: Memory = {
      id: generateId('mem'),
      content: `记忆内容示例 #${i + 1} - ${category}相关的${level}层记忆`,
      level,
      source: sources[Math.floor(Math.random() * sources.length)],
      timestamp,
      category,
      tags: [category, level.toLowerCase(), `tag${i % 10}`],
      confidence: randomRange(0.5, 0.95),
      reviewStatus: ['pending', 'reviewed', 'promoted'][Math.floor(Math.random() * 3)] as any,
      lastReviewedAt: Math.random() > 0.5 ? timestamp + 86400000 : undefined,
      connections: [],
      metadata: {
        priority: Math.random() > 0.7 ? 'high' : 'normal',
        sentiment: Math.random() > 0.5 ? 'positive' : 'neutral',
      },
    };
    
    memory.promotionScore = calculatePromotionScore(memory);
    return memory;
  });
};

export const generateMockGalaxies = (memories: Memory[]): Galaxy[] => {
  const categories = [...new Set(memories.map(m => m.category || 'default'))];
  
  return categories.map((category, i) => {
    const categoryMemories = memories.filter(m => m.category === category);
    const nodes: MemoryNode[] = categoryMemories.map((memory, j) => {
      const angle = (j / categoryMemories.length) * Math.PI * 2;
      const radius = 50 + Math.random() * 100;
      
      return {
        id: memory.id,
        memory,
        x: 0,
        y: 0,
        z: 0,
        size: 5 + memory.confidence * 10,
        color: LEVEL_COLORS[memory.level],
        galaxy: category,
        orbit: {
          angle,
          radius,
          speed: 0.001 + Math.random() * 0.002,
          tilt: Math.random() * 0.5 - 0.25,
        },
      };
    });
    
    return {
      id: generateId('galaxy'),
      name: category.charAt(0).toUpperCase() + category.slice(1),
      category,
      description: `${category} 分类的记忆星系`,
      center: {
        x: Math.cos((i / categories.length) * Math.PI * 2) * 300,
        y: Math.sin((i / categories.length) * Math.PI * 2) * 300,
        z: randomRange(-100, 100),
      },
      color: GALAXY_COLORS[category] || GALAXY_COLORS.default,
      nodes,
      stats: {
        total: nodes.length,
        byLevel: nodes.reduce((acc, n) => {
          acc[n.memory.level] = (acc[n.memory.level] || 0) + 1;
          return acc;
        }, {} as Record<MemoryLevel, number>),
        promotionsPending: nodes.filter(n => (n.memory.promotionScore || 0) > 0.7).length,
      },
    };
  });
};

export const generateMockIntents = (memories: Memory[]): Intent[] => {
  const intents = [
    { title: '提升AI记忆系统稳定性', category: 'technical' },
    { title: '学习React高级模式', category: 'learning' },
    { title: '优化工作流自动化', category: 'productivity' },
    { title: '建立个人知识库', category: 'personal' },
  ];
  
  return intents.map((intent, i) => ({
    id: generateId('intent'),
    title: intent.title,
    description: `这是关于${intent.title}的目标描述`,
    status: ['active', 'active', 'paused', 'completed'][Math.floor(Math.random() * 4)] as any,
    priority: ['critical', 'high', 'medium', 'medium'][Math.floor(Math.random() * 4)] as any,
    createdAt: Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000,
    targetDate: Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000,
    progress: Math.random() * 100,
    category: intent.category,
    relatedMemories: memories
      .filter(() => Math.random() > 0.7)
      .slice(0, 5)
      .map(m => m.id),
    milestones: [
      {
        id: generateId('milestone'),
        title: '第一阶段：需求分析',
        description: '完成需求收集和分析',
        status: 'completed',
        completedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        relatedMemories: [],
      },
      {
        id: generateId('milestone'),
        title: '第二阶段：原型开发',
        description: '完成功能原型',
        status: 'in_progress',
        dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        relatedMemories: [],
      },
      {
        id: generateId('milestone'),
        title: '第三阶段：测试验证',
        description: '完成功能测试',
        status: 'pending',
        dueDate: Date.now() + 20 * 24 * 60 * 60 * 1000,
        relatedMemories: [],
      },
    ],
    metrics: {
      memoryCount: Math.floor(Math.random() * 20) + 5,
      lastActivity: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      velocity: Math.random() * 5 + 1,
      health: Math.random() * 30 + 70,
    },
  }));
};

export const generateMockEvolutionEvents = (memories: Memory[]): EvolutionEvent[] => {
  const events: EvolutionEvent[] = [];
  const types: EvolutionEvent['type'][] = ['promotion', 'creation', 'archival', 'merge'];
  
  memories.slice(0, 20).forEach(memory => {
    events.push({
      id: generateId('event'),
      timestamp: memory.timestamp,
      type: 'creation',
      memoryId: memory.id,
      toLevel: memory.level,
      description: `创建 ${memory.level} 记忆`,
      relatedIds: [],
      metadata: {},
    });
    
    if (memory.reviewStatus === 'promoted' && memory.level !== 'L0') {
      const levels: MemoryLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];
      const currentIdx = levels.indexOf(memory.level);
      if (currentIdx > 0) {
        events.push({
          id: generateId('event'),
          timestamp: memory.timestamp + 7 * 24 * 60 * 60 * 1000,
          type: 'promotion',
          memoryId: memory.id,
          fromLevel: levels[currentIdx - 1],
          toLevel: memory.level,
          description: `从 ${levels[currentIdx - 1]} 晋升到 ${memory.level}`,
          relatedIds: [],
          metadata: { score: memory.promotionScore },
        });
      }
    }
  });
  
  return events.sort((a, b) => b.timestamp - a.timestamp);
};

export const generateMockInsights = (memories: Memory[]): Insight[] => {
  return [
    {
      id: generateId('insight'),
      type: 'conflict',
      severity: 'warning',
      title: '检测到潜在冲突',
      description: '发现两个记忆对同一主题有不同描述',
      relatedMemoryIds: memories.slice(0, 2).map(m => m.id),
      detectedAt: Date.now() - 3600000,
      action: {
        type: 'review',
        label: '查看详情',
      },
      status: 'active',
    },
    {
      id: generateId('insight'),
      type: 'reminder',
      severity: 'info',
      title: '晋升候选提醒',
      description: `发现 ${memories.filter(m => (m.promotionScore || 0) > 0.8).length} 个记忆达到晋升标准`,
      relatedMemoryIds: memories
        .filter(m => (m.promotionScore || 0) > 0.8)
        .slice(0, 5)
        .map(m => m.id),
      detectedAt: Date.now() - 7200000,
      action: {
        type: 'promote',
        label: '批量晋升',
      },
      status: 'active',
    },
    {
      id: generateId('insight'),
      type: 'pattern',
      severity: 'info',
      title: '发现新的行为模式',
      description: '检测到最近一周工作时间模式变化',
      relatedMemoryIds: [],
      detectedAt: Date.now() - 86400000,
      status: 'active',
    },
    {
      id: generateId('insight'),
      type: 'suggestion',
      severity: 'warning',
      title: '建议归档旧记忆',
      description: '检测到 10 个超过 30 天未访问的 L1 记忆',
      relatedMemoryIds: memories.slice(10, 15).map(m => m.id),
      detectedAt: Date.now() - 172800000,
      action: {
        type: 'archive',
        label: '批量归档',
      },
      status: 'active',
    },
  ];
};

export const generateMockL0Stats = (): { streams: L0Stream[]; recentEvents: L0Event[] } => {
  const streamTypes: L0Stream['type'][] = ['conversation', 'observation', 'system', 'external'];
  
  const streams: L0Stream[] = streamTypes.map((type, i) => ({
    id: generateId('stream'),
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} Stream`,
    type,
    status: Math.random() > 0.2 ? 'active' : 'paused',
    lastEventAt: Date.now() - Math.random() * 60000,
    eventCount: Math.floor(Math.random() * 10000) + 1000,
    rate: Math.random() * 10 + 1,
  }));
  
  const recentEvents: L0Event[] = Array.from({ length: 20 }, (_, i) => {
    const stream = streams[Math.floor(Math.random() * streams.length)];
    return {
      id: generateId('l0'),
      streamId: stream.id,
      timestamp: Date.now() - i * 5000,
      type: ['input', 'output', 'context', 'action'][Math.floor(Math.random() * 4)] as any,
      content: `L0事件内容示例 #${i + 1}`,
      processed: i > 5,
      extractedMemories: Math.random() > 0.7 ? [generateId('mem')] : [],
      metadata: {},
    };
  });
  
  return { streams, recentEvents };
};

// ==================== 统计计算 ====================

export const calculateWeeklyReport = (memories: Memory[]): WeeklyReport => {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  
  const weeklyMemories = memories.filter(m => m.timestamp >= weekAgo);
  const promoted = memories.filter(m => 
    m.reviewStatus === 'promoted' && m.lastReviewedAt && m.lastReviewedAt >= weekAgo
  );
  
  return {
    period: { start: weekAgo, end: now },
    newMemories: weeklyMemories.length,
    promotions: promoted.length,
    activeIntents: 4, // mock
    insightsGenerated: 6, // mock
    highlights: weeklyMemories
      .filter(() => Math.random() > 0.7)
      .slice(0, 5)
      .map(m => ({
        memory: m,
        reason: ['promoted', 'high_confidence', 'trending', 'user_flagged'][Math.floor(Math.random() * 4)] as any,
        engagement: Math.random() * 100,
      })),
  };
};
