#!/usr/bin/env node
/**
 * 飞书消息发送脚本（OpenClaw 兼容版）
 * 支持直接调用和 OpenClaw message 工具调用
 */

const https = require('https');
const fs = require('fs');

const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;

// 格式化内容为飞书富文本
function formatForFeishu(content) {
  // 截断过长的内容（飞书限制约 4000 字符）
  const maxLength = 3800;
  let text = content;
  
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '\n\n...(内容已截断，详见完整报告)';
  }
  
  return text;
}

// 主函数 - 支持多种调用方式
async function main() {
  try {
    const args = process.argv.slice(2);
    const chatId = args.find((_, i) => args[i-1] === '--chat-id') || FEISHU_CHAT_ID;
    const filePath = args.find((_, i) => args[i-1] === '--file');
    const contentArg = args.find((_, i) => args[i-1] === '--content');

    // 读取内容
    let messageContent;
    if (filePath) {
      messageContent = fs.readFileSync(filePath, 'utf-8');
    } else if (contentArg) {
      messageContent = contentArg;
    } else {
      // 从 stdin 读取
      messageContent = '';
      process.stdin.setEncoding('utf-8');
      for await (const chunk of process.stdin) {
        messageContent += chunk;
      }
    }

    if (!messageContent) {
      throw new Error('No content to send');
    }

    // 格式化内容
    const formattedContent = formatForFeishu(messageContent);
    
    // 在 OpenClaw 环境中，输出到 stdout，由 OpenClaw 路由到 message 工具
    // 在非 OpenClaw 环境中，直接使用 HTTP API
    if (process.env.OPENCLAW_SESSION) {
      // OpenClaw 环境 - 输出结构化数据供 message 工具使用
      console.log(JSON.stringify({
        action: 'send',
        message: formattedContent,
        channel: 'feishu',
        target: chatId || 'current'
      }));
    } else {
      // 直接输出格式化内容（供管道使用）
      console.log(formattedContent);
    }

    console.error('[INFO] Message prepared for Feishu');
    
  } catch (error) {
    console.error('[ERROR]', error.message);
    process.exit(1);
  }
}

// 如果直接运行
if (require.main === module) {
  main();
}

module.exports = { formatForFeishu };
