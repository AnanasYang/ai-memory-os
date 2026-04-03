# AI News Digest - 文件发送方式说明

## 正确的文件发送方法

### 方式 1: message 工具 filePath 参数（推荐）

使用 OpenClaw 的 `message` 工具，通过 `filePath` 参数发送文件：

```javascript
message({
  action: "send",
  filePath: "/path/to/AI日报_20260311.md",
  message: "📄 AI日报 2026-03-11"  // 可选：附加说明文字
})
```

**参数说明：**
- `action`: "send" - 发送操作
- `filePath`: 本地文件的绝对路径
- `message`: 附加的文本消息（可选）

**返回结果：**
```json
{
  "channel": "feishu",
  "to": "ou_a997dd39e688226bfd2f1ccfc0d1e3f2",
  "mediaUrl": "/path/to/file.md",
  "mediaUrls": ["/path/to/file.md"],
  "result": {
    "channel": "feishu",
    "messageId": "om_xxx",
    "chatId": "ou_xxx"
  }
}
```

### 方式 2: feishu_doc 创建云文档（备选）

如果文件较大或需要在线编辑，可以创建飞书云文档：

```bash
feishu_doc create \
  --title "AI日报 $(date +%Y-%m-%d)" \
  --content workspace/doc_content.md
```

## 完整发送流程

### 日报发送步骤

```bash
# 1. 生成报告
./scripts/run-openclaw.sh daily

# 2. 获取生成的文件路径
REPORT_FILE="workspace/AI日报_$(date +%Y%m%d).md"

# 3. 使用 message 工具发送文件（在 OpenClaw 中执行）
message({
  action: "send",
  filePath: "/home/bruce/.openclaw/workspace/skills/ai-news-digest/${REPORT_FILE}",
  message: "📄 AI日报 $(date +%Y-%m-%d)"
})
```

## 注意事项

1. **文件路径**：必须是绝对路径
2. **文件格式**：支持 .md, .txt, .pdf 等常见格式
3. **文件大小**：建议不超过 10MB
4. **不要使用的工具**：
   - ❌ `kimi_upload_file` - 在飞书渠道不支持
   - ❌ `file` 参数 - 不是正确的参数名

## 故障排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 文件未发送 | 路径错误 | 使用绝对路径 |
| 文件损坏 | 编码问题 | 确保 UTF-8 编码 |
| 发送失败 | 文件过大 | 压缩或分段发送 |

## 相关文档

- 主技能文档: [SKILL.md](../SKILL.md)
- Cron 配置: [openclaw-cron-setup.md](openclaw-cron-setup.md)
