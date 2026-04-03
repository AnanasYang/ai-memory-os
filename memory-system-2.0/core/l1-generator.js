/**
 * L1 Generator - 事件级记忆生成器
 * 
 * 功能：
 * 1. 读取 OpenClaw 会话历史
 * 2. 检测话题切换边界（时间间隔/内容相似度/显式标记）
 * 3. 按事件切分会话
 * 4. 生成独立的 L1 Markdown 文件
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置
const CONFIG = {
  // 时间间隔阈值（毫秒）- 30分钟
  TIME_GAP_THRESHOLD: 30 * 60 * 1000,
  
  // 话题切换关键词
  TOPIC_SWITCH_KEYWORDS: [
    '换个话题', '说正事', '回到主题', '另外', '还有一件事',
    '言归正传', '对了', '顺便', '换个思路', '重新说',
    'stop', '换个', '另外说', '新话题', 'topic'
  ],
  
  // L1 输出目录
  L1_OUTPUT_DIR: '/home/bruce/.openclaw/workspace/ai-memory-system/Memory/L1-episodic',
  
  // 会话数据来源（从 OpenClaw 会话存储读取）
  SESSION_DATA_PATH: process.env.OPENCLAW_SESSION_PATH || '/home/bruce/.openclaw/workspace/memory/',
  
  // 最小事件消息数
  MIN_EVENT_MESSAGES: 3,
  
  // 内容相似度阈值（0-1）
  SIMILARITY_THRESHOLD: 0.3
};

/**
 * 计算两段文本的相似度（基于词频的Jaccard相似度）
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const tokenize = (text) => {
    // 简单的分词：提取中文字符和英文单词
    const chars = text.toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
    return new Set(chars);
  };
  
  const set1 = tokenize(text1);
  const set2 = tokenize(text2);
  
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * 检测话题切换关键词
 */
function hasTopicSwitchKeyword(text) {
  if (!text) return false;
  return CONFIG.TOPIC_SWITCH_KEYWORDS.some(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * 提取消息中的主题关键词
 */
function extractTopics(messages) {
  const allText = messages.map(m => m.content || '').join(' ');
  
  // 简单的关键词提取：找出高频词汇
  const words = allText
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && w.length <= 10);
  
  const freq = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });
  
  // 过滤常见停用词并排序
  const stopWords = new Set(['这个', '那个', '什么', '怎么', '可以', '需要', '进行', '通过']);
  return Object.entries(freq)
    .filter(([word, count]) => count >= 2 && !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * 检测事件边界
 * 规则：
 * 1. 时间间隔 > 30分钟
 * 2. 用户显式话题切换标记
 * 3. 内容相似度 < 阈值
 */
function detectEventBoundaries(messages) {
  const boundaries = [0]; // 第一个消息总是边界
  
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    
    // 规则1：时间间隔检测
    const timeGap = new Date(curr.timestamp) - new Date(prev.timestamp);
    if (timeGap > CONFIG.TIME_GAP_THRESHOLD) {
      boundaries.push(i);
      continue;
    }
    
    // 规则2：显式话题切换标记
    if (hasTopicSwitchKeyword(curr.content)) {
      boundaries.push(i);
      continue;
    }
    
    // 规则3：内容相似度检测（与之前3条消息比较）
    const contextStart = Math.max(0, i - 3);
    const contextText = messages.slice(contextStart, i).map(m => m.content).join(' ');
    if (contextText && curr.content) {
      const similarity = calculateSimilarity(contextText, curr.content);
      if (similarity < CONFIG.SIMILARITY_THRESHOLD) {
        boundaries.push(i);
      }
    }
  }
  
  return boundaries;
}

/**
 * 将消息切分为事件
 */
function splitIntoEvents(messages) {
  const boundaries = detectEventBoundaries(messages);
  const events = [];
  
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1] || messages.length;
    const eventMessages = messages.slice(start, end);
    
    // 过滤过短的事件
    if (eventMessages.length >= CONFIG.MIN_EVENT_MESSAGES) {
      events.push({
        id: generateEventId(eventMessages[0].timestamp),
        messages: eventMessages,
        startTime: eventMessages[0].timestamp,
        endTime: eventMessages[eventMessages.length - 1].timestamp,
        messageCount: eventMessages.length
      });
    }
  }
  
  return events;
}

/**
 * 生成事件ID
 */
function generateEventId(timestamp) {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const hash = crypto.randomBytes(2).toString('hex');
  return `L1-${dateStr}-${hash}`;
}

/**
 * 推断事件类型
 */
