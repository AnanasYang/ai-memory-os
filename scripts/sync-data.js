/**
 * sync-data.js - 从 ai-memory-system 同步记忆数据
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = '/tmp/ai-memory-system';
const TARGET_DIR = './data';

function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // 解析 YAML frontmatter
  const frontmatter = {};
  let inFrontmatter = false;
  let i = 0;
  
  if (lines[0] === '---') {
    inFrontmatter = true;
    i = 1;
    while (i < lines.length && lines[i] !== '---') {
      const [key, ...valueParts] = lines[i].split(':');
      if (key && valueParts.length > 0) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
      i++;
    }
    i++; // 跳过 ---
  }
  
  // 剩余内容为正文
  const body = lines.slice(i).join('\n').trim();
  
  return {
    ...frontmatter,
    content: body,
    filename: path.basename(filePath, '.md')
  };
}

function syncDirectory(sourceDir, targetFile, options = {}) {
  if (!fs.existsSync(sourceDir)) {
    console.log(`Source directory not found: ${sourceDir}`);
    return [];
  }
  
  const files = fs.readdirSync(sourceDir)
    .filter(f => f.endsWith('.md'))
    .sort();
  
  const memories = files.map(file => {
    const filePath = path.join(sourceDir, file);
    return parseMarkdown(filePath);
  });
  
  // 生成统计
  const stats = {
    total: memories.length,
    lastUpdated: new Date().toISOString(),
    categories: {}
  };
  
  memories.forEach(m => {
    const cat = m.category || 'uncategorized';
    stats.categories[cat] = (stats.categories[cat] || 0) + 1;
  });
  
  const output = {
    memories,
    stats
  };
  
  fs.writeFileSync(targetFile, JSON.stringify(output, null, 2));
  console.log(`Synced ${memories.length} memories to ${targetFile}`);
  
  return memories;
}

// 确保目录存在
if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// 同步各层级记忆
console.log('Starting memory sync...\n');

syncDirectory(
  `${SOURCE_DIR}/Memory/L1-episodic`,
  `${TARGET_DIR}/memories-l1.json`
);

syncDirectory(
  `${SOURCE_DIR}/Memory/L2-procedural`,
  `${TARGET_DIR}/memories-l2.json`
);

syncDirectory(
  `${SOURCE_DIR}/Memory/L3-semantic`,
  `${TARGET_DIR}/memories-l3.json`
);

syncDirectory(
  `${SOURCE_DIR}/Memory/L4-core`,
  `${TARGET_DIR}/memories-l4.json`
);

// 同步 Intent
syncDirectory(
  `${SOURCE_DIR}/Intent/goals`,
  `${TARGET_DIR}/intent.json`
);

// 生成总体统计
const stats = {
  l1: JSON.parse(fs.readFileSync(`${TARGET_DIR}/memories-l1.json`, 'utf8')).memories.length,
  l2: JSON.parse(fs.readFileSync(`${TARGET_DIR}/memories-l2.json`, 'utf8')).memories.length,
  l3: JSON.parse(fs.readFileSync(`${TARGET_DIR}/memories-l3.json`, 'utf8')).memories.length,
  l4: JSON.parse(fs.readFileSync(`${TARGET_DIR}/memories-l4.json`, 'utf8')).memories.length,
  lastSync: new Date().toISOString(),
  source: 'ai-memory-system',
  autoSync: true
};

fs.writeFileSync(`${TARGET_DIR}/stats.json`, JSON.stringify(stats, null, 2));
console.log(`\n✅ Sync complete! Total: ${stats.l1 + stats.l2 + stats.l3 + stats.l4} memories`);
