#!/usr/bin/env node
/**
 * AI News Digest - v5.2.0
 * 混合方案：Playwright抓取量子位 + Tavily搜索其他源
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = dirname(__dirname);

const API_KEY = process.env.TAVILY_API_KEY || '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';
const TAVILY_SEARCH = `${SKILL_DIR}/../tavily-search/scripts/search.mjs`;

// ============ 源配置 ============
// Playwright 直接抓取
const PLAYWRIGHT_SOURCES = [
  { name: '量子位', url: 'https://www.qbitai.com/', count: 5, lang: 'zh' },
];

// Tavily 搜索
const TAVILY_SOURCES = [
  { name: '机器之心', query: '人工智能 site:jiqizhixin.com', count: 5 },
  { name: 'InfoQ', query: 'AI site:infoq.cn', count: 3 },
  { name: '36氪', query: 'AI 人工智能 site:36kr.com', count: 3 },
  { name: '国际自动驾驶', query: 'autonomous driving Waymo Tesla news', count: 5 },
  { name: '国际机器人', query: 'robotics AI physical AI', count: 3 },
  { name: 'OpenAI', query: 'OpenAI news', count: 3 },
  { name: 'NVIDIA', query: 'NVIDIA AI news', count: 3 },
];

// ============ Playwright 抓取 ============
async function fetchWithPlaywright(browser, source) {
  const results = [];
  const page = await browser.newPage();
  
  try {
    console.log(`  📰 ${source.name}: Playwright抓取...`);
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(1500);
    
    // 获取文章列表
    const articles = await page.$$eval('a', (links, baseUrl) => 
      links
        .map(l => ({ title: l.textContent.trim(), href: l.href }))
        .filter(a => 
          a.title.length > 10 && a.title.length < 80 && 
          a.href.includes(baseUrl) &&
          a.href.match(/\d{4}\/\d{2}/)
        )
        .slice(0, 20),
      source.url
    );
    
    // 去重
    const unique = [];
    const seen = new Set();
    for (const a of articles) {
      if (!seen.has(a.title)) {
        seen.add(a.title);
        unique.push(a);
      }
    }
    
    console.log(`     找到 ${unique.length} 篇文章`);
    
    for (const article of unique.slice(0, source.count)) {
      try {
        console.log(`     📝 ${article.title.slice(0, 35)}...`);
        await page.goto(article.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1000);
        
        const content = await page.evaluate(() => {
          const paragraphs = Array.from(document.querySelectorAll('article p, .entry-content p, .post-content p'))
            .filter(p => !p.querySelector('img'))
            .map(p => p.textContent.trim())
            .filter(text => text.length > 30 && text.length < 200)
            .slice(0, 2)
            .join('。');
          return paragraphs;
        });
        
        if (content && content.length > 50) {
          results.push({ title: article.title, url: article.href, source: source.name, content, lang: source.lang });
        }
      } catch (e) {
        console.log(`     ⚠️ 跳过`);
      }
    }
  } catch (e) {
    console.error(`  ❌ ${source.name}: ${e.message.slice(0, 50)}`);
  } finally {
    await page.close();
  }
  
  return results;
}

// ============ Tavily 搜索 ============
function searchTavily(config) {
  try {
    const cmd = `export TAVILY_API_KEY=${API_KEY} && node ${TAVILY_SEARCH} "${config.query}" --topic news --days 1 -n ${config.count} 2>/dev/null`;
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
    const results = [];
    const lines = output.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      const match = lines[i].match(/-\s+\*\*(.+?)\*\*\s+\(relevance:\s+(\d+)%\)/);
      if (match && parseInt(match[2]) >= 70) {
        const title = match[1];
        let url = '';
        let content = '';
        
        if (i + 1 < lines.length) url = lines[i + 1].trim().replace(/^\s+/, '');
        
        let j = i + 2;
        const contentLines = [];
        while (j < lines.length) {
          const line = lines[j];
          if (line.match(/^-\s+\*\*/) || line.match(/^##/)) break;
          if (line.match(/^\s+\S/)) contentLines.push(line.trim());
          else if (line.trim() !== '') break;
          j++;
        }
        
        content = contentLines.join(' ').slice(0, 500);
        
        if (content.length > 50) {
          results.push({ title, url, source: config.name, content, lang: 'en' });
        }
        i = j;
      } else {
        i++;
      }
    }
    
    console.log(`  🔍 ${config.name}: ${results.length} 条`);
    return results;
  } catch (e) {
    console.error(`  ❌ ${config.name}: 失败`);
    return [];
  }
}

