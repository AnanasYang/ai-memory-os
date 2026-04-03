/**
 * L3 生成器 - L2→L3 跃迁逻辑
 * 
 * 核心功能：
 * 1. 多习惯聚类分析，识别共同底层原理
 * 2. L3 候选检测算法（关联强度、因果模式识别）
 * 3. 认知网络构建（supports/contradicts/generalizes/implements）
 */

const fs = require('fs');
const path = require('path');

class L3Generator {
  constructor(options = {}) {
    this.l2Dir = options.l2Dir || './memory/L2-procedural';
    this.l3Dir = options.l3Dir || './memory/L3-semantic';
    this.confidenceThreshold = options.confidenceThreshold || 0.75;
    this.minL2ClusterSize = options.minL2ClusterSize || 3;
    this.minTemporalGap = options.minTemporalGap || 7 * 24 * 60 * 60 * 1000; // 7天
  }

  /**
   * 主入口：从 L2 文件生成 L3 候选
   */
  async generateCandidates() {
    const l2Patterns = await this.loadL2Patterns();
    const clusters = this.clusterPatterns(l2Patterns);
    const candidates = this.analyzeClusters(clusters);
    
    // 生成认知网络
    const cognitiveNetwork = this.buildCognitiveNetwork(candidates);
    
    return {
      candidates,
      network: cognitiveNetwork,
      stats: {
        totalL2: l2Patterns.length,
        clusters: clusters.length,
        candidates: candidates.length
      }
    };
  }

  /**
   * 加载所有 L2 行为模式
   */
  async loadL2Patterns() {
    const patterns = [];
    
    if (!fs.existsSync(this.l2Dir)) {
      return patterns;
    }

    const files = fs.readdirSync(this.l2Dir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(this.l2Dir, f));

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const pattern = this.parseL2File(content, file);
      if (pattern) patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * 解析 L2 文件，提取结构化数据
   */
  parseL2File(content, filepath) {
    const frontmatter = this.extractFrontmatter(content);
    const body = content.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
    
    return {
      id: path.basename(filepath, '.md'),
      filepath,
      ...frontmatter,
      body,
      triggers: frontmatter.triggers || [],
      response: frontmatter.response || {},
      frequency: frontmatter.frequency || { count: 1, period: 'weekly' },
      confidence: frontmatter.confidence || 0.5,
      tags: frontmatter.tags || [],
      contexts: frontmatter.contexts || [],
      createdAt: frontmatter.created_at ? new Date(frontmatter.created_at) : new Date(),
      lastObserved: frontmatter.last_observed ? new Date(frontmatter.last_observed) : new Date()
    };
  }

  /**
   * 提取 YAML Frontmatter
   */
  extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) return {};
    
    const yaml = match[1];
    const result = {};
    
    yaml.split('\n').forEach(line => {
      const [key, ...rest] = line.split(':');
      if (key && rest.length > 0) {
        const value = rest.join(':').trim();
        try {
          result[key.trim()] = JSON.parse(value);
        } catch {
          result[key.trim()] = value;
        }
      }
    });
    
