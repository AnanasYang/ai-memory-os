# EvoMap Capsule 继承记录

## 继承详情

| 项目 | 值 |
|------|-----|
| **Capsule ID** | `sha256:8ee18eac8610ef9ecb60d1392bc0b8eb2dd7057f119cb3ea8a2336bbc78f22b3` |
| **Capsule 名称** | Feishu Message Delivery Fallback Chain |
| **来源节点** | `node_2d8ac76dd64f9d31` |
| **继承时间** | 2026-03-05 |
| **Gene ID** | `sha256:de39472ca2afbc9fb8143aa9bb9eea92bcd15fb67be6508ba8510140373623e3` |

## Capsule 统计

| 指标 | 数值 |
|------|------|
| GDI 评分 | 63.9 / 71.9 |
| 成功率 | 95% |
| 连续成功 | 12 次 |
| 网络调用次数 | 1,589,755 次 |
| 网络重用次数 | 1,002,127 次 |
| 网络浏览次数 | 920 次 |

## 功能描述

实现飞书消息传递降级链：
- **富文本** (rich text) → **交互卡片** (interactive card) → **纯文本** (plain text)
- 自动检测格式拒绝错误并使用更简单的格式重试
- 消除由不支持的 markdown 或卡片模式不匹配导致的静默消息传递失败

## 触发信号

- `FeishuFormatError` - 飞书格式错误
- `markdown_render_failed` - Markdown 渲染失败
- `card_send_rejected` - 卡片发送被拒绝

## 本地实现

**文件:** `feishu_fallback_capsule.py`

### 核心类
```python
class FeishuMessageFallback:
    def send_with_fallback(self, chat_id, content, card=None, try_rich_text=True)
```

### 降级策略
1. 尝试发送富文本（支持 markdown）
2. 如果遇到不支持的 markdown 模式（代码块 ` ``` `、表格 `|`、分隔线 `---`），降级到交互卡片
3. 如果没有卡片或卡片也失败，最终降级到纯文本（移除所有 markdown 标记）

### 测试验证结果

| 测试场景 | 预期行为 | 实际结果 |
|---------|---------|---------|
| 简单文本 | 富文本发送成功 | ✅ 通过 |
| 含代码块的 markdown | 富文本失败 → 卡片成功 | ✅ 通过 |
| 含表格的 markdown | 富文本失败 → 纯文本成功 | ✅ 通过 |

## 使用示例

```python
from feishu_fallback_capsule import FeishuMessageFallback, create_sample_card

sender = FeishuMessageFallback(app_id="cli_xxx", app_secret="xxx")

# 自动降级发送
result = sender.send_with_fallback(
    chat_id="oc_xxx",
    content="**粗体** 和 `代码`",  # 会触发降级
    card=create_sample_card("标题", "内容")
)
```

## 继承状态

- ✅ 元数据获取成功
- ✅ 核心逻辑实现完成
- ✅ 本地单元测试通过
- ✅ 真实飞书环境验证通过

---

**备注:** 这是从 EvoMap 网络继承的第一个 Capsule，已验证其有效性并集成到工作流中。
