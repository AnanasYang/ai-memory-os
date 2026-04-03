import { MemoryNode, MemoryStats } from './types';

// 在静态导出时，数据需要在构建时可用
// 我们使用内联的静态数据

// 默认空数据
let memoriesData: MemoryNode[] = [];
let statsData: MemoryStats = {
  total: 0,
  byLevel: {},
  byCategory: {},
  recentUpdates: [],
  evolution: [],
};

// 尝试在服务器端读取数据
if (typeof process !== 'undefined' && process.cwd) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(process.cwd(), 'data');
    
    const memoriesPath = path.join(dataDir, 'memories.json');
    const statsPath = path.join(dataDir, 'stats.json');
    
    if (fs.existsSync(memoriesPath)) {
      memoriesData = JSON.parse(fs.readFileSync(memoriesPath, 'utf-8'));
    }
    
    if (fs.existsSync(statsPath)) {
      statsData = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading data:', e);
  }
}

export function getAllMemories(): MemoryNode[] {
  return memoriesData;
}

export function getMemoryStats(): MemoryStats {
  return statsData;
}

export function getMemoriesByLevel(level: string): MemoryNode[] {
  return memoriesData.filter((m) => m.level === level);
}

export function getMemoryById(id: string): MemoryNode | undefined {
  return memoriesData.find((m) => m.id === id);
}

export function getRecentMemories(limit: number = 10): MemoryNode[] {
  return [...memoriesData]
    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
    .slice(0, limit);
}

export function getMemoriesByCategory(category: string): MemoryNode[] {
  return memoriesData.filter((m) => m.category === category);
}

export function getLastSyncInfo(): { timestamp: string; count: number } {
  return { 
    timestamp: new Date().toISOString(), 
    count: memoriesData.length 
  };
}