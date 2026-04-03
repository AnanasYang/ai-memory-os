# MEMORY.md - 长期记忆

## 技能平台

### EvoMap
**类型**: AI Agent 协作进化市场  
**URL**: https://evomap.ai  
**协议**: GEP-A2A v1.0.0

**我的节点**: `node_8f4e2d6a9b0c1e3f`

**核心用途**:
- 发布 Gene + Capsule + EvolutionEvent 资产包
- 获取其他 Agent 的解决方案
- 认领任务赚取积分
- 避免重复发明轮子

**关键端点**:
- `POST /a2a/hello` - 注册/刷新
- `POST /a2a/publish` - 发布资产
- `POST /a2a/fetch` - 获取资产
- `POST /task/claim` - 认领任务

**使用要点**:
- 请求必须包含完整协议信封（7个字段）
- 需要 `Authorization: Bearer <node_secret>`
- Bundle 必须同时包含 Gene + Capsule
- 推荐包含 EvolutionEvent（提升 GDI 分数）
- 无需持续心跳，按需使用即可

**详细配置**: 见 `memory/2026-03-05-evomap.md`

**已继承的 Capsules**:

1. **Feishu Message Delivery Fallback Chain**
   - Capsule ID: `sha256:8ee18eac8610ef9ecb60d1392bc0b8eb2dd7057f119cb3ea8a2336bbc78f22b3`
   - 功能: 飞书消息发送三级降级（富文本→交互卡片→纯文本）
   - 解决问题: 避免因 markdown 格式不支持导致的消息发送失败
   - 网络重用: 100万+ 次，成功率 95%
   - 本地实现: `feishu_fallback_capsule.py`
   - 详细记录: `memory/2026-03-05-capsule-inheritance.md`

2. **Feishu URL Type Detector & Tool Selector**
   - Gene ID: `sha256:8a893c405830091953ef1c43a59af15d007dbc844b3b8d2fde81e9515ce6ced4`
   - 关联 Capsule ID: `sha256:d3e1609fefa1effdd48788c424894ff2c1a0aed78e29c02ed60fa9b6a3fc19be`
   - 功能: 自动检测飞书 URL 类型（Doc/Sheet/Base）并选择正确工具
   - 解决问题: 防止因选错工具导致的 400 Bad Request 错误
   - 网络重用: 20,041 次，成功率 95%
   - 本地实现: `feishu_url_detector.py`

## AI 简报 Cron 任务（飞书文档版）

**配置日期**: 2026-03-19
**更新日期**: 2026-03-19（新增倒序插入、聚焦领域）

### 飞书文档

| 类型 | 文档链接 | 文档 ID |
|------|---------|---------|
| 日报 | https://feishu.cn/docx/YaUpdVUAloFuRwxJczIcR8KMnvd | `YaUpdVUAloFuRwxJczIcR8KMnvd` |
| 周报 | https://feishu.cn/docx/SSxQdqy1roAPLLxMh9dcg217nqd | `SSxQdqy1roAPLLxMh9dcg217nqd` |

### Cron 任务

| 任务名称 | 执行时间 | 文档目标 |
|---------|---------|---------|
| AI前沿追踪日报-飞书文档 | 每天 10:00 | 日报文档 |
| Bruce每周AI前沿总结-飞书文档 | 每周日 10:00 | 周报文档 |

### 任务 ID

- 日报: `3de69837-118a-4719-a6f4-c6c3842fd873`
- 周报: `61749f3c-d194-401d-bc1a-251d23651ff3`

### 内容策略（2026-03-19 更新）

**聚焦领域**：
- 自动驾驶/智能驾驶（端到端、BEV、Occupancy、数据闭环）
- AI/大模型（Agent、小模型、端侧部署）
- 汽车芯片/基础软件（国产化、OS、中间件）
- 机器人（人形机器人、车路协同）
- 政策法规/投资动态（与 automotive AI 相关）

**内容格式**：
- 🔴 核心层：可落地的开源项目/模型/工具
- 🟡 近层：行业动态/技术路线/产品发布
- 🌐 国际：英文精选动态
- ⚪ 支撑层：政策/投资/宏观
- 📋 行动建议：短期/中期/学习三个维度

### 发布方式

**日报插入位置**：文档开头（倒序，最新在前）  
** cron 任务逻辑**：
1. 执行 `run-digest.sh` 生成简报
2. 使用 `feishu_doc(action='write')` 重新生成完整文档（包含历史+新内容）
   - 或先读取旧内容，新内容+旧内容合并后写入
3. 发送完成通知


## AI News Digest Pro 时效性修复 (2026-03-19)

**问题**: 抓取的文章包含大量旧文章，实效性不对  
**根源**: `fetch-chinese.js` 未接受 `--since` 参数进行日期过滤

**修复**:
1. `run-digest.sh`: 为 Step 2 添加 `--since "${SINCE_DATE}"` 参数
2. `fetch-chinese.js`: 完整重构  
   - 添加 `--since` 参数解析  
   - 使用 `xml2js` 标准解析 RSS  
   - 支持多种日期格式（RFC 2822、ISO 8601、中文格式）  
   - 严格过滤 sinceDate 之后的文章  
3. `fetch-qbitai.js`: 同样改进  
   - 正确处理 RSS 日期  
   - 设置为当天00:00:00作为过滤起点  
4. `run-digest.sh`: 使用 `TZ=Asia/Shanghai` 确保时区一致

**依赖**: 已添加 `package.json` 和 `npm install xml2js`

**验证**: 下次日报运行时检查是否只包含24小时内文章

---

## Capsule 自动集成配置 ✅

**集成层文件**: `feishu_capsule_integration.py`

**便捷函数**:
- `auto_detect_tool(url)` - 自动检测 URL 类型返回工具名
- `sanitize_for_feishu(content)` - 自动清理文档内容
- `send_with_fallback(chat_id, content)` - 自动降级发送消息

**配置指南**: `FEISHU_CAPSULE_INTEGRATION.md`

**集成测试结果**: 4/4 ✅ 全部通过

---

## 待办事项 / 跟踪任务

### 🔨 Agent Memory OS 开发项目
**启动时间**: 2026-03-31  
**状态**: 开发中（子代理运行中）  
**位置**: `/home/bruce/.openclaw/workspace/agent-memory-os/`

**任务内容**:
- 开发完整的 Agent Memory OS Web 应用
- 包含：Memory Galaxy（记忆星系）、Intent Orbit（意图轨道）、Evolution Timeline（演变时间轴）、Insights Radar（洞察雷达）
- 技术栈：Next.js 14 + TypeScript + Tailwind + D3.js

**待完成**:
- [ ] npm install 依赖安装完成
- [ ] 服务启动并暴露地址（需配置 0.0.0.0 而非 localhost）
- [ ] 子网内其他节点可访问

**Heartbeat 检查**: 下次 heartbeat 时汇报完成状态

**服务暴露配置**:
```javascript
// next.config.js 需要修改
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // 开发服务器暴露给子网
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },
}
```

运行命令:
```bash
cd /home/bruce/.openclaw/workspace/agent-memory-os
npm run dev -- --hostname 0.0.0.0 --port 3000
```

---

*（待续）*