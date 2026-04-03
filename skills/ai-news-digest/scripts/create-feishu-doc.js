#!/usr/bin/env node
/**
 * 飞书文档创建脚本
 * 将报告内容存入飞书云文档，然后分享链接
 */

const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const args = process.argv.slice(2);
    const filePath = args.find((_, i) =>> args[i-1] === '--file');
    
    if (!filePath || !fs.existsSync(filePath)) {
      console.error('[ERROR] File not found:', filePath);
      process.exit(1);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const title = path.basename(filePath, '.md');
    
    // 输出文档内容（供 feishu_doc 工具使用）
    console.log(JSON.stringify({
      title: title,
      content: content,
      folder: 'AI_News_Digest'
    }));
    
    console.error('[INFO] Document prepared for Feishu');
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

main();
