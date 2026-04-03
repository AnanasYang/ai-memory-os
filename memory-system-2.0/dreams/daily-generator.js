#!/usr/bin/env node
/**
 * Daily Dream 2.0 - 事件级摘要生成器
 * 
 * 核心特性:
 * 1. 事件级摘要（基于 L1 事件列表）
 * 2. 叙事性结构（时间线 + 主题聚类）
 * 3. 目标/项目标签关联
 * 4. 输出: ai-memory-system/Meta/dreams/daily/YYYY-MM-DD.md
 * 
 * 版本: 2.0 (Memory System 2.0)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_ROOT = join(__dirname, '..', '..', 'ai-memory-system');
const L1_DIR = join(MEMORY_ROOT, 'Memory', 'L1-episodic');
const META_DREAMS = join(MEMORY_ROOT, 'Meta', 'dreams', 'daily');
const INTENT_GOALS = join(MEMORY_ROOT, 'Intent', 'goals');
const INTENT_PROJECTS = join(MEMORY_ROOT, 'Intent', 'projects');

// 确保目录存在
mkdirSync(META_DREAMS, { recursive: true });

const TODAY = new Date();
const DATE_STR = TODAY.toISOString().split('T')[0];
const DATE_DISPLAY = TODAY.toLocaleDateString('zh-CN', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  weekday: 'long'
});

// ==================== 数据收集 ====================

function loadIntentTags() {
  const tags = { goals: [], projects: [] };
  
  try {
    if (existsSync(INTENT_GOALS)) {
      const goalFiles = readdirSync(INTENT_GOALS).filter(f => f.endsWith('.md'));
      for (const file of goalFiles) {
        const content = readFileSync(join(INTENT_GOALS, file), 'utf-8');
        const match = content.match(/#\s*(.+)/);
        if (match) tags.goals.push({ name: match[1].trim(), file });
      }
    }
    
    if (existsSync(INTENT_PROJECTS)) {
      const projectFiles = readdirSync(INTENT_PROJECTS).filter(f => f.endsWith('.md'));
      for (const file of projectFiles) {
        const content = readFileSync(join(INTENT_PROJECTS, file), 'utf-8');
        const match = content.match(/#\s*(.+)/);
        if (match) tags.projects.push({ name: match[1].trim(), file });
      }
    }
  } catch (e) {
    console.warn('  ⚠️  读取 Intent 标签失败:', e.message);
  }
  
  return tags;
}

function loadTodayL1Events() {
  const events = [];
  const l1File = join(L1_DIR, `${DATE_STR}-daily-dream.md`);
  
  if (!existsSync(l1File)) {
    console.log('  ⚠️  今日 L1 文件不存在，尝试收集 L0 数据');
    return collectFromL0();
  }
  
  try {
    const content = readFileSync(l1File, 'utf-8');
    
    // 解析 Frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = fmMatch ? parseFrontmatter(fmMatch[1]) : {};
    
    // 提取事件片段
    const fragmentMatches = content.matchAll(/###\s*(\d{2}:\d{2}:\d{2})\n\*\*(.+?)\*\*:\s*([\s\S]*?)(?=\n###|\n##|$)/g);
    
    for (const match of fragmentMatches) {
      const time = match[1];
      const role = match[2];
      const text = match[3].trim();
      
      events.push({
        id: `evt-${DATE_STR}-${time.replace(/:/g, '')}`,
        timestamp: `${DATE_STR}T${time}`,
        time,
        role: role === '用户' ? 'user' : 'assistant',
        content: text,
        topics: extractTopics(text),
        importance: calculateImportance(text)
      });
    }
    
    // 如果没有提取到事件，使用整个内容生成一个汇总事件
    if (events.length === 0) {
      events.push({
        id: `evt-${DATE_STR}-summary`,
        timestamp: `${DATE_STR}T00:00:00`,
        time: '00:00:00',
        role: 'system',
        content: extractSummary(content),
        topics: frontmatter.topics || extractTopics(content),
        importance: 5
      });
    }
    
    return { events, frontmatter };
  } catch (e) {
    console.warn('  ⚠️  解析 L1 文件失败:', e.message);
    return collectFromL0();
  }
}

function collectFromL0() {
  const events = [];
  const sessionsDir = join(process.env.HOME, '.openclaw', 'agents', 'main', 'sessions');
  
  if (!existsSync(sessionsDir)) {
    return { events: [], frontmatter: {} };
  }
  
  const files = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
  
  for (const file of files) {
    try {
      const content = readFileSync(join(sessionsDir, file), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const record = JSON.parse(line);
        if (record.type === 'message' && record.message) {
          const recordDate = new Date(record.timestamp).toISOString().split('T')[0];
          if (recordDate === DATE_STR) {
            const text = record.message.content?.[0]?.text || '';
            events.push({
              id: `evt-${record.id || Date.now()}`,
              timestamp: record.timestamp,
              time: new Date(record.timestamp).toLocaleTimeString('zh-CN'),
              role: record.message.role,
              content: text.substring(0, 500), // 限制长度
              topics: extractTopics(text),
              importance: calculateImportance(text)
            });
          }
        }
      }
    } catch (e) {}
  }
  
  return { 
    events: events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    frontmatter: {}
  };
}

function parseFrontmatter(text) {
  const fm = {};
  text.split('\n').forEach(line => {
    const match = line.match(/^([\w-]+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      
      // 尝试解析数组
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          value = JSON.parse(value);
        } catch {}
      }
      
      fm[key] = value;
    }
  });
  return fm;
}

function extractTopics(text) {
  const topicMap = [
    { keywords: ['记忆', 'memory', 'L0', 'L1', 'L2', 'L3', 'L4', 'dream', '沉淀'], topic: '记忆系统' },
    { keywords: ['AI', 'agent', '模型', '训练', '推理', 'LLM', 'GPT', 'Claude'], topic: 'AI技术' },
    { keywords: ['任务', 'todo', '待办', '计划', '安排', 'schedule'], topic: '任务管理' },
    { keywords: ['项目', 'project', '开发', '代码', '编程', 'function'], topic: '项目开发' },
    { keywords: ['会议', 'meeting', '讨论', '对齐', 'review'], topic: '会议沟通' },
    { keywords: ['cron', '定时', '自动', '脚本', '自动化', 'heartbeat'], topic: '自动化' },
    { keywords: ['目标', 'goal', '规划', '战略', '方向'], topic: '目标规划' },
    { keywords: ['设计', 'UI', '界面', '体验', '可视化'], topic: '设计体验' }
  ];
  
  const topics = [];
  const lowerText = text.toLowerCase();
  
  for (const { keywords, topic } of topicMap) {
    if (keywords.some(k => lowerText.includes(k.toLowerCase()))) {
      topics.push(topic);
    }
  }
  
  return [...new Set(topics)];
}

function calculateImportance(text) {
  let score = 5;
  
  // 长度因子
  if (text.length > 500) score += 1;
  if (text.length > 1000) score += 1;
  
  // 代码块因子
  if (text.includes('```')) score += 2;
  
  // 决策因子
  if (/决定|确定|确认|选择|采用|使用.*方案/i.test(text)) score += 2;
  
  // 问题因子
  if (/问题|错误|失败|bug|fix/i.test(text)) score += 1;
  
  // 成果因子
  if (/完成|实现|成功|上线|部署|发布/i.test(text)) score += 2;
  
  return Math.min(score, 10);
}

function extractSummary(content) {
  const match = content.match(/## 一句话总结\n\n(.+)/);
  return match ? match[1] : '';
}

// ==================== 事件聚类 ====================

function clusterEvents(events) {
  if (events.length === 0) return [];
  
  const clusters = [];
  let currentCluster = null;
  let lastTime = null;
  
  // 时间窗口聚类（30分钟内的事件归为一组）
  const TIME_WINDOW_MS = 30 * 60 * 1000;
  
  for (const event of events) {
    const eventTime = new Date(event.timestamp).getTime();
    
    if (!currentCluster || !lastTime || (eventTime - lastTime) > TIME_WINDOW_MS) {
      // 开始新聚类
      if (currentCluster) clusters.push(currentCluster);
      currentCluster = {
        id: `cluster-${clusters.length + 1}`,
        startTime: event.timestamp,
        endTime: event.timestamp,
        events: [event],
        topics: [...event.topics],
        importance: event.importance
      };
    } else {
      // 添加到当前聚类
      currentCluster.events.push(event);
      currentCluster.endTime = event.timestamp;
      currentCluster.topics = [...new Set([...currentCluster.topics, ...event.topics])];
      currentCluster.importance = Math.max(currentCluster.importance, event.importance);
    }
    
    lastTime = eventTime;
  }
  
  if (currentCluster) clusters.push(currentCluster);
  
  // 为主题聚类生成标题和摘要
  return clusters.map(cluster => ({
    ...cluster,
    title: generateClusterTitle(cluster),
    summary: generateClusterSummary(cluster),
    duration: calculateDuration(cluster)
  }));
}

function generateClusterTitle(cluster) {
  if (cluster.topics.length > 0) {
    return `${cluster.topics[0]}相关讨论`;
  }
  
  // 从内容中提取关键词
  const content = cluster.events.map(e => e.content).join(' ');
  if (content.includes('代码') || content.includes('function')) return '代码开发';
  if (content.includes('问题') || content.includes('错误')) return '问题解决';
  if (content.includes('讨论') || content.includes('沟通')) return '讨论交流';
  
  return '对话记录';
}

function generateClusterSummary(cluster) {
  const userEvents = cluster.events.filter(e => e.role === 'user');
  const assistantEvents = cluster.events.filter(e => e.role === 'assistant');
  
  if (userEvents.length === 0) {
    return 'AI 自主执行相关任务';
  }
  
  // 提取用户的主要意图
  const firstUserMsg = userEvents[0].content.substring(0, 100);
  
  if (cluster.topics.includes('记忆系统')) {
    return `围绕记忆系统的${userEvents.length}轮讨论，涉及${cluster.topics.join('、')}`;
  }
  if (cluster.topics.includes('项目开发')) {
    return `进行${userEvents.length}轮技术讨论，涉及代码实现和方案设计`;
  }
  
  return `${userEvents.length}轮对话，主要关注${cluster.topics.join('、') || '相关话题'}`;
}

function calculateDuration(cluster) {
  const start = new Date(cluster.startTime);
  const end = new Date(cluster.endTime);
  const minutes = Math.round((end - start) / 60000);
  
  if (minutes < 1) return '< 1分钟';
  if (minutes < 60) return `${minutes}分钟`;
  return `${Math.round(minutes / 60 * 10) / 10}小时`;
}

// ==================== 标签关联 ====================

function associateTags(clusters, intentTags) {
  return clusters.map(cluster => {
    const relatedGoals = [];
    const relatedProjects = [];
    
    const clusterText = cluster.events.map(e => e.content).join(' ').toLowerCase();
    
    // 关联目标
    for (const goal of intentTags.goals) {
      if (clusterText.includes(goal.name.toLowerCase()) || 
          cluster.topics.some(t => goal.file.includes(t))) {
        relatedGoals.push(goal.name);
      }
    }
    
    // 关联项目
    for (const project of intentTags.projects) {
      if (clusterText.includes(project.name.toLowerCase()) ||
          cluster.topics.some(t => project.file.includes(t))) {
        relatedProjects.push(project.name);
      }
    }
    
    return {
      ...cluster,
      relatedGoals,
      relatedProjects
    };
  });
}

// ==================== 叙事生成 ====================

function generateNarrative(clusters, events) {
  if (clusters.length === 0) {
    return '今日暂无活动记录。';
  }
  
  const parts = [];
  
  // 开场
  const startHour = new Date(clusters[0].startTime).getHours();
  const endHour = new Date(clusters[clusters.length - 1].endTime).getHours();
  parts.push(`${DATE_DISPLAY}，活动从${startHour}点持续到${endHour}点。`);
  
  // 统计
  const totalEvents = events.length;
  const totalTopics = [...new Set(clusters.flatMap(c => c.topics))];
  parts.push(`全天共产生${totalEvents}个事件记录，涉及${totalTopics.length}个主题领域。`);
  
  // 高光时刻（重要性最高的事件）
  const topClusters = clusters
    .filter(c => c.importance >= 7)
    .slice(0, 3);
  
  if (topClusters.length > 0) {
    parts.push(`今日重点：`);
    for (const cluster of topClusters) {
      const time = new Date(cluster.startTime).getHours();
      parts.push(`- ${time}点左右，${cluster.title}，持续了${cluster.duration}`);
    }
  }
  
  return parts.join('\n\n');
}

// ==================== L2 候选检测 ====================

function detectL2Candidates(clusters) {
  const candidates = [];
  
  // 主题频率统计
  const topicFreq = {};
  clusters.forEach(c => {
    c.topics.forEach(t => {
      topicFreq[t] = (topicFreq[t] || 0) + 1;
    });
  });
  
  // 检测高频主题
  for (const [topic, count] of Object.entries(topicFreq)) {
    if (count >= 2) {
      candidates.push({
        id: `l2-${DATE_STR}-${topic}`,
        type: 'topic-recurrence',
        name: `关注${topic}`,
        description: `今日${count}次讨论${topic}相关内容`,
        confidence: Math.min(count / 5, 0.9),
        occurrences: count,
        sources: clusters.filter(c => c.topics.includes(topic)).map(c => c.id),
        status: 'pending'
      });
    }
  }
  
  // 检测工作时段模式
  const hours = clusters.map(c => new Date(c.startTime).getHours());
  if (hours.length >= 3) {
    const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
    candidates.push({
      id: `l2-${DATE_STR}-time-preference`,
      type: 'time-preference',
      name: '活跃时段偏好',
      description: `今日主要在${avgHour}:00左右进行深度对话`,
      confidence: 0.6,
      occurrences: hours.length,
      sources: clusters.map(c => c.id),
      status: 'pending'
    });
  }
  
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

// ==================== 输出生成 ====================

function generateDailyDream(clusters, events, candidates, narrative, intentTags) {
  const totalUserEvents = events.filter(e => e.role === 'user').length;
  const totalAssistantEvents = events.filter(e => e.role === 'assistant').length;
  const allTopics = [...new Set(clusters.flatMap(c => c.topics))];
  
  const content = `---
level: Meta
category: daily-dream
date: ${DATE_STR}
generated_at: ${new Date().toISOString()}
version: "2.0"
events_count: ${events.length}
clusters_count: ${clusters.length}
l2_candidates: ${candidates.length}
topics: ${JSON.stringify(allTopics)}
related_goals: ${JSON.stringify([...new Set(clusters.flatMap(c => c.relatedGoals))])}
related_projects: ${JSON.stringify([...new Set(clusters.flatMap(c => c.relatedProjects))])}
---

# 🌙 Daily Dream 2.0 - ${DATE_DISPLAY}

**生成时间**: ${new Date().toLocaleString('zh-CN')}  
**数据版本**: 2.0 (Event-Level)

---

## 📊 今日概览

| 指标 | 数值 |
|------|------|
| 事件总数 | ${events.length} |
| 会话聚类 | ${clusters.length} |
| 用户消息 | ${totalUserEvents} |
| AI 回复 | ${totalAssistantEvents} |
| 主题领域 | ${allTopics.length} |
| L2 候选 | ${candidates.length} |

---

## 📝 今日叙事

${narrative}

---

## 🔑 关键事件 (${clusters.length})

${clusters.map((cluster, i) => `
### ${i + 1}. ${cluster.title} ${'⭐'.repeat(Math.max(0, cluster.importance - 7))}

**时间**: ${new Date(cluster.startTime).toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})} - ${new Date(cluster.endTime).toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})} (持续${cluster.duration})  
**主题**: ${cluster.topics.join('、') || '未分类'}  
**重要性**: ${cluster.importance}/10

**摘要**: ${cluster.summary}

**关联目标**: ${cluster.relatedGoals.join('、') || '无'}  
**关联项目**: ${cluster.relatedProjects.join('、') || '无'}

<details>
<summary>查看详情 (${cluster.events.length} 条记录)</summary>

${cluster.events.map(e => `- **[${e.time}]** ${e.role === 'user' ? '👤' : '🤖'} ${e.content.substring(0, 150)}${e.content.length > 150 ? '...' : ''}`).join('\n')}

</details>
`).join('\n')}

---

## 🧬 L2 沉淀候选 (${candidates.length})

${candidates.length > 0 ? candidates.map((c, i) => `
### ${i + 1}. ${c.name}

- **类型**: ${c.type}
- **描述**: ${c.description}
- **置信度**: ${(c.confidence * 100).toFixed(0)}%
- **出现次数**: ${c.occurrences}
- **状态**: ⏳ 待 Review
`).join('\n') : '> 今日未检测到 L2 沉淀候选'}

---

## 🏷️ 主题分布

${allTopics.map(t => `- **${t}**: 出现 ${clusters.filter(c => c.topics.includes(t)).length} 次`).join('\n')}

---

## 🔗 记忆层级流转

\`\`\`
L0 (原始会话)
    ↓
L1 (事件提取) ← 今日生成 ${events.length} 个事件
    ↓
事件聚类 ← 聚合成 ${clusters.length} 个会话
    ↓
Daily Dream 2.0 ← 本报告
    ↓
L2 候选 ← ${candidates.length} 个待 Review
    ↓
Weekly Review ← 每周日确认
\`\`\`

---

## 📁 相关文件

- **L1 原始**: \`Memory/L1-episodic/${DATE_STR}-daily-dream.md\`
- **Intent 目标**: \`Intent/goals/\`
- **Intent 项目**: \`Intent/projects/\`

---

*此报告由 Daily Dream 2.0 自动生成*  
*Memory System 2.0 | Dreams 机制重构*
`;
  
  return content;
}

// ==================== 主流程 ====================

function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     🌙 DAILY DREAM 2.0 - EVENT LEVEL      ║');
  console.log('║     Narrative Memory Summary Generator    ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`\n📅 Date: ${DATE_DISPLAY}`);
  console.log(`📁 Output: ${META_DREAMS}`);
  console.log('');
  
  // 1. 加载 Intent 标签
  console.log('🏷️  Step 1: Loading Intent tags...');
  const intentTags = loadIntentTags();
  console.log(`   ✅ Goals: ${intentTags.goals.length}, Projects: ${intentTags.projects.length}`);
  
  // 2. 加载今日 L1 事件
  console.log('\n📥 Step 2: Loading L1 events...');
  const { events, frontmatter } = loadTodayL1Events();
  console.log(`   ✅ Loaded ${events.length} events`);
  
  if (events.length === 0) {
    console.log('\n⚠️  No events found for today. Generating empty report.');
  }
  
  // 3. 事件聚类
  console.log('\n🔄 Step 3: Clustering events...');
  const clusters = clusterEvents(events);
  console.log(`   ✅ Formed ${clusters.length} clusters`);
  
  // 4. 标签关联
  console.log('\n🔗 Step 4: Associating tags...');
  const taggedClusters = associateTags(clusters, intentTags);
  const taggedCount = taggedClusters.filter(c => c.relatedGoals.length > 0 || c.relatedProjects.length > 0).length;
  console.log(`   ✅ ${taggedCount} clusters tagged with goals/projects`);
  
  // 5. 生成叙事
  console.log('\n📖 Step 5: Generating narrative...');
  const narrative = generateNarrative(taggedClusters, events);
  console.log(`   ✅ Narrative generated (${narrative.length} chars)`);
  
  // 6. 检测 L2 候选
  console.log('\n🔍 Step 6: Detecting L2 candidates...');
  const candidates = detectL2Candidates(taggedClusters);
  console.log(`   ✅ Found ${candidates.length} L2 candidates`);
  
  // 7. 生成报告
  console.log('\n📝 Step 7: Generating Daily Dream report...');
  const report = generateDailyDream(taggedClusters, events, candidates, narrative, intentTags);
  
  // 8. 保存
  const outputFile = join(META_DREAMS, `${DATE_STR}.md`);
  writeFileSync(outputFile, report);
  console.log(`   ✅ Saved: ${outputFile}`);
  
  // 9. 保存 L2 候选
  if (candidates.length > 0) {
    const candidatesDir = join(MEMORY_ROOT, 'Memory', 'L2-procedural', 'candidates');
    mkdirSync(candidatesDir, { recursive: true });
    const candidatesFile = join(candidatesDir, `daily-${DATE_STR}.json`);
    writeFileSync(candidatesFile, JSON.stringify({
      date: DATE_STR,
      source: 'daily-dream-v2',
      candidates
    }, null, 2));
    console.log(`   ✅ L2 candidates saved: ${candidatesFile}`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ DAILY DREAM 2.0 COMPLETE       ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Events: ${events.length}`);
  console.log(`📦 Clusters: ${clusters.length}`);
  console.log(`🎯 L2 Candidates: ${candidates.length}`);
  console.log(`📁 Output: ${outputFile}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
