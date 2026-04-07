'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getActivityData } from '@/lib/unified-data';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  TrendingUp, 
  Brain, 
  Filter,
  BarChart3,
  Layers,
  ChevronRight,
  X
} from 'lucide-react';
import Link from 'next/link';

const levelColors = {
  L0: 'bg-blue-500',
  L1: 'bg-cyan-400',
  L2: 'bg-amber-400',
  L3: 'bg-pink-400',
  L4: 'bg-violet-400',
};

const levelNames = {
  L0: '工作记忆',
  L1: '情景记忆',
  L2: '程序记忆',
  L3: '语义记忆',
  L4: '核心记忆',
};

const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

interface DayCell {
  date: string;
  count: number;
  level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  month: number;
  dayOfWeek: number; // 0=周一, 6=周日
  weekIndex: number;
}

export function EvolutionTimeline({ className }: { className?: string }) {
  const [selectedLevel, setSelectedLevel] = useState<string | 'all'>('all');
  const [viewMode, setViewMode] = useState<'heatmap' | 'list'>('heatmap');
  const [selectedDate, setSelectedDate] = useState<DayCell | null>(null);

  // 获取真实活动数据
  const rawActivities = useMemo(() => getActivityData(), []);

  const filteredActivities = useMemo(() => {
    if (selectedLevel === 'all') return rawActivities;
    return rawActivities.filter(a => a.level === selectedLevel);
  }, [rawActivities, selectedLevel]);

  // 构建 GitHub 风格的热力图数据
  const { gridData, monthLabels, maxCount } = useMemo(() => {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    oneYearAgo.setDate(oneYearAgo.getDate() - oneYearAgo.getDay() + 1); // 调整到周一开始

    // 创建日期映射
    const activityMap = new Map<string, typeof rawActivities[0]>();
    filteredActivities.forEach(a => {
      const existing = activityMap.get(a.date);
      if (!existing || a.count > existing.count) {
        activityMap.set(a.date, a);
      }
    });

    // 生成过去一年的所有日期
    const gridData: DayCell[] = [];
    const currentDate = new Date(oneYearAgo);
    let weekIndex = 0;

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay(); // 0=周日, 1=周一, ...
      // 转换为: 0=周一, 6=周日
      const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const activity = activityMap.get(dateStr);
      
      gridData.push({
        date: dateStr,
        count: activity?.count || 0,
        level: activity?.level || 'L0',
        month: currentDate.getMonth(),
        dayOfWeek: adjustedDayOfWeek,
        weekIndex,
      });

      // 如果是周日，进入下一周
      if (dayOfWeek === 0) {
        weekIndex++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 计算月份标签位置
    const monthLabels: Array<{ label: string; weekIndex: number }> = [];
    let currentMonth = -1;
    
    gridData.forEach((cell, index) => {
      // 只在每周一检查月份变化
      if (cell.dayOfWeek === 0) {
        const month = cell.month;
        if (month !== currentMonth) {
          currentMonth = month;
          monthLabels.push({
            label: monthNames[month],
            weekIndex: cell.weekIndex,
          });
        }
      }
    });

    const maxCount = Math.max(...filteredActivities.map(a => a.count), 1);
    
    return { gridData, monthLabels, maxCount };
  }, [filteredActivities]);

  // 按周组织数据 (7行 x N列)
  const weeklyGrid = useMemo(() => {
    const maxWeekIndex = Math.max(...gridData.map(d => d.weekIndex), 0);
    const weeks: DayCell[][] = Array.from({ length: maxWeekIndex + 1 }, () => []);
    
    gridData.forEach(cell => {
      if (!weeks[cell.weekIndex]) {
        weeks[cell.weekIndex] = [];
      }
      weeks[cell.weekIndex][cell.dayOfWeek] = cell;
    });

    // 填充缺失的天
    weeks.forEach((week, weekIdx) => {
      for (let day = 0; day < 7; day++) {
        if (!week[day]) {
          // 找到最近的日期来填充
          const refCell = gridData.find(c => c.weekIndex === weekIdx && c.dayOfWeek === day);
          if (refCell) {
            week[day] = refCell;
          }
        }
      }
    });

    return weeks;
  }, [gridData]);

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    const intensity = Math.min(count / maxCount, 1);
    if (intensity <= 0.25) return 'bg-emerald-200 dark:bg-emerald-900';
    if (intensity <= 0.5) return 'bg-emerald-300 dark:bg-emerald-700';
    if (intensity <= 0.75) return 'bg-emerald-400 dark:bg-emerald-600';
    return 'bg-emerald-500 dark:bg-emerald-500';
  };

  const stats = useMemo(() => ({
    total: filteredActivities.reduce((sum, a) => sum + a.count, 0),
    activeDays: filteredActivities.filter(a => a.count > 0).length,
    maxDaily: maxCount,
    byLevel: {
      L1: filteredActivities.filter(a => a.level === 'L1').reduce((s, a) => s + a.count, 0),
      L2: filteredActivities.filter(a => a.level === 'L2').reduce((s, a) => s + a.count, 0),
      L3: filteredActivities.filter(a => a.level === 'L3').reduce((s, a) => s + a.count, 0),
      L4: filteredActivities.filter(a => a.level === 'L4').reduce((s, a) => s + a.count, 0),
    }
  }), [filteredActivities, maxCount]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">层级筛选:</span>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSelectedLevel('all')}
              className={cn(
                "px-3 py-1 text-xs rounded-full transition-colors",
                selectedLevel === 'all'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              全部
            </button>
            {Object.entries(levelNames).map(([level, name]) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1",
                  selectedLevel === level
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", levelColors[level as keyof typeof levelColors])} />
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('heatmap')}
            className={cn(
              "p-2 rounded-lg transition-colors",
              viewMode === 'heatmap' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
            title="热力图视图"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "p-2 rounded-lg transition-colors",
              viewMode === 'list' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
            title="列表视图"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">总计</span>
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">活跃天数</span>
          </div>
          <p className="text-2xl font-bold">{stats.activeDays}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Brain className="w-4 h-4" />
            <span className="text-xs">单日最高</span>
          </div>
          <p className="text-2xl font-bold">{stats.maxDaily}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Layers className="w-4 h-4" />
            <span className="text-xs">层级分布</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {Object.entries(stats.byLevel).map(([level, count]) => (
              count > 0 && (
                <span key={level} className={cn("text-xs px-2 py-0.5 rounded text-white", levelColors[level as keyof typeof levelColors])}>
                  {level}: {count}
                </span>
              )
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap View - GitHub Style */}
      {viewMode === 'heatmap' && (
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-sm font-medium mb-4">活动热力图 (近一年)</h3>
          
          {/* Month Labels */}
          <div className="flex mb-2 pl-8">
            {monthLabels.map((label, i) => (
              <div
                key={i}
                className="text-xs text-muted-foreground absolute"
                style={{ marginLeft: `${label.weekIndex * 14}px` }}
              >
                {label.label}
              </div>
            ))}
          </div>

          {/* Heatmap Grid - GitHub Style */}
          <div className="flex">
            {/* Week Day Labels */}
            <div className="flex flex-col gap-[3px] mr-2 text-xs text-muted-foreground">
              {weekDays.map((day, i) => (
                <div key={i} className="h-[10px] flex items-center">
                  {i % 2 === 0 ? day : ''}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-[3px] overflow-x-auto">
              {weeklyGrid.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  {week.map((cell, dayIndex) => (
                    <motion.div
                      key={`${weekIndex}-${dayIndex}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: weekIndex * 0.005 + dayIndex * 0.001 }}
                      className={cn(
                        "w-[10px] h-[10px] rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary hover:scale-125",
                        getIntensity(cell?.count || 0)
                      )}
                      title={`${cell?.date || ''}: ${cell?.count || 0} 个活动`}
                      onClick={() => cell && setSelectedDate(cell)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground">
            <span>少</span>
            <div className="flex gap-[3px]">
              <div className="w-[10px] h-[10px] rounded-sm bg-slate-100 dark:bg-slate-800" />
              <div className="w-[10px] h-[10px] rounded-sm bg-emerald-200 dark:bg-emerald-900" />
              <div className="w-[10px] h-[10px] rounded-sm bg-emerald-300 dark:bg-emerald-700" />
              <div className="w-[10px] h-[10px] rounded-sm bg-emerald-400 dark:bg-emerald-600" />
              <div className="w-[10px] h-[10px] rounded-sm bg-emerald-500 dark:bg-emerald-500" />
            </div>
            <span>多</span>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-card border rounded-lg">
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium">活动记录</h3>
          </div>
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {filteredActivities.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                暂无活动记录
              </div>
            ) : (
              filteredActivities.slice().reverse().map((activity, index) => (
                <motion.div
                  key={`${activity.date}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedDate({
                    date: activity.date,
                    count: activity.count,
                    level: activity.level,
                    month: parseInt(activity.date.split('-')[1]) - 1,
                    dayOfWeek: 0,
                    weekIndex: 0,
                  })}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", levelColors[activity.level as keyof typeof levelColors])} />
                    <div>
                      <p className="text-sm font-medium">{activity.date}</p>
                      <p className="text-xs text-muted-foreground">{levelNames[activity.level as keyof typeof levelNames]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{activity.count}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Date Detail Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedDate(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">{selectedDate.date}</h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn("w-4 h-4 rounded-full", levelColors[selectedDate.level as keyof typeof levelColors])} />
                <span className="text-sm">{levelNames[selectedDate.level as keyof typeof levelNames]}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                活动数量: <span className="font-medium text-foreground">{selectedDate.count}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                星期: <span className="font-medium text-foreground">{weekDays[selectedDate.dayOfWeek]}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link
          href="/memory"
          className="flex-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg p-4 transition-colors"
        >
          <div className="flex items-center gap-2 text-primary mb-1">
            <Brain className="w-4 h-4" />
            <span className="text-sm font-medium">查看记忆图谱</span>
          </div>
          <p className="text-xs text-muted-foreground">探索所有记忆节点的关联关系</p>
        </Link>
        <Link
          href="/intent"
          className="flex-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg p-4 transition-colors"
        >
          <div className="flex items-center gap-2 text-primary mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">管理意图</span>
          </div>
          <p className="text-xs text-muted-foreground">设置和追踪你的目标与意图</p>
        </Link>
      </div>
    </div>
  );
}