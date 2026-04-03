/**
 * L2 Detector - 模式归纳引擎
 * 
 * 功能：
 * 1. 扫描待 review 的 L1 文件
 * 2. 基于"相似情境→相似反应"检测重复模式
 * 3. 生成候选 L2 描述
 * 4. 写入 Meta/candidates.json
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // L1 源目录
  L1_SOURCE_DIR: '/home/bruce/.openclaw/workspace/ai-memory-system/Memory/L1-episodic',
  
  // L2 输出目录
  L2_OUTPUT_DIR: '/home/bruce/.openclaw/workspace/ai-memory-system/Memory/L2-procedural',
  
  // 候选文件路径
  CANDIDATES_PATH: '/home/bruce/.openclaw/workspace/ai-memory-system/Meta/candidates.json',
  
  // 最小时间跨度（天）- 7天
  MIN_TIME_SPAN_DAYS: 7,
  
  // 最小事件数 - 3次
  MIN_OCCURRENCES: 3,
  
  // 相似度阈值 - 用于聚类
  CLUSTER_SIMILARITY_THRESHOLD: 0.6,
  
  // 最大候选数
  MAX_CANDIDATES: 20
};

/**
 * 计算文本相似度（改进版余弦相似度）
 */
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const getWordFreq = (text) => {
    const words = text.toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);
    
    const freq = {};
    words.forEach(w => {
      freq[w] = (freq[w] || 0) + 1;
    });
    return freq;
  };
  
  const freq1 = getWordFreq(text1);
  const freq2 = getWordFreq(text2);
  
  const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  allWords.forEach(word => {
    const v1 = freq1[word] || 0;
    const v2 = freq2[word] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * 计算主题重叠度
 */
function calculateTopicOverlap(topics1, topics2) {
  if (!topics1 || !topics2 || topics1.length === 0 || topics2.length === 0) {
    return 0;
  }
  
  const set1 = new Set(topics1.map(t => t.toLowerCase()));
  const set2 = new Set(topics2.map(t => t.toLowerCase()));
  
  const intersection = [...set1].filter(x => set2.has(x));
  const union = new Set([...set1, ...set2]);
  
  return intersection.length / union.size;
}

/**
 * 解析 YAML Frontmatter
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const yaml = match[1];
  const result = {};
  
  yaml.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      
      // 解析数组 [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim()).filter(v => v);
      }
      // 解析布尔值
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (value === 'null') value = null;
      
      result[key] = value;
    }
  });
  
  return result;
}

/**
 * 提取 Markdown 正文内容（不含 frontmatter）
 */
function extractBody(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

/**
 * 读取所有 L1 文件
 */
function readAllL1Files() {
  const files = [];
  
  if (!fs.existsSync(CONFIG.L1_SOURCE_DIR)) {
    return files;
  }
  
  // 递归读取所有 .md 文件
  const readDir = (dir) => {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        readDir(fullPath);
      } else if (item.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const frontmatter = parseFrontmatter(content);
          const body = extractBody(content);
          
          files.push({
            filepath: fullPath,
            memory_id: frontmatter.memory_id || path.basename(item, '.md'),
            created: frontmatter.created,
            topics: frontmatter.topics || [],
            event_type: frontmatter.event_type || 'unknown',
            participants: frontmatter.participants || [],
            reviewed: frontmatter.reviewed,
            content: body,
            title: body.match(/^# (.+)$/m)?.[1] || '无标题'
          });
        } catch (err) {
          console.warn(`[L2 Detector] 读取文件失败: ${fullPath}`, err.message);
        }
      }
    }
  };
  
  readDir(CONFIG.L1_SOURCE_DIR);
  return files;
}

/**
 * 计算事件间的综合相似度
 * 包括：主题重叠 + 内容相似 + 类型匹配
 */
function calculateEventSimilarity(event1, event2) {
  // 主题相似度（权重 0.4）
  const topicSim = calculateTopicOverlap(event1.topics, event2.topics);
  
  // 内容相似度（权重 0.4）
  const contentSim = calculateTextSimilarity(event1.content, event2.content);
  
  // 类型匹配度（权重 0.2）
  const typeSim = event1.event_type === event2.event_type ? 1 : 0;
  
  return topicSim * 0.4 + contentSim * 0.4 + typeSim * 0.2;
}

/**
 * 基于相似度进行层次聚类
 */
function clusterEvents(events) {
  const clusters = [];
  const used = new Set();
  
  // 按时间排序
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.created) - new Date(b.created)
  );
  
  for (let i = 0; i < sortedEvents.length; i++) {
    if (used.has(i)) continue;
    
    const cluster = [sortedEvents[i]];
    used.add(i);
    
    for (let j = i + 1; j < sortedEvents.length; j++) {
      if (used.has(j)) continue;
      
      // 计算与簇中所有成员的平均相似度
      let totalSim = 0;
      for (const member of cluster) {
        totalSim += calculateEventSimilarity(sortedEvents[j], member);
      }
      const avgSim = totalSim / cluster.length;
      
      if (avgSim >= CONFIG.CLUSTER_SIMILARITY_THRESHOLD) {
        cluster.push(sortedEvents[j]);
        used.add(j);
      }
    }
    
    if (cluster.length >= CONFIG.MIN_OCCURRENCES) {
      clusters.push(cluster);
    }
  }
  
  return clusters;
}

