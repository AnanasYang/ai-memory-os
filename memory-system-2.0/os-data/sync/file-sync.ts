/**
 * Memory OS - File Sync Service
 * 
 * Bidirectional synchronization between Markdown files and JSON
 * Uses chokidar for file watching
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';
import { FSWatcher, watch } from 'chokidar';
import matter from 'gray-matter';
import {
  Memory,
  MemoryLevel,
  MemoryLevelType,
  FileSyncConfig,
  SyncState,
  FileState,
  SyncError,
  SyncDirection,
  L0RawMemory,
  L1EpisodicMemory,
  L2ProceduralMemory,
  L3SemanticMemory,
  L4CoreMemory,
} from '../models/types';
import {
  validateMemory,
  memoryToMarkdown,
  markdownToMemory,
  generateMemoryId,
} from './transformers';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: FileSyncConfig = {
  basePath: process.env.MEMORY_BASE_PATH || './data',
  watch: true,
  debounceMs: 300,
  encoding: 'utf-8',
};

// Level to directory mapping
const LEVEL_DIRS: Record<MemoryLevelType, string> = {
  [MemoryLevel.L0_RAW]: 'L0-raw',
  [MemoryLevel.L1_EPISODIC]: 'L1-episodic',
  [MemoryLevel.L2_PROCEDURAL]: 'L2-procedural',
  [MemoryLevel.L3_SEMANTIC]: 'L3-semantic',
  [MemoryLevel.L4_CORE]: 'L4-core',
};

// ============================================================================
// File Sync Service Class
// ============================================================================

export class FileSyncService {
  private config: FileSyncConfig;
  private state: SyncState;
  private watcher: FSWatcher | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private changeHandlers: Set<(event: string, path: string) => void> = new Set();

  constructor(config: Partial<FileSyncConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      lastSyncAt: new Date().toISOString(),
      files: new Map(),
      isSyncing: false,
      errors: [],
    };
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  async initialize(): Promise<void> {
    // Ensure directory structure exists
    await this.ensureDirectoryStructure();
    
    // Initial sync
    await this.fullSync();
    
    // Start watching if enabled
    if (this.config.watch) {
      await this.startWatching();
    }
  }

  async shutdown(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  // ============================================================================
  // Directory Management
  // ============================================================================

  private async ensureDirectoryStructure(): Promise<void> {
    const dirs = [
      this.config.basePath,
      ...Object.values(LEVEL_DIRS).map(d => path.join(this.config.basePath, d)),
      path.join(this.config.basePath, 'index'),
      path.join(this.config.basePath, 'cache'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private getLevelPath(level: MemoryLevelType): string {
    return path.join(this.config.basePath, LEVEL_DIRS[level]);
  }

  // ============================================================================
  // File Watching (chokidar)
  // ============================================================================

  private async startWatching(): Promise<void> {
    const watchPattern = path.join(this.config.basePath, '**/*.md');
    
    this.watcher = watch(watchPattern, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this.config.debounceMs,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange('add', filePath))
      .on('change', (filePath) => this.handleFileChange('change', filePath))
      .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
      .on('error', (error) => {
        console.error('File watcher error:', error);
        this.state.errors.push({
          path: 'watcher',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      });
  }

  private handleFileChange(event: string, filePath: string): void {
    // Debounce rapid changes
    const key = `${event}:${filePath}`;
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      
      try {
        if (event === 'unlink') {
          await this.handleFileDelete(filePath);
        } else {
          await this.syncFileFromMarkdown(filePath);
        }
        
        // Notify listeners
        this.changeHandlers.forEach(handler => handler(event, filePath));
      } catch (error) {
        this.recordError(filePath, error);
      }
    }, this.config.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  onChange(handler: (event: string, path: string) => void): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  // ============================================================================
  // Full Sync Operations
  // ============================================================================

  async fullSync(direction: SyncDirection = 'bidirectional'): Promise<void> {
    if (this.state.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.state.isSyncing = true;
    const startTime = Date.now();

    try {
      if (direction === 'markdown-to-json' || direction === 'bidirectional') {
        await this.syncAllMarkdownToJSON();
      }
      
      if (direction === 'json-to-markdown' || direction === 'bidirectional') {
        await this.syncAllJSONToMarkdown();
      }

      this.state.lastSyncAt = new Date().toISOString();
      console.log(`Full sync completed in ${Date.now() - startTime}ms`);
    } finally {
      this.state.isSyncing = false;
    }
  }

  private async syncAllMarkdownToJSON(): Promise<void> {
    const pattern = path.join(this.config.basePath, '**/*.md');
    const files = await glob(pattern);

    for (const file of files) {
      try {
        await this.syncFileFromMarkdown(file);
      } catch (error) {
        this.recordError(file, error);
      }
    }
  }

  private async syncAllJSONToMarkdown(): Promise<void> {
    const indexPath = path.join(this.config.basePath, 'index/memories.json');
    
    try {
      const content = await fs.readFile(indexPath, this.config.encoding);
      const memories: Memory[] = JSON.parse(content);
      
      for (const memory of memories) {
        try {
          await this.syncMemoryToMarkdown(memory);
        } catch (error) {
          this.recordError(`memory:${memory.id}`, error);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // ============================================================================
  // Single File Operations
  // ============================================================================

  async syncFileFromMarkdown(filePath: string): Promise<Memory> {
    const content = await fs.readFile(filePath, this.config.encoding);
    const parsed = matter(content);
    
    // Convert to memory object
    const memory = markdownToMemory(parsed.content, parsed.data);
    
    // Validate
    validateMemory(memory);
    
    // Update file state
    const stats = await fs.stat(filePath);
    const hash = this.computeHash(content);
    
    this.state.files.set(filePath, {
      path: filePath,
      hash,
      mtime: stats.mtimeMs,
      size: stats.size,
      syncedAt: new Date().toISOString(),
    });
    
    // Update JSON index
    await this.updateMemoryInIndex(memory);
    
    return memory;
  }

  async syncMemoryToMarkdown(memory: Memory): Promise<string> {
    // Validate first
    validateMemory(memory);
    
    // Generate markdown content
    const { content, data } = memoryToMarkdown(memory);
    const markdown = matter.stringify(content, data);
    
    // Determine file path
    const filePath = this.getMemoryFilePath(memory);
    
    // Check if content changed
    const currentState = this.state.files.get(filePath);
    const newHash = this.computeHash(markdown);
    
    if (currentState?.hash === newHash) {
      return filePath; // No change, skip write
    }
    
    // Write file
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, markdown, this.config.encoding);
    
    // Update state
    const stats = await fs.stat(filePath);
    this.state.files.set(filePath, {
      path: filePath,
      hash: newHash,
      mtime: stats.mtimeMs,
      size: stats.size,
      syncedAt: new Date().toISOString(),
    });
    
    return filePath;
  }

  private async handleFileDelete(filePath: string): Promise<void> {
    this.state.files.delete(filePath);
    
    // Extract memory ID from path and remove from index
    const memoryId = this.extractMemoryIdFromPath(filePath);
    if (memoryId) {
      await this.removeMemoryFromIndex(memoryId);
    }
  }

  // ============================================================================
  // Index Management
  // ============================================================================

  private async updateMemoryInIndex(memory: Memory): Promise<void> {
    const index = await this.loadIndex();
    const existingIndex = index.findIndex(m => m.id === memory.id);
    
    if (existingIndex >= 0) {
      index[existingIndex] = memory;
    } else {
      index.push(memory);
    }
    
    await this.saveIndex(index);
  }

  private async removeMemoryFromIndex(memoryId: string): Promise<void> {
    const index = await this.loadIndex();
    const filtered = index.filter(m => m.id !== memoryId);
    await this.saveIndex(filtered);
  }

  private async loadIndex(): Promise<Memory[]> {
    const indexPath = path.join(this.config.basePath, 'index/memories.json');
    
    try {
      const content = await fs.readFile(indexPath, this.config.encoding);
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async saveIndex(memories: Memory[]): Promise<void> {
    const indexPath = path.join(this.config.basePath, 'index/memories.json');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await fs.writeFile(
      indexPath,
      JSON.stringify(memories, null, 2),
      this.config.encoding
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getMemoryFilePath(memory: Memory): string {
    const dir = this.getLevelPath(memory.level);
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    const sanitizedTitle = this.sanitizeFilename(
      ('title' in memory && memory.title) || 
      ('pattern' in memory && memory.pattern) ||
      ('concept' in memory && memory.concept) ||
      ('value' in memory && memory.value) ||
      memory.id
    );
    
    return path.join(dir, String(year), month, `${sanitizedTitle}-${memory.id.slice(-8)}.md`);
  }

  private extractMemoryIdFromPath(filePath: string): string | null {
    const match = filePath.match(/-([a-z0-9]{8})\.md$/i);
    return match ? match[1] : null;
  }

  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  }

  private computeHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private recordError(filePath: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Sync error for ${filePath}:`, message);
    
    this.state.errors.push({
      path: filePath,
      error: message,
      timestamp: new Date().toISOString(),
    });
    
    // Keep only last 100 errors
    if (this.state.errors.length > 100) {
      this.state.errors = this.state.errors.slice(-100);
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getState(): SyncState {
    return {
      ...this.state,
      files: new Map(this.state.files),
    };
  }

  async getMemoryById(id: string): Promise<Memory | null> {
    const index = await this.loadIndex();
    return index.find(m => m.id === id) || null;
  }

  async getMemoriesByLevel(level: MemoryLevelType): Promise<Memory[]> {
    const index = await this.loadIndex();
    return index.filter(m => m.level === level);
  }

  async createMemory(memory: Omit<Memory, 'id'>): Promise<Memory> {
    const newMemory = {
      ...memory,
      id: generateMemoryId(),
    } as Memory;
    
    // Validate
    validateMemory(newMemory);
    
    // Save to markdown
    await this.syncMemoryToMarkdown(newMemory);
    
    return newMemory;
  }

  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory> {
    const existing = await this.getMemoryById(id);
    if (!existing) {
      throw new Error(`Memory not found: ${id}`);
    }
    
    const updated = { ...existing, ...updates, id } as Memory;
    validateMemory(updated);
    
    await this.syncMemoryToMarkdown(updated);
    
    return updated;
  }

  async deleteMemory(id: string): Promise<void> {
    const existing = await this.getMemoryById(id);
    if (!existing) {
      throw new Error(`Memory not found: ${id}`);
    }
    
    const filePath = this.getMemoryFilePath(existing);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    
    await this.removeMemoryFromIndex(id);
    this.state.files.delete(filePath);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let globalSyncService: FileSyncService | null = null;

export function getFileSyncService(config?: Partial<FileSyncConfig>): FileSyncService {
  if (!globalSyncService) {
    globalSyncService = new FileSyncService(config);
  }
  return globalSyncService;
}

export function resetFileSyncService(): void {
  globalSyncService = null;
}
