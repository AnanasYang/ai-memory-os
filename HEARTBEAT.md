# HEARTBEAT.md - AI Memory System 维护任务

**每次收到 Heartbeat 时执行以下检查：**

## 1. 读取 AI Memory System 核心文件

```
读取 ai-memory-system/README.md
读取 ai-memory-system/Memory/L4-core/identity.md（了解核心价值观）
读取 ai-memory-system/Intent/goals/short-term/（了解当前目标）
```

## 2. 检查待沉淀内容

**检查 L1 情境层：**
- [ ] 是否有新的对话需要生成摘要？
- [ ] 当前会话是否超过 10 轮需要自动摘要？

**检查 L2 行为层候选：**
- [ ] 是否有重复出现 3 次以上的行为模式？
- [ ] 是否需要更新 work-habits.md？

**检查 L3 认知层候选：**
- [ ] 是否有稳定的思维模式浮现？
- [ ] Bruce 是否明确声明了决策原则？

**检查 L4 核心层：**
- [ ] ⚠️ **绝不自动修改 L4！**
- [ ] 如果有候选内容，提示 Bruce 人工确认

## 3. 检查 Review 提醒

查看 `ai-memory-system/Meta/config/triggers.yaml` 中的 review 计划：
- [ ] L1 每周 Review（每周一）
- [ ] L2 每月 Review（每月1日）
- [ ] L3 每季度 Review（季度首日）

如果接近 review 日期（±1天），主动提醒 Bruce。

## 4. 检查归档任务

- [ ] L1 层是否有超过 30 天的文件需要归档到 `archive/L1/`？

## 5. 检查 Intent 轨道

- [ ] 是否有即将到期（7天内）的目标？
- [ ] 是否需要更新目标进度？

## 6. 状态追踪

更新 `ai-memory-system/Meta/heartbeat-state.json`：
```json
{
  "lastCheck": "2026-03-05T00:00:00Z",
  "pendingReviews": [],
  "candidatesL2": [],
  "candidatesL3": [],
  "archiveQueue": []
}
```

## 7. 何时主动联系 Bruce

**必须联系：**
- 检测到值得沉淀到 L2/L3 的内容（等待确认）
- Review 日期到期
- 目标即将到期

**静默处理（HEARTBEAT_OK）：**
- 常规检查无异常
- 仅更新了状态追踪
- 归档了旧文件

---

**提示：** 所有沉淀和 review 都需要 Bruce 确认后执行，不要自动写入 Memory 层。
