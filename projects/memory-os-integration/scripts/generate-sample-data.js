const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

// Generate sample data for build time
const sampleMemories = [
  {
    id: 'l4-identity',
    level: 'L4',
    category: 'core-identity',
    title: '核心身份',
    content: '# 核心身份\n\n**重要：本层只能由 Bruce 人工修改，AI 不能自动更新。**\n\n## 核心价值观\n\n待 Bruce 填充...',
    created: '2026-03-05',
    updated: '2026-03-05',
    source: '用户声明',
    confidence: 'high',
    status: 'active',
    path: 'Memory/L4-core/identity.md',
    tags: ['identity', 'core', 'L4'],
  },
  {
    id: 'intent-tools',
    level: 'Intent',
    category: 'preferences',
    title: '工具偏好',
    content: '# 工具偏好\n\n## 偏好工具\n\n- Feishu - 协作沟通\n- GitHub - 代码托管\n- VS Code - 代码编辑',
    created: '2026-03-05',
    updated: '2026-03-05',
    source: '用户声明',
    confidence: 'high',
    status: 'active',
    path: 'Intent/preferences/tools.md',
    tags: ['tools', 'preferences', 'Intent'],
  },
  {
    id: 'intent-communication',
    level: 'Intent',
    category: 'communication',
    title: '沟通风格偏好',
    content: '# 沟通风格偏好\n\n## 偏好\n\n- 简洁直接\n- 技术准确\n- 中文交流',
    created: '2026-03-05',
    updated: '2026-04-03',
    source: '对话观察',
    confidence: 'high',
    status: 'active',
    path: 'Intent/preferences/communication/style.md',
    tags: ['communication', 'preferences'],
  },
  {
    id: 'meta-review-2026-03',
    level: 'Meta',
    category: 'review',
    title: '2026年3月L2复盘',
    content: '# L2 行为层复盘\n\n## 本月发现的模式\n\n1. 工作习惯：偏好早晨处理复杂任务\n2. 学习模式：通过实践学习效果最好',
    created: '2026-03-31',
    updated: '2026-03-31',
    source: 'review',
    confidence: 'medium',
    status: 'active',
    path: 'Meta/reviews/monthly/2026-03-L2-review.md',
    tags: ['review', 'L2', 'monthly'],
  },
];

const sampleStats = {
  total: 4,
  byLevel: { L0: 0, L1: 0, L2: 0, L3: 0, L4: 1, Intent: 2, Meta: 1 },
  byCategory: { 'core-identity': 1, preferences: 2, review: 1, communication: 1 },
  recentUpdates: sampleMemories.sort((a, b) => 
    new Date(b.updated).getTime() - new Date(a.updated).getTime()
  ),
  evolution: [
    { date: '2026-03-05', count: 2 },
    { date: '2026-03-31', count: 1 },
    { date: '2026-04-03', count: 1 },
  ],
};

const byLevelData = {
  L0: [],
  L1: [],
  L2: [],
  L3: [],
  L4: [sampleMemories[0]],
  Intent: [sampleMemories[1], sampleMemories[2]],
  Meta: [sampleMemories[3]],
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Write sample data
fs.writeFileSync(
  path.join(DATA_DIR, 'memories.json'),
  JSON.stringify(sampleMemories, null, 2)
);

fs.writeFileSync(
  path.join(DATA_DIR, 'stats.json'),
  JSON.stringify(sampleStats, null, 2)
);

fs.writeFileSync(
  path.join(DATA_DIR, 'by-level.json'),
  JSON.stringify(byLevelData, null, 2)
);

fs.writeFileSync(
  path.join(DATA_DIR, 'last-sync.json'),
  JSON.stringify({ 
    timestamp: new Date().toISOString(), 
    count: sampleMemories.length 
  }, null, 2)
);

console.log('✅ Sample data generated for build');
console.log(`   - ${sampleMemories.length} memories`);
console.log(`   - Output: ${DATA_DIR}`);
