/**
 * Memory OS - Type Definitions
 * 
 * Unified data models for the 5-layer memory system
 * Supports both Markdown (human-readable) and JSON (machine-readable) formats
 */

import { z } from 'zod';

// ============================================================================
// Enums & Constants
// ============================================================================

export const MemoryLevel = {
  L0_RAW: 'L0_RAW',
  L1_EPISODIC: 'L1_EPISODIC',
  L2_PROCEDURAL: 'L2_PROCEDURAL',
  L3_SEMANTIC: 'L3_SEMANTIC',
  L4_CORE: 'L4_CORE',
} as const;

export type MemoryLevelType = typeof MemoryLevel[keyof typeof MemoryLevel];

export const MemoryStatus = {
  ACTIVE: 'active',
  PENDING: 'pending',
  ARCHIVED: 'archived',
  CONFLICTED: 'conflicted',
} as const;

export type MemoryStatusType = typeof MemoryStatus[keyof typeof MemoryStatus];

export const DreamType = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
} as const;

export type DreamTypeType = typeof DreamType[keyof typeof DreamType];

export const ReviewAction = {
  CONFIRM: 'confirm',
  REJECT: 'reject',
  MODIFY: 'modify',
  ELEVATE: 'elevate',
} as const;

export type ReviewActionType = typeof ReviewAction[keyof typeof ReviewAction];

// ============================================================================
// Zod Schemas (Runtime Validation)
// ============================================================================

