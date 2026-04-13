# Agent Memory OS 数据同步问题诊断报告

## 📋 执行摘要

| 检查项目 | 状态 | 说明 |
|---------|------|------|
| Daily Dream 生成 | ✅ 正常 | 4月6日-8日均有生成 |
| L1 记忆写入 | ✅ 正常 | 已写入 ai-memory-system/Memory/L1-episodic/ |
| L0-state 更新 | ❌ 异常 | 仅到 4月2日，之后未更新 |
| 系统间数据同步 | ⚠️ 部分正常 | agent-memory-os 与 ai-memory-system 存在双轨制 |
| Cron 任务执行 | ✅ 正常 | OpenClaw cron 任务按时执行 |

---

## 🔍 问题分析

### 问题 1: L0-state 数据停滞在 4月2日

**现象确认：**
```
/home/bruce/.openclaw/workspace/ai-memory-system/Memory/L0-state/
├── daily-2026-04-02.jsonl  (1.1MB, 最后更新 4月2日 16:22)
└── README.md
```

**根本原因：**
1. **capture-l0-realtime.js 未被调用** - 该脚本设计用于实时捕获会话数据到 L0-state，但没有被集成到任何自动化流程中
2. **daily-dream-integrated.mjs 绕过 L0** - 当前的 Daily Dream 直接从 OpenClaw sessions 目录读取数据，不经过 L0-state 中转

**数据流对比：**

```
【设计架构】                    【实际运行】
Sessions → L0-state → L1      Sessions ───────→ L1
              ↓                    ↓
          (溯源系统)           (直接读取，
                              跳过 L0)
```

### 问题 2: Dreams 内容为空或过时（agent-memory-os 侧）

**现象确认：**
```
/home/bruce/.openclaw/workspace/agent-memory-os/memory/dreams/daily/
├── 2026-04-02-dream.json   (有内容)
├── 2026-04-02-dream.md
├── 2026-04-05-dream.json   (有内容)
└── 2026-04-05-dream.md
```

**注意：** 4月6日-8日的 Dreams 存在于 `ai-memory-system/Memory/L1-episodic/` 但**不存在于** `agent-memory-os/memory/dreams/daily/`

**根本原因：**
1. **双轨制运行** - 存在两套 Daily Dream 系统：
   - `agent-memory-os/scripts/daily-dream.mjs` - 旧版，写到 agent-memory-os/memory/dreams/
   - `ai-memory-system/scripts/daily-dream-integrated.mjs` - 新版，写到 ai-memory-system/Memory/L1-episodic/

2. **Cron 任务指向新版** - OpenClaw cron 配置执行的是 ai-memory-system 版本：
   ```json
   {
     "name": "daily-memory-dream",
     "payload": {
       "text": "执行命令：cd ~/.openclaw/workspace/ai-memory-system && node scripts/daily-dream-integrated.mjs"
     }
   }
   ```

3. **sync-memory-data.js 未正确同步 Dreams** - 该脚本只同步 L1-L4 记忆，不处理 dreams 目录

### 问题 3: 数据流架构问题

**当前混乱的架构：**

```
┌─────────────────────────────────────────────────────────────┐
│  OpenClaw Sessions (会话记录)                                │
│  ~/.openclaw/agents/main/sessions/*.jsonl                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ↓               ↓               ↓
   ┌─────────┐    ┌──────────┐    ┌──────────────────────┐
   │ L0-state│    │ Daily    │    │ Daily Dream          │
   │ (4/2停止)│    │ Dream    │    │ Integrated (正在运行) │
   └─────────┘    │ (旧版)   │    │ (新版)               │
                  └────┬─────┘    └──────────┬───────────┘
                       │                     │
                       ↓                     ↓
            ┌──────────────────┐   ┌────────────────────┐
            │ agent-memory-os/ │   │ ai-memory-system/  │
            │ memory/dreams/   │   │ Memory/L1-episodic/│
            │ (4/5后停止)      │   │ (正常运行)         │
            └──────────────────┘   └────────────────────┘
```

**问题：**
1. 两个 Dreams 系统并存，但只有一个在运行
2. L0-state 成为孤儿数据层（没人写入，没人读取）
3. agent-memory-os 的 dreams 数据不再更新

---

## 📊 数据现状统计

