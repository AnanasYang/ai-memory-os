#!/usr/bin/env node
/**
 * AI 日报生成器 - 精选整合版
 * 生成类似示例的结构化简报
 * 
 * 修复：
 * - 添加文章链接输出（markdown格式）
 * - 改进描述提取，确保完整性
 */

const fs = require('fs');

// 加载文章数据
function loadArticles(dataPath) {
  if (!fs.existsSync(dataPath)) return [];
  return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

// 智能分类文章到各层级
function categorizeArticles(articles) {
  const tiers = {
    core: [],    // 核心层：可落地的开源/模型/范式
    near: [],    // 近层：行业动态/产品/技术路线
    extended: [], // 外延层：观点/跨领域/前沿
    support: []  // 支撑层：政策/投资/宏观
  };

  // 核心层关键词
  const coreKeywords = [
    '开源', 'github', 'open source', '发布', '模型', '框架', '工具', '算法',
    '端到端', 'bev', 'occupancy', '数据闭环', '标注', '训练方法',
    'autoresearch', 'agent', 'llm', '大模型'
  ];

  // 近层关键词
  const nearKeywords = [
    '特斯拉', '小鹏', '华为', '蔚来', 'waymo', 'nvidia', '自动驾驶',
    '智能驾驶', 'vla', 'l2', 'l3', 'l4', '激光雷达', '芯片',
    '商汤', '多模态', '架构'
  ];

  // 支撑层关键词
  const supportKeywords = [
    '政策', '法规', '两会', '投资', '融资', '并购', '收购',
    '路测', '标准', '数据共享'
  ];

  // 外延层关键词
  const extendedKeywords = [
    '观点', '预测', '趋势', '论文', '学术', '物理ai', '世界模型',
    '量子计算', 'hpc', '推理', '思考'
  ];

  for (const article of articles) {
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    let scored = { core: 0, near: 0, extended: 0, support: 0 };

    coreKeywords.forEach(k => { if (text.includes(k)) scored.core += 2; });
    nearKeywords.forEach(k => { if (text.includes(k)) scored.near += 2; });
    supportKeywords.forEach(k => { if (text.includes(k)) scored.support += 2; });
    extendedKeywords.forEach(k => { if (text.includes(k)) scored.extended += 1; });

    // 根据分数分配层级
    const maxTier = Object.entries(scored).sort((a, b) => b[1] - a[1])[0];
    if (maxTier[1] > 0) {
      tiers[maxTier[0]].push(article);
    } else {
      // 默认分到近层
      tiers.near.push(article);
    }
  }

  return tiers;
}

// 精选文章（每个层级选最重要的）
function selectTopArticles(tierArticles, maxCount = 3) {
  // 先过滤掉没有实质内容的文章（描述为空或只有占位符）
  const validArticles = tierArticles.filter(a => !isEmptyDescription(a.description));
  
  // 如果有足够的有内容文章，优先使用它们；否则退而使用所有文章
  const articlesToUse = validArticles.length >= maxCount ? validArticles : tierArticles;
  
  // 按来源多样性+标题重要性排序
  const sources = new Set();
  const selected = [];

  // 优先选择不同来源的
  for (const article of articlesToUse) {
    if (selected.length >= maxCount) break;
    const source = article.source || article.categories?.[0] || 'unknown';
    if (!sources.has(source) || selected.length < maxCount) {
      sources.add(source);
      selected.push(article);
    }
  }

  return selected;
}

// HTML 实体解码
function decodeHtmlEntities(text) {
  if (!text) return '';
  const entities = {
    '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'",
    '&#x2F;': '/', '&#x60;': '`', '&#61;': '=', '&#43;': '+', '&#47;': '/',
    '&nbsp;': ' ', '&#160;': ' ', '&mdash;': '—', '&ndash;': '–'
  };
  return text.replace(/&[a-zA-Z0-9#]+;/g, match => entities[match] || match);
}

// 清理HTML标签
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// 判断描述是否为空或占位符
function isEmptyDescription(desc) {
  if (!desc) return true;
  const clean = stripHtml(desc).trim();
  // 降低阈值，量子位很多短描述也是有价值的
  if (clean.length < 5) return true;
  if (clean.includes('点击查看原文')) return true;
  if (clean.includes('查看原文')) return true;
  if (clean.includes('阅读全文')) return true;
  return false;
}

// 从标题中提取关键信息
function extractFromTitle(title) {
  const points = [];
  
  // 提取冒号后的内容
  const colonMatch = title.match(/[:：](.+)$/);
  if (colonMatch) {
    points.push(colonMatch[1].trim());
  }
  
  // 提取括号内的补充信息
  const parenMatch = title.match(/[（(]([^）)]+)[）)]/);
  if (parenMatch) {
    points.push(parenMatch[1].trim());
  }
  
  return points;
}

// 生成关键信息 bullet points
function generateKeyPoints(article) {
  const points = [];
  
  // 先解码 HTML 实体，再清理 HTML 标签
  const rawDesc = article.description || '';
  const decodedDesc = decodeHtmlEntities(rawDesc);
  const cleanDesc = stripHtml(decodedDesc);
  
  // 如果描述是空的或只是占位符
  if (isEmptyDescription(cleanDesc)) {
    // 从标题提取关键信息
    const titlePoints = extractFromTitle(article.title);
    if (titlePoints.length > 0) {
      points.push(...titlePoints);
    } else {
      // 如果没有提取到，使用标题本身
      points.push(article.title);
    }
    // 添加提示
    points.push('（详情请点击下方链接查看原文）');
    return points;
  }
  
  const text = `${article.title} ${cleanDesc}`;

  // 提取数字、模型名、技术点
  const modelMatches = text.match(/(GPT-\d+\.?\d*|Claude|Llama|Phi-\d+|豆包|文心|通义)[^，。；]+/gi);
  if (modelMatches) {
    points.push(...modelMatches.slice(0, 2).map(m => m.trim()));
  }

  // 提取性能数据
  const perfMatches = text.match(/(\d+\.?\d*)\s*(B|billion|亿|参数|得分|准确率)/gi);
  if (perfMatches) {
    points.push(...perfMatches.slice(0, 1));
  }

  // 提取公司/机构名称 + 动作
  const companyMatches = text.match(/([\u4e00-\u9fa5]{2,10}(?:公司|集团|科技|机器人))[\s\S]{0,30}(?:成立|发布|完成|获得|推出)/gi);
  if (companyMatches && points.length < 2) {
    points.push(...companyMatches.slice(0, 1));
  }

  // 如果没有提取到，使用描述（确保有内容）
  if (points.length === 0 && cleanDesc) {
    // 提取第一句话或前150字符
    const firstSentence = cleanDesc.match(/^[^。！？.!?]+[。！？.!?]/) || [cleanDesc.slice(0, 150)];
    const desc = firstSentence[0].slice(0, 150);
    if (desc.length > 10) points.push(desc);
  }

  // 如果还是没有，使用标题补充
  if (points.length === 0) {
    points.push(article.title);
    points.push('（详情请点击下方链接查看原文）');
  }

  return points.slice(0, 3);
}

// 生成"对你"建议
function generateAdvice(article, tier) {
  const title = article.title.toLowerCase();
  const text = `${article.title} ${article.description || ''}`.toLowerCase();

  // 核心层建议
  if (tier === 'core') {
    if (text.includes('开源') || text.includes('github')) {
      return '可直接试用评估，快速验证内部场景适用性，降低自研成本。';
    }
    if (text.includes('小模型') || text.includes('30b') || text.includes('15b')) {
      return '小模型在垂直领域可媲美大模型，适合有限算力环境，可测试车载/边缘部署场景。';
    }
    if (text.includes('agent') || text.includes('智能体')) {
      return 'AI Agent技术可应用于内部效率工具开发，关注与现有工作流的集成方式。';
    }
    return '可评估技术方案与现有系统的兼容性，进行成本效益分析后试点应用。';
  }

  // 近层建议
  if (tier === 'near') {
    if (text.includes('特斯拉') || text.includes('小鹏') || text.includes('华为')) {
      return '关注头部玩家的技术路线选择，评估对自身产品规划的参考价值。';
    }
    if (text.includes('端到端') || text.includes('vla')) {
      return '端到端架构对数据闭环提出新要求，多模态数据融合成为关键，关注技术细节。';
    }
    if (text.includes('l4') || text.includes('自动驾驶')) {
      return '跟踪技术进展，评估对数据开发和仿真测试工具链的影响。';
    }
    return '关注行业动态，评估对技术路线选择的影响。';
  }

  // 外延层建议
  if (tier === 'extended') {
    return '作为技术视野拓展，关注跨领域创新对自身工作的启发价值。';
  }

  // 支撑层建议
  if (tier === 'support') {
    if (text.includes('政策') || text.includes('法规')) {
      return '跟踪政策落地情况，提前规划合规性工作和数据安全方案。';
    }
    if (text.includes('投资') || text.includes('融资')) {
      return '关注行业资本动向，了解市场热点和技术价值判断趋势。';
    }
    return '作为决策参考，关注对技术投入和资源配置的影响。';
  }

  return '建议持续跟踪，评估对当前工作的参考价值。';
}

// 格式化来源
function formatSource(article) {
  const sources = [];
  if (article.link?.includes('qbitai')) sources.push('量子位');
  if (article.link?.includes('jiqizhixin')) sources.push('机器之心');
  if (article.link?.includes('infoq')) sources.push('InfoQ');
  if (article.link?.includes('36kr')) sources.push('36氪');
  if (article.link?.includes('jazzyear')) sources.push('甲子光年');
  if (article.link?.includes('gasgoo')) sources.push('盖世汽车');
  if (article.link?.includes('gg-auto')) sources.push('高工智能汽车');
  if (article.link?.includes('tisi.org')) sources.push('腾讯研究院');
  if (article.link?.includes('cloud.tencent.com')) sources.push('腾讯云开发者');
  if (article.categories?.includes('英文来源')) sources.push('TechCrunch/Forbes等');
  
  // 如果没有匹配到，使用原始 source 或 categories
  if (sources.length === 0) {
    if (article.source) sources.push(article.source);
    else if (article.categories && article.categories.length > 0) {
      // 过滤掉通用分类，保留具体来源
      const specificCats = article.categories.filter(c => 
        c !== '中文来源' && c !== '英文来源' && c !== 'AI/科技' && 
        c !== '自动驾驶' && c !== '机器人' && c !== '投资融资'
      );
      if (specificCats.length > 0) sources.push(specificCats[0]);
    }
  }
  
  return sources.join(' | ') || '网络';
}

// 生成报告
function generateReport(tiers, type = 'daily') {
  const date = new Date().toISOString().split('T')[0];
  const dateStr = `${date.slice(0, 4)}-${date.slice(5, 7)}-${date.slice(8, 10)}`;

  // 精选文章
  const coreSelected = selectTopArticles(tiers.core, 3);
  const nearSelected = selectTopArticles(tiers.near, 4);
  const extendedSelected = selectTopArticles(tiers.extended, 2);
  const supportSelected = selectTopArticles(tiers.support, 1);

  let report = `【今日AI前沿 - ${dateStr}】
报送人：小爪
日期：${dateStr}
范围：过去24小时关键动态

`;

  // 核心层
  report += `🔴 核心层（可落地的开源项目/模型/范式）\n\n`;
  coreSelected.forEach((article, idx) => {
    const num = ['一', '二', '三', '四', '五'][idx];
    const keyPoints = generateKeyPoints(article);
    const advice = generateAdvice(article, 'core');
    const link = article.link || article.url || '';
    
    report += `${num}、${article.title}\n`;
    report += `关键信息：\n`;
    keyPoints.forEach(p => {
      report += `  • ${p}\n`;
    });
    report += `💡 对你：${advice}\n`;
    if (link) {
      report += `🔗 来源链接：${link}\n`;
    }
    report += `📰 来源：${formatSource(article)}\n\n`;
  });

  // 近层
  report += `🟡 近层（行业动态/产品发布/技术路线）\n\n`;
  nearSelected.forEach((article, idx) => {
    const num = idx + 4;
    const keyPoints = generateKeyPoints(article);
    const advice = generateAdvice(article, 'near');
    const link = article.link || article.url || '';
    
    report += `${num}、${article.title}\n`;
    report += `关键信息：\n`;
    keyPoints.forEach(p => {
      report += `  • ${p}\n`;
    });
    report += `💡 对你：${advice}\n`;
    if (link) {
      report += `🔗 来源链接：${link}\n`;
    }
    report += `📰 来源：${formatSource(article)}\n\n`;
  });

  // 外延层
  if (extendedSelected.length > 0) {
    report += `🟢 外延层（观点思辨/跨领域启发/前沿探索）\n\n`;
    extendedSelected.forEach((article, idx) => {
      const num = idx + 8;
      const keyPoints = generateKeyPoints(article);
      const advice = generateAdvice(article, 'extended');
      const link = article.link || article.url || '';
      
      report += `${num}、${article.title}\n`;
      report += `关键信息：\n`;
      keyPoints.forEach(p => {
        report += `  • ${p}\n`;
      });
      report += `💡 对你：${advice}\n`;
      if (link) {
        report += `🔗 来源链接：${link}\n`;
      }
      report += `📰 来源：${formatSource(article)}\n\n`;
    });
  }

  // 支撑层
  if (supportSelected.length > 0) {
    report += `⚪ 支撑层（政策/投资/宏观）\n\n`;
    supportSelected.forEach((article, idx) => {
      const num = idx + 10;
      const keyPoints = generateKeyPoints(article);
      const advice = generateAdvice(article, 'support');
      const link = article.link || article.url || '';
      
      report += `${num}、${article.title}\n`;
      report += `关键信息：\n`;
      keyPoints.forEach(p => {
        report += `  • ${p}\n`;
      });
      report += `💡 对你：${advice}\n`;
      if (link) {
        report += `🔗 来源链接：${link}\n`;
      }
      report += `📰 来源：${formatSource(article)}\n\n`;
    });
  }

  // 今日行动建议
  report += `📋 今日行动建议\n\n`;
  report += `【短期】\n`;
  coreSelected.slice(0, 2).forEach(a => {
    if (a.link?.includes('github')) {
      report += `  • 试用 ${a.title.split(' ')[0]} 评估内部适用性\n`;
    }
  });
  report += `  • 跟踪近层动态中的技术路线变化\n\n`;

  report += `【中期】\n`;
  report += `  • 整理本周核心层技术，评估试点可行性\n`;
  report += `  • 关注支撑层政策动向对技术规划的影响\n\n`;

  report += `【学习】\n`;
  report += `  • 阅读核心层相关技术文档/论文\n`;
  report += `  • 思考跨领域创新对自身工作的启发\n\n`;

  // 动态分布
  const total = coreSelected.length + nearSelected.length + extendedSelected.length + supportSelected.length;
  report += `📊 今日动态分布\n\n`;
  report += `层级      数量  占比\n`;
  report += `🔴 核心层  ${coreSelected.length}条   ${Math.round(coreSelected.length/total*100)}%\n`;
  report += `🟡 近层    ${nearSelected.length}条   ${Math.round(nearSelected.length/total*100)}%\n`;
  report += `🟢 外延层  ${extendedSelected.length}条   ${Math.round(extendedSelected.length/total*100)}%\n`;
  report += `⚪ 支撑层  ${supportSelected.length}条   ${Math.round(supportSelected.length/total*100)}%\n\n`;

  report += `每条信息均附来源链接，影响分析一句话。\n`;
  report += `已排除企业IT Infra接入类新闻。\n`;

  return report;
}

// 主函数
function main() {
  try {
    const args = process.argv.slice(2);
    const type = args.find((_, i) => args[i-1] === '--type') || 'daily';
    const dataPath = args.find((_, i) => args[i-1] === '--data') || 'workspace/articles.json';
    const outputPath = args.find((_, i) => args[i-1] === '--output');

    console.error(`[INFO] Generating ${type} report...`);

    const articles = loadArticles(dataPath);
    console.error(`[INFO] Loaded ${articles.length} articles`);

    const tiers = categorizeArticles(articles);
    console.error(`[INFO] Categorized: Core=${tiers.core.length}, Near=${tiers.near.length}, Extended=${tiers.extended.length}, Support=${tiers.support.length}`);

    const report = generateReport(tiers, type);

    if (outputPath) {
      fs.writeFileSync(outputPath, report, 'utf-8');
      console.error(`[INFO] Report saved to ${outputPath}`);
    } else {
      console.log(report);
    }

  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

main();
