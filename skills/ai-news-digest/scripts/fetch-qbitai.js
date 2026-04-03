#!/usr/bin/env node
/**
 * 量子位 RSS 抓取脚本
 * 抓取 https://www.qbitai.com/feed 的最新文章
 */

const https = require('https');
const xml2js = require('xml2js');

const RSS_URL = 'https://www.qbitai.com/feed';

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
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function parseRSS(xmlData) {
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlData);
  
  const items = result.rss.channel[0].item || [];
  return items.map(item => ({
    title: item.title?.[0] || '',
    link: item.link?.[0] || '',
    pubDate: item.pubDate?.[0] || '',
    author: item['dc:creator']?.[0] || '',
    description: item.description?.[0] || '',
    categories: item.category?.map(c => c.toString()) || []
  }));
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

    // 过滤时间
    let filtered = articles;
    if (since) {
      const sinceDate = new Date(since);
      filtered = articles.filter(a => new Date(a.pubDate) >= sinceDate);
    }

    // 限制数量
    filtered = filtered.slice(0, limit);

    // 输出 JSON
    console.log(JSON.stringify(filtered, null, 2));
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

main();