    return result;
  }

  /**
   * 聚类分析：将 L2 模式分组
   * 
   * 聚类维度：
   * 1. 语义相似性（标签、关键词）
   * 2. 情境相似性（触发条件、上下文）
   * 3. 响应相似性（反应模式、决策逻辑）
   * 4. 时间关联性（发生时间序列）
   */
  clusterPatterns(patterns) {
    const clusters = [];
    const visited = new Set();

    for (const pattern of patterns) {
      if (visited.has(pattern.id)) continue;

      const cluster = [pattern];
      visited.add(pattern.id);

      for (const other of patterns) {
        if (visited.has(other.id)) continue;

        const similarity = this.calculateSimilarity(pattern, other);
        if (similarity >= 0.7) {
          cluster.push(other);
          visited.add(other.id);
        }
      }

      if (cluster.length >= this.minL2ClusterSize) {
        clusters.push({
          id: `cluster_${clusters.length + 1}`,
          patterns: cluster,
          centroid: this.calculateCentroid(cluster),
          cohesion: this.calculateClusterCohesion(cluster)
        });
      }
    }

    return clusters;
  }

  /**
   * 计算两个 L2 模式的相似度
   */
  calculateSimilarity(p1, p2) {
    const weights = {
      semantic: 0.3,
      contextual: 0.25,
      response: 0.25,
      temporal: 0.2
    };

    const semanticSim = this.calculateSemanticSimilarity(p1, p2);
    const contextualSim = this.calculateContextualSimilarity(p1, p2);
    const responseSim = this.calculateResponseSimilarity(p1, p2);
    const temporalSim = this.calculateTemporalSimilarity(p1, p2);

    return (
      semanticSim * weights.semantic +
      contextualSim * weights.contextual +
      responseSim * weights.response +
      temporalSim * weights.temporal
    );
  }

  /**
   * 语义相似性：基于标签和关键词
   */
  calculateSemanticSimilarity(p1, p2) {
    const tags1 = new Set(p1.tags || []);
    const tags2 = new Set(p2.tags || []);
    
    if (tags1.size === 0 && tags2.size === 0) return 0.5;

    const intersection = [...tags1].filter(t => tags2.has(t)).length;
    const union = new Set([...tags1, ...tags2]).size;
    
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * 情境相似性：基于触发条件和上下文
   */
  calculateContextualSimilarity(p1, p2) {
    const triggers1 = p1.triggers || [];
    const triggers2 = p2.triggers || [];
    const contexts1 = p1.contexts || [];
    const contexts2 = p2.contexts || [];

    // 触发条件匹配
    let triggerScore = 0;
    if (triggers1.length && triggers2.length) {
      const commonTriggers = triggers1.filter(t => 
        triggers2.some(t2 => t.type === t2.type && t.value === t2.value)
      ).length;
      triggerScore = commonTriggers / Math.max(triggers1.length, triggers2.length);
    }

    // 上下文匹配
    let contextScore = 0;
    if (contexts1.length && contexts2.length) {
      const commonContexts = contexts1.filter(c => contexts2.includes(c)).length;
      contextScore = commonContexts / Math.max(contexts1.length, contexts2.length);
    }

    return (triggerScore + contextScore) / 2;
  }

  /**
   * 响应相似性：基于反应模式
   */
  calculateResponseSimilarity(p1, p2) {
    const r1 = p1.response || {};
    const r2 = p2.response || {};

    let score = 0;
    let factors = 0;

    // 决策类型
    if (r1.decision_type && r2.decision_type) {
      score += r1.decision_type === r2.decision_type ? 1 : 0;
      factors++;
    }

    // 优先级
    if (r1.priority !== undefined && r2.priority !== undefined) {
      const diff = Math.abs(r1.priority - r2.priority);
      score += Math.max(0, 1 - diff / 5);
      factors++;
    }

    // 行动类型
    if (r1.action_type && r2.action_type) {
      score += r1.action_type === r2.action_type ? 1 : 0;
      factors++;
    }

    return factors === 0 ? 0.5 : score / factors;
  }

  /**
   * 时间相似性：基于时间分布模式
   */
  calculateTemporalSimilarity(p1, p2) {
    const time1 = new Date(p1.createdAt).getTime();
    const time2 = new Date(p2.createdAt).getTime();
    const diff = Math.abs(time1 - time2);
    
    // 越接近越相似，超过阈值为0
    if (diff > this.minTemporalGap * 4) return 0;
    return 1 - (diff / (this.minTemporalGap * 4));
  }

  /**
   * 计算聚类中心
   */
  calculateCentroid(cluster) {
    const allTags = cluster.flatMap(p => p.tags || []);
    const allContexts = cluster.flatMap(p => p.contexts || []);
    
    // 提取高频标签
    const tagFreq = {};
    allTags.forEach(t => { tagFreq[t] = (tagFreq[t] || 0) + 1; });
    const topTags = Object.entries(tagFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    // 提取高频上下文
    const contextFreq = {};
    allContexts.forEach(c => { contextFreq[c] = (contextFreq[c] || 0) + 1; });
    const topContexts = Object.entries(contextFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);

    return {
      tags: topTags,
      contexts: topContexts,
      patternCount: cluster.length
    };
  }

  /**
   * 计算聚类内聚度
   */
  calculateClusterCohesion(cluster) {
    if (cluster.length < 2) return 1;

    let totalSim = 0;
    let count = 0;

    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        totalSim += this.calculateSimilarity(cluster[i], cluster[j]);
        count++;
      }
    }

    return count === 0 ? 1 : totalSim / count;
  }

  /**
   * 分析聚类，生成 L3 候选
   */
  analyzeClusters(clusters) {
    const candidates = [];

    for (const cluster of clusters) {
      // 提取底层原理
      const principles = this.extractPrinciples(cluster);
      
      // 识别跨情境一致性
      const consistency = this.identifyCrossContextConsistency(cluster);
      
      // 生成候选框架
      const candidate = this.generateFrameworkCandidate(cluster, principles, consistency);
      
      if (candidate.confidence >= this.confidenceThreshold) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  /**
   * 提取共同底层原理
   */
  extractPrinciples(cluster) {
    const patterns = cluster.patterns;
    
    // 1. 分析触发条件类型分布
    const triggerTypes = {};
    patterns.forEach(p => {
      (p.triggers || []).forEach(t => {
        triggerTypes[t.type] = (triggerTypes[t.type] || 0) + 1;
      });
    });

    // 2. 分析响应类型分布
    const responseTypes = {};
    patterns.forEach(p => {
      const type = p.response?.decision_type;
      if (type) responseTypes[type] = (responseTypes[type] || 0) + 1;
    });

    // 3. 提取高频关键词
    const allTexts = patterns.map(p => p.body).join(' ');
    const keywords = this.extractKeywords(allTexts);

    // 4. 推断原理类型
    const principleType = this.inferPrincipleType(triggerTypes, responseTypes, keywords);

    return {
      type: principleType,
      triggerDistribution: triggerTypes,
      responseDistribution: responseTypes,
      keywords: keywords.slice(0, 10),
      description: this.generatePrincipleDescription(principleType, cluster)
    };
  }

  /**
   * 提取关键词
   */
  extractKeywords(text) {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这']);
    
    const words = text.toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));

    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w);
  }

  /**
   * 推断原理类型
   */
  inferPrincipleType(triggerDist, responseDist, keywords) {
    const triggerTypes = Object.keys(triggerDist);
    const responseTypes = Object.keys(responseDist);
    const keywordSet = new Set(keywords);

    // 基于模式匹配识别原理类型
    if (responseTypes.includes('optimization') || keywordSet.has('优化') || keywordSet.has('效率')) {
      return 'efficiency_principle';
    }
    if (responseTypes.includes('avoidance') || keywordSet.has('避免') || keywordSet.has('风险')) {
      return 'risk_aversion';
    }
    if (responseTypes.includes('exploration') || keywordSet.has('探索') || keywordSet.has('尝试')) {
      return 'exploration_drive';
    }
    if (triggerTypes.includes('social_cue') || keywordSet.has('沟通') || keywordSet.has('关系')) {
      return 'social_coordination';
    }
    if (triggerTypes.includes('cognitive_load') || keywordSet.has('简化') || keywordSet.has('清晰')) {
      return 'cognitive_simplicity';
    }
    if (keywordSet.has('目标') || keywordSet.has('计划') || keywordSet.has('达成')) {
      return 'goal_orientation';
    }
    if (keywordSet.has('学习') || keywordSet.has('成长') || keywordSet.has('进步')) {
      return 'growth_mindset';
    }

    return 'behavioral_pattern';
  }

  /**
   * 生成原理描述
   */
  generatePrincipleDescription(type, cluster) {
    const descriptions = {
      efficiency_principle: '倾向于寻找最优路径，减少不必要的资源消耗',
      risk_aversion: '在面对不确定性时倾向于保守决策，优先保护现有收益',
      exploration_drive: '对新奇事物保持开放，愿意尝试不同的方法和路径',
      social_coordination: '重视人际关系的和谐与协调，会主动适应社交情境',
      cognitive_simplicity: '偏好清晰简单的信息结构，避免过度复杂的认知负担',
      goal_orientation: '以目标为导向组织和优先化行动，关注结果的达成',
      growth_mindset: '将挑战视为成长机会，相信能力可以通过努力提升',
      behavioral_pattern: '基于观察到的行为模式归纳出的认知倾向'
    };

    return descriptions[type] || descriptions.behavioral_pattern;
  }

  /**
   * 识别跨情境一致性
   */
  identifyCrossContextConsistency(cluster) {
    const contexts = cluster.patterns.flatMap(p => p.contexts || []);
    const uniqueContexts = [...new Set(contexts)];

    // 计算每个情境中该模式的表现一致性
    const contextConsistency = {};
    uniqueContexts.forEach(ctx => {
      const patternsInCtx = cluster.patterns.filter(p => 
        (p.contexts || []).includes(ctx)
      );
      
      if (patternsInCtx.length >= 2) {
        // 计算该情境下的内部一致性
        const consistency = this.calculateClusterCohesion(patternsInCtx);
        contextConsistency[ctx] = {
          count: patternsInCtx.length,
          consistency
        };
      }
    });

    // 判断是否是跨情境一致的模式
    const contextCount = Object.keys(contextConsistency).length;
    const avgConsistency = Object.values(contextConsistency)
      .reduce((sum, c) => sum + c.consistency, 0) / (contextCount || 1);

    return {
      isCrossContext: contextCount >= 2 && avgConsistency >= 0.6,
      contexts: contextConsistency,
      contextDiversity: contextCount,
      avgConsistency
    };
  }

  /**
   * 生成框架候选
   */
  generateFrameworkCandidate(cluster, principles, consistency) {
    // 置信度计算
    const cohesion = cluster.cohesion;
    const crossContextBonus = consistency.isCrossContext ? 0.15 : 0;
    const sizeBonus = Math.min((cluster.patterns.length - 3) * 0.02, 0.1);
    
    const confidence = Math.min(
      cohesion * 0.6 + consistency.avgConsistency * 0.25 + crossContextBonus + sizeBonus,
      1.0
    );

    return {
      id: `l3_candidate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceCluster: cluster.id,
      name: this.generateFrameworkName(cluster, principles),
      type: principles.type,
      description: principles.description,
      evidence: {
        l2Patterns: cluster.patterns.map(p => p.id),
        l2Count: cluster.patterns.length,
        cohesion,
        consistency
      },
      relatedTags: cluster.centroid.tags,
      applicableContexts: Object.keys(consistency.contexts),
      confidence,
      status: 'candidate',
      createdAt: new Date().toISOString(),
      metadata: {
        principles,
        centroid: cluster.centroid
      }
    };
  }

  /**
   * 生成框架名称
   */
  generateFrameworkName(cluster, principles) {
    const typeNames = {
      efficiency_principle: '效率优先思维',
      risk_aversion: '风险规避倾向',
      exploration_drive: '探索驱动模式',
      social_coordination: '社交协调本能',
      cognitive_simplicity: '认知简化原则',
      goal_orientation: '目标导向思维',
      growth_mindset: '成长型思维',
      behavioral_pattern: '行为模式框架'
    };

    const baseName = typeNames[principles.type] || typeNames.behavioral_pattern;
    
    // 如果有共同标签，用作修饰
    if (cluster.centroid.tags.length > 0) {
      const primaryTag = cluster.centroid.tags[0];
      return `${primaryTag}-${baseName}`;
    }

    return baseName;
  }

  /**
   * 构建认知网络
   */
  buildCognitiveNetwork(candidates) {
    const nodes = candidates.map(c => ({
      id: c.id,
      type: 'framework',
      label: c.name,
      level: 3,
      confidence: c.confidence,
      tags: c.relatedTags
    }));

    const edges = [];

    // 分析候选框架之间的关系
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const c1 = candidates[i];
        const c2 = candidates[j];

        const relation = this.identifyRelation(c1, c2);
        if (relation) {
          edges.push({
            source: c1.id,
            target: c2.id,
            relation: relation.type,
            strength: relation.strength
          });
        }
      }
    }

    // 添加与 L2 的连接
    for (const candidate of candidates) {
      for (const l2Id of candidate.evidence.l2Patterns) {
        edges.push({
          source: l2Id,
          target: candidate.id,
          relation: 'implements',
          strength: candidate.confidence
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * 识别两个框架之间的关系
   * 
   * 关系类型：
   * - supports: 相互支持
   * - contradicts: 相互矛盾
   * - generalizes: 一般化（c1 是 c2 的一般化）
   * - implements: 具体实现（c1 是 c2 的实现）
   */
  identifyRelation(c1, c2) {
    const tags1 = new Set(c1.relatedTags);
    const tags2 = new Set(c2.relatedTags);
    
    // 计算标签重叠
    const intersection = [...tags1].filter(t => tags2.has(t));
    const union = new Set([...tags1, ...tags2]).size;
    const similarity = union === 0 ? 0 : intersection.length / union;

    // 类型关系
    const typeHierarchy = {
      goal_orientation: ['efficiency_principle', 'exploration_drive'],
      growth_mindset: ['exploration_drive'],
      cognitive_simplicity: ['efficiency_principle']
    };

    // 检查一般化关系
    if (typeHierarchy[c1.type]?.includes(c2.type)) {
      return { type: 'generalizes', strength: 0.8 };
    }
    if (typeHierarchy[c2.type]?.includes(c1.type)) {
      return { type: 'implements', strength: 0.8 };
    }

    // 检查支持关系（高度相似但非相同类型）
    if (similarity >= 0.5) {
      return { type: 'supports', strength: similarity };
    }

    // 检查矛盾关系（某些类型的固有矛盾）
    const contradictions = [
      ['risk_aversion', 'exploration_drive'],
      ['efficiency_principle', 'exploration_drive'] // 在某些情境下
    ];

    const isContradiction = contradictions.some(pair =>
      (pair[0] === c1.type && pair[1] === c2.type) ||
      (pair[0] === c2.type && pair[1] === c1.type)
    );

    if (isContradiction) {
      return { type: 'contradicts', strength: 0.6 };
    }

    return null;
  }

  /**
   * 保存候选到文件
   */
  async saveCandidates(candidates) {
    if (!fs.existsSync(this.l3Dir)) {
      fs.mkdirSync(this.l3Dir, { recursive: true });
    }

    const saved = [];
    for (const candidate of candidates) {
      const filename = `${candidate.id}.md`;
      const filepath = path.join(this.l3Dir, filename);
      
      const content = this.generateL3FileContent(candidate);
      fs.writeFileSync(filepath, content);
      saved.push({ id: candidate.id, filepath });
    }

    return saved;
  }

  /**
   * 生成 L3 文件内容
   */
  generateL3FileContent(candidate) {
    return `---
level: 3
category: cognitive_framework
name: "${candidate.name}"
type: "${candidate.type}"
confidence: ${candidate.confidence.toFixed(3)}
status: "${candidate.status}"
created_at: "${candidate.createdAt}"
related_tags:
${candidate.relatedTags.map(t => `  - "${t}"`).join('\n')}
applicable_contexts:
${candidate.applicableContexts.map(c => `  - "${c}"`).join('\n')}
evidence:
  l2_patterns:
${candidate.evidence.l2Patterns.map(p => `    - "${p}"`).join('\n')}
  l2_count: ${candidate.evidence.l2Count}
  cohesion: ${candidate.evidence.cohesion.toFixed(3)}
---

# ${candidate.name}

## 描述

${candidate.description}

## 底层原理

${candidate.metadata.principles.description}

### 关键词
${candidate.metadata.principles.keywords.map(k => `- ${k}`).join('\n')}

## 跨情境一致性

${candidate.evidence.consistency.isCrossContext ? 
  `该认知框架在 ${Object.keys(candidate.evidence.consistency.contexts).length} 个不同情境中表现出一致性：` : 
  '该认知框架主要在特定情境中表现：'}

${Object.entries(candidate.evidence.consistency.contexts).map(([ctx, data]) => 
  `- **${ctx}**: ${data.count} 次观察，一致性 ${(data.consistency * 100).toFixed(1)}%`
).join('\n')}

## 关联模式

该框架基于以下 L2 行为模式归纳而来：

${candidate.evidence.l2Patterns.map(id => `- [[${id}]]`).join('\n')}

## 置信度评估

- **内聚度**: ${(candidate.evidence.cohesion * 100).toFixed(1)}%
- **跨情境一致性**: ${(candidate.evidence.consistency.avgConsistency * 100).toFixed(1)}%
- **总体置信度**: ${(candidate.confidence * 100).toFixed(1)}%

## 待确认问题

- [ ] 该框架是否准确反映了底层认知模式？
- [ ] 是否存在遗漏的情境？
- [ ] 与现有 L3/L4 是否存在冲突？

## 演变记录

| 时间 | 事件 | 影响 |
|------|------|------|
| ${candidate.createdAt.split('T')[0]} | 从 L2 晋升 | 初始生成，置信度 ${(candidate.confidence * 100).toFixed(1)}% |
`;
  }

  /**
   * 运行完整的 L3 生成流程
   */
  async run() {
    console.log('🔍 L3 生成器启动...');
    
    const result = await this.generateCandidates();
    
    console.log(`📊 分析结果:`);
    console.log(`  - 加载 L2 模式: ${result.stats.totalL2}`);
    console.log(`  - 形成聚类: ${result.stats.clusters}`);
    console.log(`  - L3 候选: ${result.stats.candidates}`);
    
    if (result.candidates.length > 0) {
      const saved = await this.saveCandidates(result.candidates);
      console.log(`\n✅ 已保存 ${saved.length} 个候选到 ${this.l3Dir}`);
      saved.forEach(s => console.log(`   - ${s.id}`));
    }

    // 保存网络数据
    const networkPath = path.join(this.l3Dir, '.cognitive-network.json');
    fs.writeFileSync(networkPath, JSON.stringify(result.network, null, 2));
    console.log(`\n📈 认知网络已保存到 ${networkPath}`);

    return result;
  }
}

// CLI 支持
if (require.main === module) {
  const generator = new L3Generator();
  generator.run().catch(console.error);
}

module.exports = L3Generator;