/**
 * 计算时间跨度（天）
 */
function calculateTimeSpan(events) {
  const dates = events
    .map(e => new Date(e.created))
    .filter(d => !isNaN(d));
  
  if (dates.length < 2) return 0;
  
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  
  return Math.round((max - min) / (1000 * 60 * 60 * 24));
}

/**
 * 从聚类中提取共同模式
 */
function extractPattern(cluster) {
  // 提取共同主题
  const allTopics = cluster.flatMap(e => e.topics);
  const topicFreq = {};
  allTopics.forEach(t => {
    topicFreq[t] = (topicFreq[t] || 0) + 1;
  });
  
  const commonTopics = Object.entries(topicFreq)
    .filter(([_, count]) => count >= cluster.length * 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
  
  // 推断模式类型
  const types = cluster.map(e => e.event_type);
  const typeFreq = {};
  types.forEach(t => {
    typeFreq[t] = (typeFreq[t] || 0) + 1;
  });
  const dominantType = Object.entries(typeFreq)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  
  // 生成模式名称
  const patternName = commonTopics.length > 0
    ? `${commonTopics[0]}相关的重复模式`
    : `${dominantType}行为模式`;
  
  // 生成模式描述
  const timeSpan = calculateTimeSpan(cluster);
  const description = generatePatternDescription(cluster, commonTopics, dominantType, timeSpan);
  
  return {
    name: patternName,
    description,
    type: mapEventTypeToPatternType(dominantType),
    commonTopics,
    timeSpan,
    occurrences: cluster.length
  };
}

/**
 * 映射事件类型到模式类型
 */
function mapEventTypeToPatternType(eventType) {
  const mapping = {
    '技术讨论': 'workflow',
    '工作规划': 'planning',
    '闲聊': 'communication',
    '综合讨论': 'general'
  };
  return mapping[eventType] || 'pattern';
}

/**
 * 生成模式描述
 */
function generatePatternDescription(cluster, commonTopics, eventType, timeSpan) {
  const topicStr = commonTopics.slice(0, 3).join('、') || '相关主题';
  
  // 分析行为特点
  const contentSamples = cluster.slice(0, 3).map(e => {
    const lines = e.content.split('\n').filter(l => l.trim());
    return lines.slice(0, 2).join(' ');
  });
  
  return `在过去 ${timeSpan} 天内观察到 ${cluster.length} 次关于"${topicStr}"的${eventType}模式。

观察到的重复特征：
${contentSamples.map((s, i) => `${i + 1}. ${s.slice(0, 80)}${s.length > 80 ? '...' : ''}`).join('\n')}

建议：此模式可能反映了稳定的工作习惯或偏好，可考虑将其固化为标准流程。`;
}

/**
 * 计算置信度
 */
function calculateConfidence(cluster, pattern) {
  let score = 0;
  
  // 事件数量（最多40分）
  score += Math.min(cluster.length * 10, 40);
  
  // 时间跨度（至少7天，最多30分）
  const timeSpan = calculateTimeSpan(cluster);
  if (timeSpan >= 30) score += 30;
  else if (timeSpan >= 14) score += 20;
  else if (timeSpan >= 7) score += 10;
  
  // 主题一致性（最多20分）
  if (pattern.commonTopics.length >= 3) score += 20;
  else if (pattern.commonTopics.length >= 2) score += 15;
  else if (pattern.commonTopics.length >= 1) score += 10;
  
  // 内容相似度（最多10分）
  let totalSim = 0;
  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      totalSim += calculateTextSimilarity(cluster[i].content, cluster[j].content);
    }
  }
  const avgSim = totalSim / (cluster.length * (cluster.length - 1) / 2);
  score += avgSim * 10;
  
  return Math.min(score / 100, 0.99);
}

/**
 * 生成 L2 Markdown 内容
 */
