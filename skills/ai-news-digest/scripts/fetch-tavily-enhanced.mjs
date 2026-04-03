#!/usr/bin/env node
/**
 * 增强版 Tavily AI 新闻抓取
 * 结合 Tavily skill 进行更广泛、更智能的搜索
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAVILY_SKILL_PATH = path.resolve(__dirname, '../../tavily-search/scripts/search.mjs');

// 搜索查询配置 - 覆盖 Bruce 关注的所有领域
const SEARCH_QUERIES = [
  // 核心层 - 可直接落地的技术
  { query: 'end-to-end autonomous driving Tesla FSD Waymo 2025 2026', category: '自动驾驶', tier: 'core' },
  { query: 'BEV perception occupancy network open source github', category: '自动驾驶', tier: 'core' },
  { query: 'data closed loop autonomous driving annotation tool', category: '自动驾驶', tier: 'core' },
  
  // 近层 - 行业前沿
  { query: 'NVIDIA DRIVE Thor autonomous vehicle chip 2025', category: 'AI硬件/基础设施', tier: 'near' },
  { query: 'LiDAR camera fusion autonomous driving new method', category: '自动驾驶', tier: 'near' },
  { query: 'XPeng NIO Huawei ADS autonomous driving comparison', category: '自动驾驶', tier: 'near' },
  { query: 'AI agent autonomous workflow 2025 enterprise', category: 'AI Agents', tier: 'near' },
  { query: 'physical AI world model robotics figure Boston Dynamics', category: '机器人', tier: 'near' },
  { query: 'multimodal vision language model VLM autonomous driving', category: '机器视觉/多模态', tier: 'near' },
  { query: 'simulation autonomous driving CARLA NVIDIA Omniverse', category: '仿真', tier: 'near' },
  
  // 外延层 - 拓展视野
  { query: 'AI data center cloud computing infrastructure 2025', category: '数据中心/云计算', tier: 'extended' },
  { query: 'automotive AI policy regulation China Europe 2025', category: '政策法规', tier: 'extended' },
  { query: 'autonomous driving investment funding startup 2025', category: '投资融资', tier: 'extended' },
];

function searchWithTavily(query, days = 1, limit = 5) {
  try {
    const result = execSync(
      `node "${TAVILY_SKILL_PATH}" "${query}" --topic news --days ${days} -n ${limit}`,
      { encoding: 'utf-8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    
    // 解析 Tavily 的输出格式
    const lines = result.split('\n');
    const articles = [];
    let currentArticle = null;
    
    for (const line of lines) {
      if (line.startsWith('- **') && line.includes('(relevance:')) {
        // 新的文章开始
        const match = line.match(/- \*\*(.+?)\*\*\s*\(relevance:\s*(\d+)%\)/);
        if (match) {
          if (currentArticle) articles.push(currentArticle);
          currentArticle = {
            title: match[1].trim(),
            relevance: parseInt(match[2]),
            link: '',
            description: '',
            pubDate: new Date().toISOString(),
            categories: [],
            source: ''
          };
        }
      } else if (line.startsWith('  https://') && currentArticle) {
        currentArticle.link = line.trim();
        try {
          currentArticle.source = new URL(line.trim()).hostname;
        } catch {}
      } else if (line.startsWith('  # ') && currentArticle) {
        currentArticle.description = line.replace('  # ', '').trim();
      }
    }
    
    if (currentArticle) articles.push(currentArticle);
    return articles;
  } catch (error) {
    console.error(`[WARN] Tavily search failed for "${query}":`, error.message);
    return [];
  }
}

async function fetchAllNews(days = 1) {
  const allResults = [];
  
  for (const { query, category, tier } of SEARCH_QUERIES) {
    console.error(`[INFO] Searching: ${query}`);
    const articles = searchWithTavily(query, days, 5);
    
    for (const article of articles) {
      article.categories = [category, tier, '英文来源'];
      article.tier = tier;
      allResults.push(article);
    }
    
    // 避免请求过快
    await new Promise(r => setTimeout(r, 1000));
  }
  
  return allResults;
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const days = parseInt(args.find((_, i) => args[i-1] === '--days') || '1');
    const limit = parseInt(args.find((_, i) => args[i-1] === '--limit') || '30');

    console.error('[INFO] Fetching AI news via Tavily skill...');
    const articles = await fetchAllNews(days);

    // 去重（基于 URL）
    const seen = new Set();
    const unique = articles.filter(a => {
      if (seen.has(a.link)) return false;
      seen.add(a.link);
      return true;
    });

    // 按相关性排序
    unique.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    // 限制数量
    const filtered = unique.slice(0, limit);

    console.error(`[INFO] Found ${filtered.length} unique articles from Tavily`);
    console.log(JSON.stringify(filtered, null, 2));
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

main();
