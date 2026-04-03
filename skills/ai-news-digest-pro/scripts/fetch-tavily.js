#!/usr/bin/env node
/**
 * Tavily AI 新闻抓取脚本
 * 使用 Tavily API 获取英文 AI 新闻
 * 
 * 修复: 转换为 ES Module 语法
 */

import https from 'https';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = 'api.tavily.com';

// 搜索查询列表 - 覆盖不同 AI 领域
const SEARCH_QUERIES = [
  { query: 'artificial intelligence OpenAI Google latest news', category: '大模型/AI技术' },
  { query: 'autonomous driving Tesla Waymo end-to-end', category: '自动驾驶' },
  { query: 'robotics humanoid robot Figure Boston Dynamics', category: '机器人' },
  { query: 'AI agents autonomous agents OpenAI Claude', category: 'AI Agents' },
  { query: 'NVIDIA AI chip hardware data center', category: 'AI硬件/基础设施' }
];

function tavilySearch(query, days = 1) {
  return new Promise((resolve, reject) => {
    if (!TAVILY_API_KEY) {
      reject(new Error('TAVILY_API_KEY environment variable not set'));
      return;
    }

    const postData = JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: 'basic',
      topic: 'news',
      days: days,
      max_results: 5,
      include_answer: false,
      include_raw_content: false
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
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error('Invalid JSON response: ' + e.message));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(postData);
    req.end();
  });
}

async function fetchAllNews(days = 1) {
  const allResults = [];
  
  for (const { query, category } of SEARCH_QUERIES) {
    try {
      console.error(`[INFO] Searching: ${query}`);
      const result = await tavilySearch(query, days);
      
      if (result.results && result.results.length > 0) {
        for (const item of result.results) {
          try {
            const url = new URL(item.url || '');
            allResults.push({
              title: item.title || '',
              link: item.url || '',
              pubDate: item.published_date || new Date().toISOString(),
              author: item.author || '',
              description: item.content || '',
              categories: [category, '英文来源'],
              source: item.source || url.hostname || 'unknown',
              score: item.score || 0
            });
          } catch (e) {
            // URL 解析失败，使用备用方案
            allResults.push({
              title: item.title || '',
              link: item.url || '',
              pubDate: item.published_date || new Date().toISOString(),
              author: item.author || '',
              description: item.content || '',
              categories: [category, '英文来源'],
              source: item.source || 'unknown',
              score: item.score || 0
            });
          }
        }
      }
      
      // 避免请求过快
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`[WARN] Failed to search "${query}": ${error.message}`);
    }
  }
  
  return allResults;
}

async function main() {
  try {
    // 检查参数
    const args = process.argv.slice(2);
    const days = parseInt(args.find((_, i) => args[i-1] === '--days') || '1');
    const limit = parseInt(args.find((_, i) => args[i-1] === '--limit') || '20');

    console.error('[INFO] Fetching AI news from Tavily...');
    const articles = await fetchAllNews(days);

    // 去重（基于 URL）
    const seen = new Set();
    const unique = articles.filter(a => {
      if (seen.has(a.link)) return false;
      seen.add(a.link);
      return true;
    });

    // 按相关性分数排序
    unique.sort((a, b) => (b.score || 0) - (a.score || 0));

    // 限制数量
    const filtered = unique.slice(0, limit);

    console.error(`[INFO] Found ${filtered.length} unique articles`);
    console.log(JSON.stringify(filtered, null, 2));
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

main();