function inferEventType(messages, topics) {
  const allText = messages.map(m => m.content).join(' ').toLowerCase();
  
  // 技术关键词
  const techKeywords = ['代码', '开发', 'api', '数据库', '架构', '算法', '模型', '部署', 'bug', 'feature', 'git'];
  // 工作规划关键词
  const planningKeywords = ['计划', '安排', '目标', '里程碑', '进度', 'review', '规划', '排期', 'roadmap'];
  // 闲聊关键词
  const casualKeywords = ['哈哈', '好的', '嗯嗯', '谢谢', '天气', '吃饭', '周末', '电影'];
  
  const techScore = techKeywords.filter(k => allText.includes(k)).length;
  const planningScore = planningKeywords.filter(k => allText.includes(k)).length;
  const casualScore = casualKeywords.filter(k => allText.includes(k)).length;
  
  if (planningScore > techScore && planningScore > casualScore) return '工作规划';
  if (techScore > planningScore && techScore > casualScore) return '技术讨论';
  if (casualScore > 3) return '闲聊';
  
  return '综合讨论';
}

/**
 * 提取对话要点
 */
function extractKeyPoints(messages) {
  const keyPoints = [];
  
  messages.forEach(msg => {
    const content = msg.content || '';
    
    // 检测决策/结论语句
    if (/^(决定|确定|结论|方案|选择|采用|使用)\s*/.test(content) ||
        /\s*(吧|较好|更合适|更优|推荐)$/.test(content)) {
      keyPoints.push({
        type: 'decision',
        content: content.slice(0, 100) + (content.length > 100 ? '...' : '')
      });
    }
    
    // 检测行动项
    if (/\s*(TODO|todo|待办|需要|应该|计划).*?(做|完成|处理|检查)/.test(content) ||
        /\s*(明天|后天|下周|之后).*?(做|处理|跟进)/.test(content)) {
      keyPoints.push({
        type: 'action',
        content: content.slice(0, 100) + (content.length > 100 ? '...' : '')
      });
    }
    
    // 检测重要信息
    if (content.includes('重要') || content.includes('注意') || content.includes('关键')) {
      keyPoints.push({
        type: 'info',
        content: content.slice(0, 100) + (content.length > 100 ? '...' : '')
      });
    }
  });
  
  return keyPoints.slice(0, 8); // 最多8个要点
}

/**
 * 计算持续时间（分钟）
 */
function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return Math.round((end - start) / 60000);
}

/**
 * 生成 L1 Markdown 文件内容
 */
function generateL1Markdown(event) {
  const topics = extractTopics(event.messages);
  const eventType = inferEventType(event.messages, topics);
  const keyPoints = extractKeyPoints(event.messages);
  const duration = calculateDuration(event.startTime, event.endTime);
  
  // 提取参与者
  const participants = [...new Set(event.messages.map(m => m.role === 'user' ? 'Bruce' : '小爪'))];
  
  // 生成标题
  const title = topics.length > 0 
    ? `${topics[0]}相关讨论` 
    : '会话记录';
  
  // 分离不同类型的要点
  const decisions = keyPoints.filter(p => p.type === 'decision');
  const actions = keyPoints.filter(p => p.type === 'action');
  const infoPoints = keyPoints.filter(p => p.type === 'info');
  
  // 构建 YAML Frontmatter
  const frontmatter = `---
level: L1
category: episodic
memory_id: ${event.id}
event_type: ${eventType}
participants: [${participants.join(', ')}]
duration_minutes: ${duration || 1}
topics: [${topics.join(', ')}]
related_goals: []
confidence: high
created: ${new Date(event.startTime).toISOString().split('T')[0]}
reviewed: null
---

`;

  // 构建内容
  let content = `# ${title}

`;

  // 背景
  content += `## 背景
${new Date(event.startTime).toLocaleString('zh-CN')} 开始的${eventType}。

`;

  // 对话要点
  content += `## 对话要点
`;
  if (infoPoints.length > 0) {
    infoPoints.forEach(point => {
      content += `- ${point.content}\n`;
    });
  } else {
    // 如果没有明确标记的信息点，取前3条消息作为要点
    event.messages.slice(0, 3).forEach(msg => {
      const prefix = msg.role === 'user' ? '**Bruce**' : '**小爪**';
      const text = msg.content.slice(0, 80) + (msg.content.length > 80 ? '...' : '');
      content += `- ${prefix}: ${text}\n`;
    });
  }
  content += '\n';

  // 决策/结论
  if (decisions.length > 0) {
    content += `## 决策/结论
`;
    decisions.forEach(d => {
      content += `- ${d.content}\n`;
    });
    content += '\n';
  }

  // 后续行动
  if (actions.length > 0) {
    content += `## 后续行动
`;
    actions.forEach(a => {
      content += `- [ ] ${a.content}\n`;
    });
    content += '\n';
  }

  // 原始对话摘要（可选）
  content += `## 对话摘要
<details>
<summary>查看完整对话 (${event.messageCount} 条消息)</summary>

`;
  event.messages.forEach(msg => {
    const role = msg.role === 'user' ? '👤' : '🤖';
    const text = msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '');
    content += `${role} ${text}\n\n`;
  });
  content += `</details>
`;

  return frontmatter + content;
}

