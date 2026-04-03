#!/usr/bin/env node
/**
 * Tavily 中文 AI 新闻搜索
 * 搜索 USER.md 中定义的中文数据源
 */

import https from 'https';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = 'api.tavily.com';

// 中文搜索查询 - 覆盖所有中文源
const CHINESE_SEARCH_QUERIES = [
  // InfoQ 中文 - 获取完整内容
  { query: 'site:infoq.cn AI 人工智能 大模型', source: 'InfoQ中文', category: 'AI/科技' },
  { query: 'site:infoq.cn 自动驾驶 智能驾驶', source: 'InfoQ中文', category: '自动驾驶' },
  { query: 'site:infoq.cn 软件工程 技术架构', source: 'InfoQ中文', category: '技术架构' },
  
  // 机器之心
  { query: 'site:jiqizhixin.com artificial intelligence OpenAI Google', source: '机器之心', category: 'AI/科技' },
  { query: 'site:jiqizhixin.com autonomous driving Tesla Waymo', source: '机器之心', category: '自动驾驶' },
  { query: 'site:jiqizhixin.com robotics humanoid robot', source: '机器之心', category: '机器人' },
  
  // 高工智能汽车
  { query: 'site:gg-auto.com 自动驾驶 智能驾驶 ADAS', source: '高工智能汽车', category: '自动驾驶' },
  { query: 'site:gg-auto.com 激光雷达 毫米波雷达', source: '高工智能汽车', category: 'AI硬件' },
  
  // 盖世汽车
  { query: 'site:gasgoo.com 自动驾驶 智能座舱', source: '盖世汽车', category: '自动驾驶' },
  { query: 'site:gasgoo.com NVIDIA 地平线 芯片', source: '盖世汽车', category: 'AI硬件' },
  
  // 42号车库
  { query: 'site:42how.com 特斯拉 小鹏 蔚来 自动驾驶', source: '42号车库', category: '自动驾驶' },
  { query: 'site:42how.com 华为 ADS 智能驾驶', source: '42号车库', category: '自动驾驶' },
  
  // AI科技评论
  { query: 'site:aitechtalk.com AI人工智能', source: 'AI科技评论', category: 'AI/科技' },
  
  // 甲子光年
  { query: 'site:jazzyear.com AI投资 融资', source: '甲子光年', category: '投资融资' }
];

function tavilySearch(query, days = 1) {
  return new Promise((resolve, reject) => {
    if (!TAVILY_API_KEY) {
      reject(new Error('TAVILY_API_KEY not set'));
      return;
    }

    const postData = JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: 'basic',
      topic: 'news',
      days: days,
      max_results: 5,
      include_answer: false
    });

    const options = {
      hostname: TAVILY_API_URL,
      path: '/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) reject(new Error(result.error));
          else resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const days = parseInt(args.find((_, i) => args[i-1] === '--days') || '1');
    const limit = parseInt(args.find((_, i) => args[i-1] === '--limit') || '30');

    console.error('[INFO] Searching Chinese AI news via Tavily...');
    
    const allResults = [];
    
    for (const { query, source, category } of CHINESE_SEARCH_QUERIES) {
      try {
        console.error(`[INFO] Searching: ${source}...`);
        const result = await tavilySearch(query, days);
        
        if (result.results) {
          for (const item of result.results) {
            // 只保留中文标题或来源匹配的结果
            const title = item.title || '';
            const isChinese = /[\u4e00-\u9fa5]/.test(title);
            const isTargetSource = item.url?.includes(source.replace(/[^\w]/g, '').toLowerCase());
            
            if (isChinese || isTargetSource) {
              allResults.push({
                title: title,
                link: item.url || '',
                pubDate: item.published_date || new Date().toISOString(),
                author: item.author || '',
                description: item.content || '',
                categories: [category, '中文来源', source],
                source: source,
                score: item.score || 0
              });
            }
          }
        }
        
        await new Promise(r => setTimeout(r, 800));
      } catch (error) {
        console.error(`[WARN] Failed: ${error.message}`);
      }
    }
    
    // 去重
    const seen = new Set();
    const unique = allResults.filter(a => {
      if (seen.has(a.link)) return false;
      seen.add(a.link);
      return true;
    });
    
    // 排序
    unique.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    const result = unique.slice(0, limit);
    
    console.error(`[INFO] Found ${result.length} Chinese articles`);
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

main();