| 数据源 | 位置 | 最新日期 | 状态 |
|-------|------|---------|------|
| L0-state | ai-memory-system/Memory/L0-state/ | 2026-04-02 | ❌ 停止更新 |
| L1-episodic | ai-memory-system/Memory/L1-episodic/ | 2026-04-08 | ✅ 正常 |
| Dreams (旧) | agent-memory-os/memory/dreams/daily/ | 2026-04-05 | ⚠️ 部分更新 |
| Dreams (新) | ai-memory-system/Memory/L1-episodic/*-daily-dream.md | 2026-04-08 | ✅ 正常 |

---

## 🔧 修复建议

### 方案 A: 统一使用 ai-memory-system 作为唯一数据源（推荐）

**优势：**
- ai-memory-system 是 GitHub 备份的正式记忆仓库
- Daily Dream 已经正常运行在这里
- 符合 5 层记忆系统的设计规范

**操作步骤：**

1. **更新 agent-memory-os 的数据读取路径**
   ```javascript
   // 修改 agent-memory-os/lib/data.ts 生成逻辑
   // 从读取 memory/dreams/ 改为读取 ai-memory-system/Memory/L1-episodic/
   ```

2. **移除 agent-memory-os 中冗余的 daily-dream.mjs**
   ```bash
   mv /home/bruce/.openclaw/workspace/agent-memory-os/scripts/daily-dream.mjs \
      /home/bruce/.openclaw/workspace/agent-memory-os/scripts/daily-dream.mjs.deprecated
   ```

3. **更新 sync-memory-data.js 以包含 L1 daily-dream 文件**
   ```javascript
   // 修改扫描逻辑，将 L1-episodic/*-daily-dream.md 识别为 dreams 数据
   ```

### 方案 B: 恢复 L0-state 并统一数据流

**优势：**
- 符合原始设计的 5 层架构
- L0 作为原始数据层有独立价值（可用于调试和溯源）

**操作步骤：**

1. **修改 daily-dream-integrated.mjs，使其读取 L0-state 而非直接读取 sessions**
   ```javascript
   // 修改 collectTodayConversations() 函数
   // 从读取 sessions 改为读取 L0-state/daily-YYYY-MM-DD.jsonl
   ```

2. **添加 L0 数据捕获到 cron 任务**
   ```json
   {
     "name": "capture-l0-data",
     "schedule": "*/10 * * * *",
     "command": "node /home/bruce/.openclaw/workspace/ai-memory-system/scripts/capture-l0-realtime.js"
   }
   ```

3. **手动补齐 4月3日-8日的 L0 数据**
   ```bash
   cd /home/bruce/.openclaw/workspace/ai-memory-system/scripts
   for date in 2026-04-03 2026-04-04 2026-04-05 2026-04-06 2026-04-07 2026-04-08; do
     # 追溯捕获历史数据
     node -e "
       const {captureToday} = require('./capture-l0-realtime.js');
       // 修改日期逻辑进行追溯
     "
   done
   ```

### 方案 C: 简化架构，移除 L0-state 层

**优势：**
- 减少数据冗余
- 简化系统复杂度

**操作步骤：**

1. **删除 L0-state 目录**（数据已过时）
   ```bash
   mv /home/bruce/.openclaw/workspace/ai-memory-system/Memory/L0-state \
      /home/bruce/.openclaw/workspace/ai-memory-system/Memory/L0-state.archive
   ```

2. **修改 daily-dream-integrated.mjs 的溯源信息**
   - 将 `sources.level: L0` 改为 `sources.level: sessions`
   - 直接引用 OpenClaw sessions 作为 L0 等效物

3. **更新文档**，明确说明 L0 = OpenClaw Sessions 原始记录

---

## ⚡ 立即执行的修复操作

### 1. 检查并确认当前数据完整性
```bash
# 验证 L1 数据完整性
ls -la /home/bruce/.openclaw/workspace/ai-memory-system/Memory/L1-episodic/*.md | tail -10

# 检查 Dreams 生成状态
cat /tmp/daily-dream.log | grep "Daily Dream 完成" | tail -5
```

### 2. 手动触发一次数据同步（如需立即更新 agent-memory-os）
```bash
cd /home/bruce/.openclaw/workspace/agent-memory-os
node scripts/sync-memory-data.js
```

### 3. 修复 agent-memory-os 的 dreams 数据（如采用方案 A）
```bash
# 创建符号链接或复制最新 dreams
ln -sf /home/bruce/.openclaw/workspace/ai-memory-system/Memory/L1-episodic/*-daily-dream.md \
       /home/bruce/.openclaw/workspace/agent-memory-os/memory/dreams/daily/
```

---

## 📈 后续监控建议

1. **添加健康检查脚本**
   ```bash
   # 检查 L1 是否每日更新
   find /home/bruce/.openclaw/workspace/ai-memory-system/Memory/L1-episodic/ \
        -name "*-daily-dream.md" -mtime -1 | wc -l
   ```

2. **监控 cron 任务执行状态**
   - 已在 OpenClaw cron 系统中启用 daily-memory-dream
   - 上次成功执行：2026-04-08 23:00
   - 下次执行：2026-04-09 23:00

3. **每周检查数据一致性**
   - L0-state 是否有更新（如选择保留）
   - L1-episodic 是否连续
   - agent-memory-os 是否与 ai-memory-system 同步

---

## 📝 结论

**核心问题：** 系统存在双轨制运行，导致数据流向不一致

**影响范围：**
- ✅ L1 记忆生成正常（ai-memory-system 侧）
- ❌ L0-state 废弃（停止于4月2日）
- ⚠️ agent-memory-os dreams 部分过时（停止于4月5日）

**建议采取方案 A**，统一使用 ai-memory-system 作为唯一数据源，简化架构并确保数据一致性。

---

*诊断时间：2026-04-09 11:00*  
*诊断工具：Subagent 系统分析*  
*数据来源：文件系统扫描 + Cron 配置分析 + 日志检查*