function generateL2Markdown(pattern, cluster) {
  const evidence = cluster.map(e => ({
    id: e.memory_id,
    date: e.created,
    title: e.title
  }));
  
  const frontmatter = `---
level: L2
category: procedural
memory_id: ${pattern.name.replace(/\s+/g, '-').toLowerCase()}
pattern_type: ${pattern.type}
occurrences: ${pattern.occurrences}
confidence: ${pattern.confidence >= 0.8 ? 'high' : pattern.confidence >= 0.6 ? 'medium' : 'low'}
created: ${new Date().toISOString().split('T')[0]}
reviewed: null
sources: [${evidence.map(e => e.id).join(', ')}]
---

`;

  let content = `# ${pattern.name}

`;
  content += `## 模式描述
${pattern.description}

`;
  content += `## 关键特征
`;
  if (pattern.commonTopics.length > 0) {
    content += `- 相关主题: ${pattern.commonTopics.join(', ')}\n`;
  }
  content += `- 出现频次: ${pattern.occurrences} 次\n`;
  content += `- 时间跨度: ${pattern.timeSpan} 天\n`;
  content += `- 模式类型: ${pattern.type}\n`;
  content += `- 置信度: ${(pattern.confidence * 100).toFixed(1)}%\n\n`;

  content += `## 证据来源
`;
  evidence.forEach(e => {
    content += `- [${e.id}](${e.date}) ${e.title}\n`;
  });
  content += '\n';

  content += `## 应用建议
- 在类似情境下采用此模式\n`;
  content += `- 定期 review 是否需要调整\n`;
  content += `- 若发现例外情况，记录并分析原因\n`;

  return frontmatter + content;
}

/**
 * 读取现有候选
 */
function readExistingCandidates() {
  if (!fs.existsSync(CONFIG.CANDIDATES_PATH)) {
    return [];
  }
  
  try {
    const content = fs.readFileSync(CONFIG.CANDIDATES_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.warn('[L2 Detector] 读取候选文件失败:', err.message);
    return [];
  }
}

/**
 * 保存候选
 */
function saveCandidates(candidates) {
  // 确保目录存在
  const dir = path.dirname(CONFIG.CANDIDATES_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 合并并去重
  const existing = readExistingCandidates();
  const existingIds = new Set(existing.map(c => c.id));
  
  const merged = [
    ...existing,
    ...candidates.filter(c => !existingIds.has(c.id))
  ];
  
  // 限制数量
  const limited = merged.slice(-CONFIG.MAX_CANDIDATES);
  
  fs.writeFileSync(CONFIG.CANDIDATES_PATH, JSON.stringify(limited, null, 2), 'utf-8');
  return limited.length;
}

/**
 * 生成 L2 候选
 */
function generateL2Candidates(events = null) {
  console.log('[L2 Detector] 开始检测模式...');
  
  // 读取所有 L1 文件
  const allEvents = events || readAllL1Files();
  console.log(`[L2 Detector] 读取到 ${allEvents.length} 个 L1 事件`);
  
  // 过滤未 review 的事件
  const unreviewedEvents = allEvents.filter(e => !e.reviewed);
  console.log(`[L2 Detector] 未 review 事件: ${unreviewedEvents.length}`);
  
  // 聚类分析
  const clusters = clusterEvents(unreviewedEvents);
  console.log(`[L2 Detector] 发现 ${clusters.length} 个潜在模式`);
  
  // 生成候选
  const candidates = [];
  
  for (const cluster of clusters) {
    const pattern = extractPattern(cluster);
    pattern.confidence = calculateConfidence(cluster, pattern);
    
    // 只保留高置信度的候选
    if (pattern.confidence >= 0.6) {
      const candidateId = `candidate-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      candidates.push({
        id: candidateId,
        name: pattern.name,
        description: pattern.description,
        confidence: pattern.confidence,
        source: cluster.map(e => e.memory_id).join(', '),
        occurrences: pattern.occurrences,
        level: 'L2',
        type: pattern.type,
        createdAt: new Date().toISOString(),
        status: 'pending',
        details: `检测到的模式：${pattern.commonTopics.join(', ')}`,
        evidence: cluster.map(e => ({
          id: e.memory_id,
          date: e.created,
          preview: e.content.slice(0, 100)
        })),
        timeSpan: pattern.timeSpan,
        markdown: generateL2Markdown(pattern, cluster)
      });
    }
  }
  
  // 保存候选
  const totalSaved = saveCandidates(candidates);
  
  console.log(`[L2 Detector] 生成 ${candidates.length} 个候选，总计 ${totalSaved} 个候选`);
  
  return {
    scanned: allEvents.length,
    unreviewed: unreviewedEvents.length,
    clustersFound: clusters.length,
    candidatesGenerated: candidates.length,
    candidates: candidates.map(c => ({
      id: c.id,
      name: c.name,
      confidence: c.confidence,
      occurrences: c.occurrences
    }))
  };
}

/**
 * 主函数
 */
async function detectL2Patterns() {
  return generateL2Candidates();
}

/**
 * CLI 入口
 */
if (require.main === module) {
  detectL2Patterns()
    .then(result => {
      console.log('\n[L2 Detector] 完成');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('[L2 Detector] 错误:', err);
      process.exit(1);
    });
}

// 导出模块
module.exports = {
  detectL2Patterns,
  generateL2Candidates,
  clusterEvents,
  calculateTextSimilarity,
  calculateTopicOverlap,
  readAllL1Files,
  CONFIG
};
