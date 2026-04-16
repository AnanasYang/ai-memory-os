#!/usr/bin/env node
/**
 * 多源中文 AI 新闻抓取脚本
 * 抓取 USER.md 中定义的所有中文数据源
 * 
 * 修复：
 * - 添加 --since 参数支持，正确过滤时间
 * - 改进日期解析，处理多种格式
 * - 严格过滤24小时/7天内文章
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import xml2js from 'xml2js';

// 中文数据源配置
const CHINESE_SOURCES = [
  {
    name: '36氪',
    id: '36kr',
    rss: 'https://36kr.com/feed',
    enabled: true
  },
  {
    name: 'InfoQ中文',
    id: 'infoq',
    rss: 'https://www.infoq.cn/feed',
    enabled: true
  },
  {
    name: '虎嗅',
    id: 'huxiu',
    rss: 'https://www.huxiu.com/rss',
    enabled: false  // 经常被封，暂时禁用
  }
];

// 解析多种日期格式
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // 尝试直接解析
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;
  
  // 处理中文日期格式 (2026-03-19 10:30:00)
  const chineseMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (chineseMatch) {
    date = new Date(chineseMatch[1], chineseMatch[2] - 1, chineseMatch[3]);
    if (!isNaN(date.getTime())) return date;
  }
  
  return null;
}

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
        timeout: 15000
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

// 使用 xml2js 解析 RSS（更可靠）
async function parseRSSWithXml2js(xml, sourceName) {
  const articles = [];
  
  try {
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xml);
    
    const items = result.rss?.channel?.[0]?.item || [];
    
    for (const item of items) {
      const title = item.title?.[0] || '';
      const link = item.link?.[0] || '';
      const pubDateStr = item.pubDate?.[0] || item['dc:date']?.[0] || '';
      const description = item.description?.[0] || '';
      const categories = item.category?.map(c => c.toString()) || [];
      
      if (title && title.length > 3) {
        articles.push({
          title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          link: link.trim(),
          pubDate: pubDateStr.trim(),
          description: description.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim(),
          categories: ['中文来源', sourceName, ...categories],
          source: sourceName,
          parsedDate: parseDate(pubDateStr)
        });
      }
    }
  } catch (e) {
    console.error(`[WARN] xml2js parse failed for ${sourceName}, trying fallback: ${e.message}`);
    // 降级到简单解析
    return parseRSSSimple(xml, sourceName);
  }
  
  return articles;
}

// 简单解析（备用）
function parseRSSSimple(xml, sourceName) {
  const articles = [];
  
  // 提取 item
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/g);
  if (!itemMatches) return articles;
  
  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    const descMatch = itemXml.match(/<description>(.*?)<\/description>/);
    
    if (titleMatch) {
      articles.push({
        title: titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        link: linkMatch?.[1]?.trim() || '',
        pubDate: pubDateMatch?.[1]?.trim() || '',
        description: descMatch?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() || '',
        categories: ['中文来源', sourceName],
        source: sourceName,
        parsedDate: parseDate(pubDateMatch?.[1])
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
    const since = args.find((_, i) => args[i-1] === '--since');
    
    // 解析 since 日期
    let sinceDate = null;
    if (since) {
      sinceDate = parseDate(since);
      if (!sinceDate) {
        console.error(`[WARN] Invalid since date: ${since}, using default`);
        // 默认24小时前
        sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
    } else {
      // 默认24小时前
      sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }
    
    console.error(`[INFO] Since date: ${sinceDate.toISOString()}`);
    console.error('[INFO] Fetching Chinese AI news from multiple sources...');
    
    const allArticles = [];
    
    for (const source of CHINESE_SOURCES) {
      if (!source.enabled) continue;
      
      try {
        console.error(`[INFO] Fetching ${source.name}...`);
        const xml = await fetchRSS(source.rss, source.name);
        let articles = await parseRSSWithXml2js(xml, source.name);
        
        // 对36氪进行AI/科技内容过滤
        if (source.id === '36kr') {
          articles = articles.filter(a => isAITechContent(a));
          console.error(`[INFO] ${source.name}: ${articles.length} articles after AI filter`);
        }
        
        // 过滤时间 - 只保留 sinceDate 之后的文章
        const filtered = articles.filter(a => {
          if (!a.parsedDate) return false;
          const isRecent = a.parsedDate >= sinceDate;
          if (!isRecent) {
            console.error(`[DEBUG] Skipping old article: ${a.title?.substring(0, 30)}... (${a.parsedDate.toISOString()})`);
          }
          return isRecent;
        });
        
        console.error(`[INFO] ${source.name}: ${articles.length} total, ${filtered.length} recent`);
        allArticles.push(...filtered);
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
    
    // 排序（按日期降序）
    unique.sort((a, b) => (b.parsedDate || 0) - (a.parsedDate || 0));
    
    // 限制数量
    const result = unique.slice(0, limit);
    
    console.error(`[INFO] Total unique recent articles: ${result.length}`);
    
    // 清理输出（移除 parsedDate，保留 pubDate）
    const output = result.map(({ parsedDate, ...rest }) => rest);
    console.log(JSON.stringify(output, null, 2));
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

main();
