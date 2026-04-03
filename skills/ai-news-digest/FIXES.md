# AI 前沿追踪日报 Skill - 飞书文档结构修复版

## 问题诊断

**问题**: 使用 `feishu_doc append` 逐块追加时，文档块顺序出现混乱

**原因分析**:
1. `feishu_doc append` API 是异步处理
2. 连续调用时，网络延迟导致块到达服务器的顺序不一致
3. 飞书服务器按到达时间而非调用时间排序块

**解决方案**:
采用 **"单块大内容"** 策略，而非 "多小块顺序追加"

---

## 修正后的飞书文档创建方案

### 方案: 使用 feishu_doc write 一次性写入（推荐）

虽然之前测试发现 `write` 会重排序，但经过验证，如果使用**正确格式**，可以保持稳定结构。

关键要点:
1. 使用 Markdown 格式，让飞书自动解析结构
2. 确保 Markdown 语法正确（标题层级、列表缩进）
3. 使用 `write` 一次性写入整个文档内容

### 格式规范（关键！）

```markdown
# 【今日AI前沿 - YYYY-MM-DD】

报送人：小爪  
日期：YYYY-MM-DD  
范围：过去24小时关键动态

---

## 🔴 核心层（可落地的开源项目/模型/范式）

### 一、[标题]

关键信息：

- [要点1]
- [要点2]
- [要点3]

来源：[来源1](链接1) | [来源2](链接2)

### 二、[标题]
...

---

## 🟡 近层（行业动态/产品发布/技术路线）
...
```

**重要格式规则**:
1. 标题层级必须连续（H1 → H2 → H3，不能跳）
2. 列表项前必须有空行
3. 分隔线 `---` 单独一行
4. 来源链接使用 Markdown 格式 `[text](url)`

---

## 执行流程（修正版）

### Step 4: 飞书文档创建（修正）

```javascript
// 1. 生成完整的 Markdown 内容（字符串拼接）
const markdownContent = generateFullMarkdown(results);

// 2. 一次性创建并写入
const doc = await feishu_doc.create({ 
  title: `AI前沿追踪日报 - ${today}` 
});

await feishu_doc.write({ 
  doc_token: doc.document_id, 
  content: markdownContent 
});

// 3. 验证文档结构
const verification = await feishu_doc.read({ 
  doc_token: doc.document_id 
});

// 4. 如果结构异常，删除重试
if (!verifyStructure(verification)) {
  await feishu_doc.delete({ doc_token: doc.document_id });
  // 重试或降级
}
```

---

## 备用方案（如果 write 仍有问题）

### 方案 B: 使用延迟追加

如果 `write` 无法满足需求，使用 `append` 但增加延迟:

```javascript
const blocks = [
  { content: "# 【今日AI前沿 - YYYY-MM-DD】", delay: 0 },
  { content: "报送人：小爪...", delay: 500 },
  { content: "---", delay: 500 },
  { content: "## 🔴 核心层...", delay: 500 },
  // ... 每个块延迟 500ms
];

for (const block of blocks) {
  await sleep(block.delay);
  await feishu_doc.append({ 
    doc_token, 
    content: block.content 
  });
}
```

### 方案 C: 发送 Markdown 文件

如果飞书文档创建始终有问题，直接发送 Markdown 文件:

```javascript
// 1. 保存到本地文件
writeFile(`reports/日报_${today}.md`, markdownContent);

// 2. 作为文件发送
message.send({
  channel: 'feishu',
  filePath: `reports/日报_${today}.md`
});
```

---

## 验证清单

每次生成文档后，自动验证:

1. **结构验证**: 检查标题层级是否正确
2. **链接验证**: 抽样检查链接是否可点击
3. **内容完整性**: 确认四层分类都存在

如果验证失败，自动重试或降级到文件发送。

---

## 测试计划

在正式部署前，执行以下测试:

1. **结构测试**: 生成5次测试文档，检查块顺序
2. **链接测试**: 验证所有链接格式正确
3. **降级测试**: 模拟失败场景，验证降级机制
4. **压力测试**: 模拟高峰期，验证稳定性

所有测试通过后，再部署 Cron 任务。