/**
 * 保存 L1 文件
 */
function saveL1File(event, content) {
  const date = new Date(event.startTime);
  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const dir = path.join(CONFIG.L1_OUTPUT_DIR, yearMonth);
  
  // 确保目录存在
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const filename = `${event.id}.md`;
  const filepath = path.join(dir, filename);
  
  fs.writeFileSync(filepath, content, 'utf-8');
  return filepath;
}

/**
 * 读取 OpenClaw 会话数据
 * 支持多种格式：JSON文件、Markdown文件
 */
function readSessionData(dateStr) {
  const possiblePaths = [
    path.join(CONFIG.SESSION_DATA_PATH, `${dateStr}.json`),
    path.join(CONFIG.SESSION_DATA_PATH, `${dateStr}.md`),
    path.join(CONFIG.SESSION_DATA_PATH, dateStr.slice(0, 7), `${dateStr}.md`)
  ];
  
  for (const filepath of possiblePaths) {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf-8');
      
      // 尝试解析 JSON
      if (filepath.endsWith('.json')) {
        return JSON.parse(content);
      }
      
      // 解析 Markdown 格式的会话记录
      return parseMarkdownSession(content, dateStr);
    }
  }
  
  return null;
}

/**
 * 解析 Markdown 格式的会话记录
 */
function parseMarkdownSession(content, defaultDate) {
  const messages = [];
  const lines = content.split('\n');
  let currentRole = null;
  let currentContent = [];
  let currentTime = null;
  
  const saveCurrentMessage = () => {
    if (currentRole && currentContent.length > 0) {
      messages.push({
        role: currentRole,
        content: currentContent.join('\n').trim(),
        timestamp: currentTime || new Date(defaultDate).toISOString()
      });
    }
  };
  
  for (const line of lines) {
    // 检测用户消息（以 ## 或 **Bruce** 开头）
    if (/^##\s+|^\*\*Bruce\*\*|^\[.*\]\s*User:/i.test(line)) {
      saveCurrentMessage();
      currentRole = 'user';
      currentContent = [line.replace(/^##\s*|^\*\*Bruce\*\*\s*|^\[.*\]\s*User:\s*/i, '')];
      
      // 尝试提取时间
      const timeMatch = line.match(/\[(\d{2}:\d{2}:\d{2})\]/);
      if (timeMatch) {
        currentTime = `${defaultDate}T${timeMatch[1]}`;
      }
    }
    // 检测助手消息（以 ** 或其他标记开头）
    else if (/^\*\*小爪\*\*|^\*\*Assistant\*\*|^\[.*\]\s*Assistant:/i.test(line)) {
      saveCurrentMessage();
      currentRole = 'assistant';
      currentContent = [line.replace(/^\*\*小爪\*\*\s*|^\*\*Assistant\*\*\s*|^\[.*\]\s*Assistant:\s*/i, '')];
    }
    // 继续当前消息
    else if (currentRole) {
      currentContent.push(line);
    }
  }
  
  saveCurrentMessage();
  return messages;
}

/**
 * 主函数：生成 L1 记忆
 */
async function generateL1(dateStr = null) {
  // 默认处理昨天的数据
  if (!dateStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateStr = yesterday.toISOString().split('T')[0];
  }
  
  console.log(`[L1 Generator] 处理日期: ${dateStr}`);
  
  // 读取会话数据
  const messages = readSessionData(dateStr);
  if (!messages || messages.length === 0) {
    console.log(`[L1 Generator] 未找到 ${dateStr} 的会话数据`);
    return {
      date: dateStr,
      events: [],
      status: 'no_data'
    };
  }
  
  console.log(`[L1 Generator] 读取到 ${messages.length} 条消息`);
  
  // 切分为事件
  const events = splitIntoEvents(messages);
  console.log(`[L1 Generator] 检测到 ${events.length} 个独立事件`);
  
  // 生成并保存 L1 文件
  const results = [];
  for (const event of events) {
    const markdown = generateL1Markdown(event);
    const filepath = saveL1File(event, markdown);
    results.push({
      id: event.id,
      filepath,
      messageCount: event.messageCount,
      type: inferEventType(event.messages, extractTopics(event.messages))
    });
    console.log(`[L1 Generator] 生成: ${filepath}`);
  }
  
  return {
    date: dateStr,
    events: results,
    status: 'success',
    totalEvents: events.length
  };
}

/**
 * CLI 入口
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const dateArg = args[0]; // 可选: 指定日期 YYYY-MM-DD
  
  generateL1(dateArg)
    .then(result => {
      console.log('\n[L1 Generator] 完成');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('[L1 Generator] 错误:', err);
      process.exit(1);
    });
}

// 导出模块
module.exports = {
  generateL1,
  splitIntoEvents,
  detectEventBoundaries,
  calculateSimilarity,
  extractTopics,
  CONFIG
};
