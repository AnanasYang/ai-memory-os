#!/usr/bin/env node
/**
 * 飞书文档日报发布工具
 * 将新生成的日报插入到文档开头
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 文档配置
const DAILY_DOC_ID = 'YaUpdVUAloFuRwxJczIcR8KMnvd';
const WEEKLY_DOC_ID = 'SSxQdqy1roAPLLxMh9dcg217nqd';

async function publishToFeishu(type = 'daily') {
  const dateStr = new Date().toISOString().split('T')[0];
  const docId = type === 'weekly' ? WEEKLY_DOC_ID : DAILY_DOC_ID;
  const titlePrefix = type === 'weekly' ? '周报' : '日报';
  
  // 读取生成的简报文件
  const briefFile = join(__dirname, '../workspace', `简报_${titlePrefix}_${dateStr.replace(/-/g, '')}.md`);
  
  try {
    const content = readFileSync(briefFile, 'utf-8');
    
    // 输出插入指令（在文档开头插入）
    console.log(JSON.stringify({
      action: 'insert',
      doc_token: docId,
      content: content,
      position: 'start',  // 插入到文档开头
      metadata: {
        date: dateStr,
        type: type,
        generated_at: new Date().toISOString()
      }
    }, null, 2));
    
    console.error(`[Publish] ✓ ${titlePrefix} 发布指令已生成`);
    console.error(`[Publish] 文档ID: ${docId}`);
    
  } catch (error) {
    console.error(`[Publish] ✗ 读取简报文件失败: ${error.message}`);
    process.exit(1);
  }
}

// 主函数
const type = process.argv[2] || 'daily';
publishToFeishu(type);
