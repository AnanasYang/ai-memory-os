const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const MEMORY_BASE_PATH = path.join(__dirname, '../../ai-memory-system');
const OUTPUT_PATH = path.join(__dirname, '../data');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_PATH)) {
  fs.mkdirSync(OUTPUT_PATH, { recursive: true });
}

// 统一的记忆数据模型
interface MemoryNode {
  id: string;
  level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'Intent' | 'Meta';
  category: string;
  title: string;
  content: string;
  created: string;
  updated: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  reviewed?: string;
  status?: string;
  path: string;
  tags: string[];
}

interface MemoryStats {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  recentUpdates: MemoryNode[];
  evolution: { date: string; count: number }[];
}

// 解析 Markdown 文件
function parseMarkdownFile(filePath: string): MemoryNode | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const relativePath = path.relative(MEMORY_BASE_PATH, filePath);
    
    // 从路径推断层级
    const level = inferLevel(relativePath);
    
    return {
      id: generateId(relativePath),
      level,
      category: parsed.data.category || 'uncategorized',
      title: parsed.data.title || path.basename(filePath, '.md'),
      content: parsed.content,
      created: parsed.data.created || new Date().toISOString().split('T')[0],
      updated: parsed.data.updated || parsed.data.created || new Date().toISOString().split('T')[0],
      source: parsed.data.source || 'unknown',
      confidence: parsed.data.confidence || 'medium',
      reviewed: parsed.data.reviewed,
      status: parsed.data.status,
      path: relativePath,
      tags: extractTags(parsed.content),
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

// 从路径推断记忆层级
function inferLevel(filePath: string): MemoryNode['level'] {
  if (filePath.includes('L0')) return 'L0';
  if (filePath.includes('L1')) return 'L1';
  if (filePath.includes('L2')) return 'L2';
  if (filePath.includes('L3')) return 'L3';
  if (filePath.includes('L4')) return 'L4';
  if (filePath.includes('Intent')) return 'Intent';
  if (filePath.includes('Meta')) return 'Meta';
  return 'Meta';
}

// 生成唯一 ID
function generateId(filePath: string): string {
  return Buffer.from(filePath).toString('base64').replace(/[/+=]/g, '-').substring(0, 32);
}

// 提取标签
function extractTags(content: string): string[] {
  const tagRegex = /#\w+/g;
  return [...content.matchAll(tagRegex)].map(m => m[0].slice(1));
}

// 递归扫描目录
function scanDirectory(dir: string): string[] {
  const files: string[] = [];
  
  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳过 node_modules 和隐藏目录
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(fullPath);
        }
      } else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
        files.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return files;
}

// 生成统计数据
function generateStats(nodes: MemoryNode[]): MemoryStats {
  const byLevel: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  
  for (const node of nodes) {
    byLevel[node.level] = (byLevel[node.level] || 0) + 1;
    byCategory[node.category] = (byCategory[node.category] || 0) + 1;
  }
  
  // 最近更新的节点
  const recentUpdates = [...nodes]
    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
    .slice(0, 10);
  
  // 演变时间线
  const dateMap = new Map<string, number>();
  for (const node of nodes) {
    const date = node.created;
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  }
  
  const evolution = [...dateMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
  
  return {
    total: nodes.length,
    byLevel,
    byCategory,
    recentUpdates,
    evolution,
  };
}

// 主同步函数
async function syncData() {
  console.log('🔄 Syncing AI Memory System data...');
  console.log(`📁 Source: ${MEMORY_BASE_PATH}`);
  
  const mdFiles = scanDirectory(MEMORY_BASE_PATH);
  console.log(`📄 Found ${mdFiles.length} markdown files`);
  
  const nodes: MemoryNode[] = [];
  
  for (const file of mdFiles) {
    const node = parseMarkdownFile(file);
    if (node) {
      nodes.push(node);
    }
  }
  
  console.log(`✅ Parsed ${nodes.length} valid memory nodes`);
  
  // 生成统计数据
  const stats = generateStats(nodes);
  
  // 按层级分组
  const byLevel: Record<string, MemoryNode[]> = {
    L0: [], L1: [], L2: [], L3: [], L4: [],
    Intent: [],
    Meta: [],
  };
  
  for (const node of nodes) {
    if (byLevel[node.level]) {
      byLevel[node.level].push(node);
    }
  }
  
  // 写入数据文件
  fs.writeFileSync(
    path.join(OUTPUT_PATH, 'memories.json'),
    JSON.stringify(nodes, null, 2)
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_PATH, 'stats.json'),
    JSON.stringify(stats, null, 2)
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_PATH, 'by-level.json'),
    JSON.stringify(byLevel, null, 2)
  );
  
  fs.writeFileSync(
    path.join(OUTPUT_PATH, 'last-sync.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), count: nodes.length })
  );
  
  console.log('💾 Data saved to:');
  console.log(`   - memories.json (${nodes.length} nodes)`);
  console.log(`   - stats.json`);
  console.log(`   - by-level.json`);
  console.log(`   - last-sync.json`);
  console.log('✅ Sync complete!');
  
  return { nodes, stats, byLevel };
}

// 如果直接运行脚本
if (require.main === module) {
  syncData().catch(console.error);
}

module.exports = { syncData, parseMarkdownFile, scanDirectory };