// ============ 处理 ============
function deduplicate(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.title.toLowerCase().slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function categorize(items) {
  const core = [], near = [], support = [], extension = [];
  
  for (const item of items) {
    const title = item.title.toLowerCase();
    const content = (item.content || '').toLowerCase();
    
    if (title.includes('融资') || title.includes('投资') || title.includes('政策')) {
      support.push(item);
    }
    else if (title.includes('论文') || title.includes('arxiv') || title.includes('研究')) {
      extension.push(item);
    }
    else if (title.includes('ai') || title.includes('模型') || title.includes('开源') || 
             title.includes('机器人') || title.includes('自动驾驶') ||
             content.includes('ai') || content.includes('模型')) {
      core.push(item);
    }
    else {
      near.push(item);
    }
  }
  
  return {
    core: core.slice(0, 5),
    near: near.slice(0, 5),
    support: support.slice(0, 3),
    extension: extension.slice(0, 3)
  };
}

// ============ 生成 Markdown ============
function generateMarkdown(data, date) {
  const lines = [];
  let num = 1;
  
  lines.push(`# 【今日AI前沿 - ${date}】`);
  lines.push('');
  lines.push(`报送人：小爪  `);
  lines.push(`日期：${date}  `);
  lines.push('范围：过去24小时关键动态');
  lines.push('');
  lines.push('---');
  lines.push('');
  
  ['core', 'near', 'extension', 'support'].forEach(layer => {
    const titles = { core: '核心层', near: '近层', extension: '外延层', support: '支撑层' };
    const icons = { core: '🔴', near: '🟡', extension: '🟢', support: '⚪' };
    const desc = { 
      core: '可落地的开源项目/模型/范式', 
      near: '行业前沿+AI核心', 
      extension: '观点思辨/跨领域启发', 
      support: '政策/投资/宏观' 
    };
    
    lines.push(`## ${icons[layer]} ${titles[layer]}（${desc[layer]}）`);
    lines.push('');
    
    if (data[layer].length === 0) {
      lines.push('*本层今日无重大动态*');
    } else {
      for (const item of data[layer]) {
        lines.push(`### ${String(num).padStart(2, '0')}、${item.title}`);
        lines.push('');
        lines.push(`- ${item.content}`);
        lines.push('');
        lines.push(`来源：[${item.source}](${item.url})`);
        lines.push('');
        num++;
      }
    }
    lines.push('---');
    lines.push('');
  });
  
  lines.push('📊 今日动态分布');
  lines.push('');
  lines.push(`- 🔴 核心层：${data.core.length} 条`);
  lines.push(`- 🟡 近层：${data.near.length} 条`);
  lines.push(`- 🟢 外延层：${data.extension.length} 条`);
  lines.push(`- ⚪ 支撑层：${data.support.length} 条`);
  lines.push('');
  
  return lines.join('\n');
}

// ============ 主函数 ============
async function main() {
  const date = new Date().toISOString().split('T')[0];
  console.log(`\n=== AI News Digest - ${date} ===`);
  
  let allNews = [];
  
  // 1. Playwright 抓取
  console.log('\n🌐 启动浏览器...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
  try {
    console.log('\n🇨🇳 Playwright 抓取...');
    for (const source of PLAYWRIGHT_SOURCES) {
      const articles = await fetchWithPlaywright(browser, source);
      allNews.push(...articles);
    }
  } finally {
    console.log('🔒 关闭浏览器...');
    await browser.close();
  }
  
  // 2. Tavily 搜索
  console.log('\n🔍 Tavily 搜索...');
  for (const source of TAVILY_SOURCES) {
    const articles = searchTavily(source);
    allNews.push(...articles);
  }
  
  // 3. 处理
  console.log('\n🔄 合并去重...');
  const unique = deduplicate(allNews);
  console.log(`✓ 共 ${unique.length} 条`);
  
  console.log('\n📂 分类...');
  const categorized = categorize(unique);
  console.log(`- 核心层: ${categorized.core.length}`);
  console.log(`- 近层: ${categorized.near.length}`);
  console.log(`- 外延层: ${categorized.extension.length}`);
  console.log(`- 支撑层: ${categorized.support.length}`);
  
  console.log('\n📝 生成报告...');
  const markdown = generateMarkdown(categorized, date);
  
  const reportsDir = `${SKILL_DIR}/reports`;
  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
  const filePath = `${reportsDir}/日报_${date}.md`;
  writeFileSync(filePath, markdown);
  
  console.log(`\n✅ 报告已保存: ${filePath}`);
  console.log('\n=== OUTPUT ===');
  console.log(JSON.stringify({
    file: filePath,
    title: `AI前沿追踪日报 - ${date}`,
    summary: {
      core: categorized.core.length,
      near: categorized.near.length,
      extension: categorized.extension.length,
      support: categorized.support.length,
      total: unique.length
    }
  }));
}

main().catch(console.error);