export const FrontmatterSchema = z.object({
  id: z.string(),
  level: z.enum(['L0_RAW', 'L1_EPISODIC', 'L2_PROCEDURAL', 'L3_SEMANTIC', 'L4_CORE']),
  status: z.enum(['active', 'pending', 'archived', 'conflicted']).default('active'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  source: z.string().optional(),
  tags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  version: z.number().default(1),
});

export const MemoryContentSchema = z.object({
  title: z.string(),
  description: z.string(),
  context: z.record(z.unknown()).optional(),
  relatedIds: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const L0RawMemorySchema = z.object({
  id: z.string(),
  level: z.literal('L0_RAW'),
  content: z.string(),
  timestamp: z.string().datetime(),
  sessionId: z.string(),
  source: z.string().optional(),
  raw: z.record(z.unknown()).optional(),
});

export const L1EpisodicMemorySchema = z.object({
  id: z.string(),
  level: z.literal('L1_EPISODIC'),
  title: z.string(),
  description: z.string(),
  timestamp: z.string().datetime(),
  sessionId: z.string(),
  topics: z.array(z.string()).default([]),
  participants: z.array(z.string()).default([]),
  emotionalValence: z.number().min(-1).max(1).optional(),
  importance: z.number().min(0).max(1).default(0.5),
  relatedL0Ids: z.array(z.string()).default([]),
});

export const L2ProceduralMemorySchema = z.object({
  id: z.string(),
  level: z.literal('L2_PROCEDURAL'),
  pattern: z.string(),
  trigger: z.string(),
  action: z.string(),
  result: z.string(),
  frequency: z.number().min(0).default(1),
  confidence: z.number().min(0).max(1).default(0.5),
  sourceL1Ids: z.array(z.string()).default([]),
  firstObserved: z.string().datetime(),
  lastObserved: z.string().datetime(),
});

export const L3SemanticMemorySchema = z.object({
  id: z.string(),
  level: z.literal('L3_SEMANTIC'),
  concept: z.string(),
  definition: z.string(),
  beliefs: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  relatedL2Ids: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const L4CoreMemorySchema = z.object({
  id: z.string(),
  level: z.literal('L4_CORE'),
  value: z.string(),
  principle: z.string(),
  priority: z.number().min(1).max(10).default(5),
  nonNegotiable: z.boolean().default(false),
  sourceL3Ids: z.array(z.string()).default([]),
  establishedAt: z.string().datetime(),
});

export const UnifiedMemorySchema = z.union([
  L0RawMemorySchema,
  L1EpisodicMemorySchema,
  L2ProceduralMemorySchema,
  L3SemanticMemorySchema,
  L4CoreMemorySchema,
]);

export const DreamSchema = z.object({
  id: z.string(),
  type: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  summary: z.string(),
  narrative: z.string(),
  highlights: z.array(z.object({
    type: z.enum(['insight', 'decision', 'milestone', 'pattern']),
    content: z.string(),
    memoryId: z.string().optional(),
  })),
  relatedMemoryIds: z.array(z.string()),
  tags: z.array(z.string()),
  generatedAt: z.string().datetime(),
  reviewed: z.boolean().default(false),
});

export const ReviewSchema = z.object({
  id: z.string(),
  targetMemoryId: z.string(),
  targetLevel: z.enum(['L1_EPISODIC', 'L2_PROCEDURAL', 'L3_SEMANTIC', 'L4_CORE']),
  proposedLevel: z.enum(['L1_EPISODIC', 'L2_PROCEDURAL', 'L3_SEMANTIC', 'L4_CORE']).optional(),
  action: z.enum(['confirm', 'reject', 'modify', 'elevate']),
  reason: z.string(),
  modifications: z.record(z.unknown()).optional(),
  reviewer: z.string(),
  reviewedAt: z.string().datetime(),
});

export const InsightSchema = z.object({
  id: z.string(),
  type: z.enum(['pattern', 'conflict', 'gap', 'evolution', 'health']),
  title: z.string(),
  description: z.string(),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  relatedMemoryIds: z.array(z.string()),
  detectedAt: z.string().datetime(),
  acknowledged: z.boolean().default(false),
});

export const IntentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['goal', 'preference', 'boundary', 'value']),
  status: z.enum(['active', 'paused', 'completed', 'abandoned']),
  progress: z.number().min(0).max(100).default(0),
  targetDate: z.string().datetime().optional(),
  relatedMemoryIds: z.array(z.string()).default([]),
  metrics: z.array(z.object({
    name: z.string(),
    current: z.number(),
    target: z.number(),
    unit: z.string(),
  })).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ============================================================================
// TypeScript Types (Derived from Zod)
// ============================================================================

export type Frontmatter = z.infer<typeof FrontmatterSchema>;
export type MemoryContent = z.infer<typeof MemoryContentSchema>;

export type L0RawMemory = z.infer<typeof L0RawMemorySchema>;
export type L1EpisodicMemory = z.infer<typeof L1EpisodicMemorySchema>;
export type L2ProceduralMemory = z.infer<typeof L2ProceduralMemorySchema>;
export type L3SemanticMemory = z.infer<typeof L3SemanticMemorySchema>;
export type L4CoreMemory = z.infer<typeof L4CoreMemorySchema>;

export type Memory = 
  | L0RawMemory 
  | L1EpisodicMemory 
  | L2ProceduralMemory 
  | L3SemanticMemory 
  | L4CoreMemory;

export type Dream = z.infer<typeof DreamSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type Insight = z.infer<typeof InsightSchema>;
export type Intent = z.infer<typeof IntentSchema>;

// ============================================================================
// API Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface MemoryQuery {
  level?: MemoryLevelType;
  status?: MemoryStatusType;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  search?: string;
  relatedTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'confidence';
  sortOrder?: 'asc' | 'desc';
}

export interface MemoryCreateInput {
  level: MemoryLevelType;
  content: unknown;
}

export interface MemoryUpdateInput {
  id: string;
  updates: Partial<Memory>;
}

export interface ElevateInput {
  memoryId: string;
  targetLevel: MemoryLevelType;
  reason?: string;
}

export interface DreamGenerateInput {
  type: DreamTypeType;
  dateRange: { start: string; end: string };
  focusAreas?: string[];
}

export interface ReviewSubmitInput {
  targetMemoryId: string;
  action: ReviewActionType;
  reason: string;
  modifications?: Record<string, unknown>;
  proposedLevel?: MemoryLevelType;
}

export interface InsightQuery {
  type?: Insight['type'];
  severity?: Insight['severity'];
  acknowledged?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface IntentProgressUpdate {
  intentId: string;
  progress: number;
  note?: string;
  metricUpdates?: Array<{ name: string; value: number }>;
}

// ============================================================================
// File Sync Types
// ============================================================================

export interface FileSyncConfig {
  basePath: string;
  watch: boolean;
  debounceMs: number;
  encoding: BufferEncoding;
}

export interface SyncState {
  lastSyncAt: string;
  files: Map<string, FileState>;
  isSyncing: boolean;
  errors: SyncError[];
}

export interface FileState {
  path: string;
  hash: string;
  mtime: number;
  size: number;
  syncedAt: string;
}

export interface SyncError {
  path: string;
  error: string;
  timestamp: string;
}

export type SyncDirection = 'markdown-to-json' | 'json-to-markdown' | 'bidirectional';

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheConfig {
  maxSize: number;
  ttlMs: number;
  cleanupIntervalMs: number;
}

export interface CacheEntry<T> {
  key: string;
  data: T;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  oldestEntry: number;
  newestEntry: number;
}

// ============================================================================
// Health & Metrics Types
// ============================================================================

export interface MemorySystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    fileSync: HealthCheck;
    cache: HealthCheck;
    api: HealthCheck;
    storage: HealthCheck;
  };
  memoryCounts: Record<MemoryLevelType, number>;
  pendingReviews: number;
  unacknowledgedInsights: number;
  lastDreamGenerated: string | null;
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  latency: number;
  lastChecked: string;
}

export interface MemoryMetrics {
  totalMemories: number;
  memoriesByLevel: Record<MemoryLevelType, number>;
  memoriesByStatus: Record<MemoryStatusType, number>;
  avgConfidenceByLevel: Record<MemoryLevelType, number>;
  promotionRates: {
    l0ToL1: number;
    l1ToL2: number;
    l2ToL3: number;
    l3ToL4: number;
  };
  reviewStats: {
    total: number;
    confirmed: number;
    rejected: number;
    modified: number;
    elevated: number;
  };
}
