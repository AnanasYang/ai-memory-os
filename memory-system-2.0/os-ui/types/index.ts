/**
 * Memory OS UI Types
 * 核心类型定义 - 基于真实数据结构
 */

// ==================== Memory Layer Types ====================

export type MemoryLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface Memory {
  id: string;
  content: string;
  level: MemoryLevel;
  source: string;
  timestamp: number;
  category?: string;
  tags: string[];
  confidence: number; // 0-1
  promotionScore?: number; // 晋升分数
  reviewStatus: 'pending' | 'reviewed' | 'promoted' | 'archived';
  lastReviewedAt?: number;
  connections: string[]; // 关联的 memory IDs
  metadata: Record<string, any>;
}

export interface MemoryNode {
  id: string;
  memory: Memory;
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  galaxy: string;
  orbit: {
    angle: number;
    radius: number;
    speed: number;
    tilt: number;
  };
}

// ==================== Galaxy Types ====================

export interface Galaxy {
  id: string;
  name: string;
  category: string;
  description: string;
  center: { x: number; y: number; z: number };
  color: string;
  nodes: MemoryNode[];
  stats: {
    total: number;
    byLevel: Record<MemoryLevel, number>;
    promotionsPending: number;
  };
}

// ==================== Intent Types ====================

export interface Intent {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: number;
  targetDate?: number;
  progress: number; // 0-100
  category: string;
  relatedMemories: string[]; // memory IDs
  milestones: Milestone[];
  metrics: IntentMetrics;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: number;
  completedAt?: number;
  relatedMemories: string[];
}

export interface IntentMetrics {
  memoryCount: number;
  lastActivity: number;
  velocity: number; // memories per week
  health: number; // 0-100
}

export interface IntentOrbit {
  intent: Intent;
  angle: number;
  radius: number;
  color: string;
  pulsePhase: number;
}

// ==================== Evolution Types ====================

export interface EvolutionEvent {
  id: string;
  timestamp: number;
  type: 'promotion' | 'demotion' | 'merge' | 'split' | 'creation' | 'archival';
  memoryId: string;
  fromLevel?: MemoryLevel;
  toLevel?: MemoryLevel;
  description: string;
  relatedIds: string[];
  metadata: Record<string, any>;
}

export interface TimelinePeriod {
  start: number;
  end: number;
  label: string;
  events: EvolutionEvent[];
  stats: {
    promotions: number;
    demotions: number;
    creations: number;
    archives: number;
  };
}

export interface EvolutionStats {
  totalMemories: number;
  levelDistribution: Record<MemoryLevel, number>;
  flowMatrix: Record<MemoryLevel, Record<MemoryLevel, number>>;
  velocity: number; // avg promotions per week
}

// ==================== Insights Types ====================

export interface Insight {
  id: string;
  type: 'conflict' | 'reminder' | 'pattern' | 'suggestion';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  relatedMemoryIds: string[];
  detectedAt: number;
  expiresAt?: number;
  action?: InsightAction;
  status: 'active' | 'dismissed' | 'resolved';
}

export interface InsightAction {
  type: 'promote' | 'merge' | 'review' | 'archive' | 'manual';
  label: string;
  payload?: Record<string, any>;
}

export interface RadarScan {
  timestamp: number;
  insights: Insight[];
  coverage: {
    memoriesScanned: number;
    conflictsFound: number;
    remindersDue: number;
  };
}

// ==================== L0 Monitor Types ====================

export interface L0Stream {
  id: string;
  name: string;
  type: 'conversation' | 'observation' | 'system' | 'external';
  status: 'active' | 'paused';
  lastEventAt: number;
  eventCount: number;
  rate: number; // events per minute
}

export interface L0Event {
  id: string;
  streamId: string;
  timestamp: number;
  type: 'input' | 'output' | 'context' | 'action';
  content: string;
  processed: boolean;
  extractedMemories: string[];
  metadata: Record<string, any>;
}

export interface L0Stats {
  streams: L0Stream[];
  recentEvents: L0Event[];
  throughput: {
    current: number;
    peak: number;
    average: number;
  };
  processingQueue: number;
}

// ==================== Review Types ====================

export interface ReviewSession {
  id: string;
  type: 'weekly' | 'l3_framework' | 'l4_calibration';
  startedAt: number;
  completedAt?: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  memoriesReviewed: string[];
  actionsTaken: ReviewAction[];
  summary: ReviewSummary;
}

export interface ReviewAction {
  id: string;
  type: 'promote' | 'archive' | 'merge' | 'edit' | 'flag';
  memoryId: string;
  timestamp: number;
  performedBy: 'user' | 'system';
  description: string;
}

export interface ReviewSummary {
  totalMemories: number;
  promotions: number;
  archives: number;
  insights: number;
  keyFindings: string[];
}

export interface WeeklyReport {
  period: { start: number; end: number };
  newMemories: number;
  promotions: number;
  activeIntents: number;
  insightsGenerated: number;
  highlights: MemoryHighlight[];
}

export interface MemoryHighlight {
  memory: Memory;
  reason: 'promoted' | 'high_confidence' | 'trending' | 'user_flagged';
  engagement: number;
}

// ==================== UI Component Types ====================

export interface ViewState {
  mode: 'galaxy' | 'intent' | 'timeline' | 'radar' | 'monitor' | 'review';
  filter: {
    levels: MemoryLevel[];
    categories: string[];
    dateRange?: { start: number; end: number };
    search?: string;
  };
  selection?: string;
  zoom: number;
  focus?: { x: number; y: number; z: number };
}

export interface ThemeConfig {
  name: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    galaxy: Record<string, string>;
    level: Record<MemoryLevel, string>;
  };
  animation: {
    speed: number;
    easing: string;
  };
}
