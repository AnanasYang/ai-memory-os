#!/usr/bin/env node
/**
 * 多源中文 AI 新闻抓取脚本
 * 抓取 USER.md 中定义的所有中文数据源
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

// 中文数据源配置
const CHINESE_SOURCES = [
  {
    name: '36氪',
    id: '36kr',
    rss: 'https://36kr.com/feed',
    enabled: true
  },
  {
    name: '虎嗅',
    id: 'huxiu',
    rss: 'https://www.huxiu.com/rss',
    enabled: true
  },
  {
    name: 'InfoQ中文',
    id: 'infoq',
    rss: 'https://www.infoq.cn/feed',
    enabled: true
  }
];

// 抓取 RSS
async function fetchRSS(url, sourceName) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      };

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// 解析 RSS XML（简单版本）
function parseRSS(xml, sourceName) {
  const articles = [];
  
  // 提取 title
  const titleMatches = xml.match(/<title>(.*?)<\/title>/g);
  const linkMatches = xml.match(/<link>(.*?)<\/link>/g);
  const pubDateMatches = xml.match(/<pubDate>(.*?)<\/pubDate>/g);
  const descMatches = xml.match(/<description>(.*?)<\/description>/g);
  
  if (!titleMatches) return articles;
  
  // 跳过第一个（通常是网站标题）
  for (let i = 1; i < titleMatches.length; i++) {
    const title = titleMatches[i]?.replace(/<\/?title>/g, '') || '';
    const link = linkMatches?.[i]?.replace(/<\/?link>/g, '') || '';
    const pubDate = pubDateMatches?.[i - 1]?.replace(/<\/?pubDate>/g, '') || '';
    const description = descMatches?.[i - 1]?.replace(/<\/?description>/g, '') || '';
    
    if (title && title.length > 5) {
      articles.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        link: link.trim(),
        pubDate: pubDate.trim(),
        description: description.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim(),
        categories: ['中文来源', sourceName],
        source: sourceName
      });
    }
  }
  
  return articles;
}

// 主函数
async function main() {
  try {
    const args = process.argv.slice(2);
    const limit = parseInt(args.find((_, i) => args[i-1] === '--limit') || '30');
    
    console.error('[INFO] Fetching Chinese AI news from multiple sources...');
    
    const allArticles = [];
    
    for (const source of CHINESE_SOURCES) {
      if (!source.enabled) continue;
      
      try {
        console.error(`[INFO] Fetching ${source.name}...`);
        const xml = await fetchRSS(source.rss, source.name);
        const articles = parseRSS(xml, source.name);
        
        console.error(`[INFO] ${source.name}: ${articles.length} articles`);
        allArticles.push(...articles);
      } catch (error) {
        console.error(`[WARN] Failed to fetch ${source.name}: ${error.message}`);
      }
    }
    
    // 去重
    const seen = new Set();
    const unique = allArticles.filter(a => {
      if (seen.has(a.link)) return false;
      seen.add(a.link);
      return true;
    });
    
    // 排序（按日期）
    unique.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
    
    // 限制数量
    const result = unique.slice(0, limit);
    
    console.error(`[INFO] Total unique articles: ${result.length}`);
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

main();
