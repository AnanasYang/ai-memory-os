#!/usr/bin/env node
/**
 * 量子位 RSS 抓取脚本
 * 抓取 https://www.qbitai.com/feed 的最新文章
 * 
 * 修复：
 * - 改进日期解析，处理 RSS 标准格式 (RFC 2822)
 * - 正确处理时区
 * - 添加调试日志
 * - 转换为 ES Module 语法
 */

import https from 'https';
import { parseStringPromise } from 'xml2js';

const RSS_URL = 'https://www.qbitai.com/feed';

// 解析 RSS 日期（RFC 2822 格式）
function parseRSSDate(dateStr) {
  if (!dateStr) return null;
  
  // RSS 标准格式: Wed, 19 Mar 2026 10:30:00 +0800
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.error(`[WARN] Failed to parse date: ${dateStr}`);
    return null;
  }
  return date;
}

function fetchRSS() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.qbitai.com',
      path: '/feed',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function parseRSS(xmlData) {
  const result = await parseStringPromise(xmlData);
  
  const items = result.rss.channel[0].item || [];
  return items.map(item => {
    const pubDateStr = item.pubDate?.[0] || '';
    return {
      title: item.title?.[0] || '',
      link: item.link?.[0] || '',
      pubDate: pubDateStr,
      parsedDate: parseRSSDate(pubDateStr),
      author: item['dc:creator']?.[0] || '',
      description: item.description?.[0] || '',
      categories: ['量子位', ...(item.category?.map(c => c.toString()) || [])]
    };
  });
}

async function main() {
  try {
    // 检查参数
    const args = process.argv.slice(2);
    const limit = parseInt(args.find((_, i) => args[i-1] === '--limit') || '10');
    const since = args.find((_, i) => args[i-1] === '--since'); // 格式: 2026-03-10

    console.error('[INFO] Fetching QbitAI RSS...');
    const xmlData = await fetchRSS();
    const articles = await parseRSS(xmlData);
    
    console.error(`[INFO] Total articles in RSS: ${articles.length}`);

    // 过滤时间
    let filtered = articles;
    let sinceDate = null;
    
    if (since) {
      sinceDate = new Date(since);
      // 设置为当天的开始时间 (00:00:00)
      sinceDate.setHours(0, 0, 0, 0);
      console.error(`[INFO] Filtering articles since: ${sinceDate.toISOString()}`);
      
      filtered = articles.filter(a => {
        if (!a.parsedDate) return false;
        const isRecent = a.parsedDate >= sinceDate;
        if (!isRecent) {
          console.error(`[DEBUG] Skipping old: ${a.title?.substring(0, 40)}... (${a.parsedDate.toISOString()})`);
        }
        return isRecent;
      });
    }

    console.error(`[INFO] Articles after date filter: ${filtered.length}`);

    // 限制数量
    filtered = filtered.slice(0, limit);

    // 清理输出（移除 parsedDate）
    const output = filtered.map(({ parsedDate, ...rest }) => rest);
    
    // 输出 JSON
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

main();
