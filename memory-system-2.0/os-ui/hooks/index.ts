/**
 * Memory OS Hooks
 * 核心 React Hooks - 状态管理、数据获取、动画
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  Memory,
  MemoryLevel,
  Galaxy,
  Intent,
  EvolutionEvent,
  Insight,
  L0Stats,
  ViewState,
  MemoryNode,
} from '../types';
import {
  generateMockMemories,
  generateMockGalaxies,
  generateMockIntents,
  generateMockEvolutionEvents,
  generateMockInsights,
  generateMockL0Stats,
  calculatePromotionScore,
  calculateWeeklyReport,
  LEVEL_COLORS,
} from '../utils';

// ==================== useMemoryData - 数据管理 ====================

interface MemoryDataState {
  memories: Memory[];
  galaxies: Galaxy[];
  intents: Intent[];
  evolutionEvents: EvolutionEvent[];
  insights: Insight[];
  l0Stats: L0Stats;
  loading: boolean;
  error: Error | null;
}

export const useMemoryData = () => {
  const [state, setState] = useState<MemoryDataState>({
    memories: [],
    galaxies: [],
    intents: [],
    evolutionEvents: [],
    insights: [],
    l0Stats: {
      streams: [],
      recentEvents: [],
      throughput: { current: 0, peak: 0, average: 0 },
      processingQueue: 0,
    },
    loading: true,
    error: null,
  });

  useEffect(() => {
    // 模拟数据加载
    const loadData = async () => {
      try {
        // 生成模拟数据
        const memories = generateMockMemories(100);
        const galaxies = generateMockGalaxies(memories);
        const intents = generateMockIntents(memories);
        const evolutionEvents = generateMockEvolutionEvents(memories);
        const insights = generateMockInsights(memories);
        const { streams, recentEvents } = generateMockL0Stats();

        setState({
          memories,
          galaxies,
          intents,
          evolutionEvents,
          insights,
          l0Stats: {
            streams,
            recentEvents,
            throughput: {
              current: 42,
              peak: 120,
              average: 65,
            },
            processingQueue: 12,
          },
          loading: false,
          error: null,
        });
      } catch (err) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: err as Error,
        }));
      }
    };

    loadData();
  }, []);

  const refreshData = useCallback(() => {
    setState(prev => ({ ...prev, loading: true }));
    // 重新加载数据
    const memories = generateMockMemories(100);
    const galaxies = generateMockGalaxies(memories);
    const intents = generateMockIntents(memories);
    
    setState(prev => ({
      ...prev,
      memories,
      galaxies,
      intents,
      loading: false,
    }));
  }, []);

  const promoteMemory = useCallback((memoryId: string, toLevel: MemoryLevel) => {
    setState(prev => {
      const newMemories = prev.memories.map(mem => {
        if (mem.id === memoryId) {
          return {
            ...mem,
            level: toLevel,
            reviewStatus: 'promoted' as const,
            lastReviewedAt: Date.now(),
          };
        }
        return mem;
      });
      
      return {
        ...prev,
        memories: newMemories,
        galaxies: generateMockGalaxies(newMemories),
      };
    });
  }, []);

  const dismissInsight = useCallback((insightId: string) => {
    setState(prev => ({
      ...prev,
      insights: prev.insights.map(i =>
        i.id === insightId ? { ...i, status: 'dismissed' as const } : i
      ),
    }));
  }, []);

  const resolveInsight = useCallback((insightId: string) => {
    setState(prev => ({
      ...prev,
      insights: prev.insights.map(i =>
        i.id === insightId ? { ...i, status: 'resolved' as const } : i
      ),
    }));
  }, []);

  const weeklyReport = useMemo(
    () => calculateWeeklyReport(state.memories),
    [state.memories]
  );

  return {
    ...state,
    refreshData,
    promoteMemory,
    dismissInsight,
    resolveInsight,
    weeklyReport,
  };
};

// ==================== useGalaxyAnimation - 星系动画 ====================

export const useGalaxyAnimation = (
  galaxies: Galaxy[],
  isPlaying: boolean = true
) => {
  const [animatedNodes, setAnimatedNodes] = useState<Map<string, MemoryNode>>(new Map());
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

  useEffect(() => {
    const initialNodes = new Map<string, MemoryNode>();
    galaxies.forEach(galaxy => {
      galaxy.nodes.forEach(node => {
        initialNodes.set(node.id, { ...node });
      });
    });
    setAnimatedNodes(initialNodes);
  }, [galaxies]);

  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      timeRef.current += 0.016; // ~60fps
      
      setAnimatedNodes(prev => {
        const next = new Map(prev);
        
        galaxies.forEach(galaxy => {
          galaxy.nodes.forEach(node => {
            const animatedNode = next.get(node.id);
            if (!animatedNode) return;

            const { orbit } = node;
            const newAngle = orbit.angle + orbit.speed * timeRef.current;
            
            const x = Math.cos(newAngle) * orbit.radius;
            const y = Math.sin(newAngle) * orbit.radius * Math.cos(orbit.tilt);
            const z = Math.sin(newAngle) * orbit.radius * Math.sin(orbit.tilt);

            next.set(node.id, {
              ...animatedNode,
              x: galaxy.center.x + x,
              y: galaxy.center.y + y,
              z: galaxy.center.z + z,
            });
          });
        });
        
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [galaxies, isPlaying]);

  return animatedNodes;
};

// ==================== useIntentOrbit - 意图轨道 ====================

export const useIntentOrbit = (intents: Intent[], isPlaying: boolean = true) => {
  const [orbits, setOrbits] = useState<Array<{
    intent: Intent;
    angle: number;
    radius: number;
    x: number;
    y: number;
    pulsePhase: number;
  }>>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const initialOrbits = intents.map((intent, i) => {
      const angle = (i / intents.length) * Math.PI * 2;
      const radius = 150 + intent.metrics.health * 2;
      return {
        intent,
        angle,
        radius,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        pulsePhase: i * 0.5,
      };
    });
    setOrbits(initialOrbits);
  }, [intents]);

  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      setOrbits(prev =>
        prev.map((orbit, i) => {
          const newAngle = orbit.angle + 0.002 * (1 + i * 0.1);
          const newPulse = orbit.pulsePhase + 0.05;
          
          return {
            ...orbit,
            angle: newAngle,
            x: Math.cos(newAngle) * orbit.radius,
            y: Math.sin(newAngle) * orbit.radius,
            pulsePhase: newPulse,
          };
        })
      );
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  return orbits;
};

// ==================== useViewState - 视图状态 ====================

export const useViewState = (initialMode: ViewState['mode'] = 'galaxy') => {
  const [viewState, setViewState] = useState<ViewState>({
    mode: initialMode,
    filter: {
      levels: ['L0', 'L1', 'L2', 'L3', 'L4'],
      categories: [],
    },
    zoom: 1,
  });

  const setMode = useCallback((mode: ViewState['mode']) => {
    setViewState(prev => ({ ...prev, mode }));
  }, []);

  const setFilter = useCallback((filter: Partial<ViewState['filter']>) => {
    setViewState(prev => ({
      ...prev,
      filter: { ...prev.filter, ...filter },
    }));
  }, []);

  const toggleLevel = useCallback((level: MemoryLevel) => {
    setViewState(prev => {
      const levels = new Set(prev.filter.levels);
      if (levels.has(level)) {
        levels.delete(level);
      } else {
        levels.add(level);
      }
      return {
        ...prev,
        filter: { ...prev.filter, levels: Array.from(levels) as MemoryLevel[] },
      };
    });
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setViewState(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(5, zoom)) }));
  }, []);

  const setSelection = useCallback((id: string | undefined) => {
    setViewState(prev => ({ ...prev, selection: id }));
  }, []);

  return {
    viewState,
    setMode,
    setFilter,
    toggleLevel,
    setZoom,
    setSelection,
  };
};

// ==================== useL0Monitor - L0 监控 ====================

export const useL0Monitor = (l0Stats: L0Stats, isActive: boolean = true) => {
  const [stats, setStats] = useState(l0Stats);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setStats(l0Stats);
  }, [l0Stats]);

  useEffect(() => {
    if (!isActive || isPaused) return;

    intervalRef.current = setInterval(() => {
      setStats(prev => {
        // 模拟实时数据更新
        const newEvent = {
          id: `l0_${Date.now()}`,
          streamId: prev.streams[Math.floor(Math.random() * prev.streams.length)]?.id || '',
          timestamp: Date.now(),
          type: ['input', 'output', 'context', 'action'][Math.floor(Math.random() * 4)] as any,
          content: `实时监控事件`,
          processed: true,
          extractedMemories: [],
          metadata: {},
        };

        return {
          ...prev,
          recentEvents: [newEvent, ...prev.recentEvents].slice(0, 20),
          throughput: {
            ...prev.throughput,
            current: Math.floor(Math.random() * 50) + 20,
          },
        };
      });
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, isPaused]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  return {
    stats,
    isPaused,
    togglePause,
  };
};

// ==================== usePromotionCandidates - 晋升候选 ====================

export const usePromotionCandidates = (memories: Memory[], threshold: number = 0.7) => {
  return useMemo(() => {
    const candidates = memories
      .map(m => ({ ...m, promotionScore: calculatePromotionScore(m) }))
      .filter(m => m.promotionScore >= threshold)
      .sort((a, b) => (b.promotionScore || 0) - (a.promotionScore || 0));

    const byLevel = candidates.reduce((acc, m) => {
      const nextLevel = getNextLevel(m.level);
      if (!acc[nextLevel]) acc[nextLevel] = [];
      acc[nextLevel].push(m);
      return acc;
    }, {} as Record<MemoryLevel, Memory[]>);

    return {
      all: candidates,
      byLevel,
      total: candidates.length,
    };
  }, [memories, threshold]);
};

const getNextLevel = (currentLevel: MemoryLevel): MemoryLevel => {
  const levels: MemoryLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];
  const currentIdx = levels.indexOf(currentLevel);
  return levels[Math.min(currentIdx + 1, levels.length - 1)];
};

// ==================== useKeyboardShortcuts - 键盘快捷键 ====================

export const useKeyboardShortcuts = (shortcuts: Record<string, () => void>) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = `${e.ctrlKey ? 'ctrl+' : ''}${e.altKey ? 'alt+' : ''}${e.shiftKey ? 'shift+' : ''}${e.key.toLowerCase()}`;
      
      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
};
