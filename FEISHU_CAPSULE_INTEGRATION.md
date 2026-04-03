# Feishu Capsule 自动集成配置指南

**配置日期**: 2026-03-05  
**版本**: v1.0  
**集成层文件**: `feishu_capsule_integration.py`

---

## 1. 集成方案概述

### 1.1 问题背景

继承的 Capsule 虽然功能完整，但需要**手动调用**才能生效：

```python
# ❌ 错误：直接调用工具，不会自动使用 Capsule
feishu_doc(action="append", content=raw_content)

# ✅ 正确：通过集成层调用，自动应用 Capsule
from feishu_capsule_integration import sanitize_for_feishu
clean_content = sanitize_for_feishu(raw_content)
feishu_doc(action="append", content=clean_content)
```

### 1.2 集成架构

```
┌─────────────────────────────────────────────────────────────┐
│                   集成层架构                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         FeishuToolWrapper (集成中心)                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ URL Selector│  │Doc Sanitizer│  │Msg Fallback │ │   │
│  │  │  (Gene)     │  │  (Capsule)  │  │  (Capsule)  │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────┼──────────────────────────────┐   │
│  │      便捷函数层       │      使用方式                │   │
│  ├──────────────────────┼──────────────────────────────┤   │
│  │ auto_detect_tool()   │  检测 URL → 返回工具名       │   │
│  │ sanitize_for_feishu()│  清理内容 → 返回 clean 文本  │   │
│  │ send_with_fallback() │  发送消息 → 自动降级         │   │
│  └──────────────────────┴──────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 使用方式

### 2.1 场景一：写入飞书文档前自动清理

**问题**: 直接写入 markdown 会导致结构错位

**解决方案**:

```python
from feishu_capsule_integration import sanitize_for_feishu

# 原始内容（可能有格式问题）
raw_content = """
# 标题

这是第一段。


这是第二段（有多个空行）。

- 列表项1

- 列表项2
"""

# ✅ 使用集成层自动清理
clean_content = sanitize_for_feishu(raw_content)

# 再写入飞书文档
feishu_doc(action="append", doc_token="xxx", content=clean_content)
```

**效果**:
- 多余空行被清理
- Tab 替换为空格
- 列表格式规范化
- 结构不再错位

---

### 2.2 场景二：操作飞书文档前自动选择工具

**问题**: 不知道该用 feishu-doc 还是 feishu-bitable

**解决方案**:

```python
from feishu_capsule_integration import auto_detect_tool

url = "https://xxx.feishu.cn/base/AbCdEf"

# ✅ 自动检测并返回工具名
tool = auto_detect_tool(url)
# 返回: "feishu-bitable"

# 根据返回的工具执行操作
if tool == "feishu-bitable":
    feishu_bitable(action="list_records", app_token="xxx")
elif tool == "feishu-doc":
    feishu_doc(action="append", doc_token="xxx", content="...")
```

**支持的 URL 模式**:
| URL 模式 | 检测类型 | 推荐工具 |
|----------|----------|----------|
| `/docs/`, `/wiki/`, `/docx/` | document | feishu-doc |
| `/sheets/` | sheet | feishu-sheet |
| `/base/`, `/bitable/` | bitable | feishu-bitable |

---

### 2.3 场景三：发送飞书消息时自动降级

**问题**: 复杂 markdown 发送失败，用户收不到消息

**解决方案**:

```python
from feishu_capsule_integration import send_with_fallback

# ✅ 自动降级发送
result = send_with_fallback(
    chat_id="oc_xxx",
    content="**粗体** 和 `代码块`",  # 可能触发降级
    card={"header": {...}, "elements": [...]}  # 备选卡片
)

# 内部自动执行:
# 1. 尝试富文本 → 代码块不支持 → 失败
# 2. 尝试交互卡片 → 成功
# 3. 返回发送结果
```

**降级链**:
```
富文本 → 代码块/表格检测失败 → 交互卡片 → 卡片拒绝 → 纯文本
```

---

## 3. 完整工作流示例

### 3.1 读取文档 + 自动清理 + 写入新文档

```python
from feishu_capsule_integration import (
    auto_detect_tool,
    sanitize_for_feishu,
    get_feishu_wrapper
)

# 1. 检测源文档 URL 类型
source_url = "https://xxx.feishu.cn/docs/AbCdEf"
source_tool = auto_detect_tool(source_url)  # -> "feishu-doc"

# 2. 读取内容（根据工具类型调用不同方法）
if source_tool == "feishu-doc":
    source_doc = feishu_doc(action="read", doc_token="AbCdEf")
    content = source_doc["content"]

# 3. 自动清理内容
clean_content = sanitize_for_feishu(content)

# 4. 检测目标文档 URL 类型
target_url = "https://xxx.feishu.cn/base/XyZaBc"
target_tool = auto_detect_tool(target_url)  # -> "feishu-bitable"

# 5. 写入目标（可能需要格式转换）
if target_tool == "feishu-bitable":
    # 将清理后的内容转换为表格记录
    feishu_bitable(action="create_record", app_token="XyZaBc", fields={...})
```

---

## 4. 自动化配置（推荐）

### 4.1 创建默认使用集成层的快捷函数

```python
# 在 MEMORY.md 或工具配置中添加:

def feishu_doc_auto(doc_token: str, content: str, **kwargs):
    """
    自动清理后写入飞书文档
    
    这是 feishu_doc 的包装版本，自动应用 Doc Sanitizer
    """
    from feishu_capsule_integration import sanitize_for_feishu
    
    # 自动清理
    clean_content = sanitize_for_feishu(content)
    
    # 调用原始工具
    return feishu_doc(action="append", doc_token=doc_token, 
                      content=clean_content, **kwargs)


def feishu_send_auto(chat_id: str, content: str, **kwargs):
    """
    自动降级发送飞书消息
    
    这是 message 工具的包装版本，自动应用 Message Fallback
    """
    from feishu_capsule_integration import send_with_fallback
    
    return send_with_fallback(chat_id, content, **kwargs)
```

### 4.2 在 OpenClaw 配置中设置默认行为

由于无法修改 OpenClaw 核心，建议：

1. **在 MEMORY.md 中记录快捷函数**
2. **每次处理飞书文档时，主动使用集成层**
3. **创建检查清单**，确保 Capsule 被正确应用

---

## 5. 检查清单

处理飞书相关任务时，使用以下检查清单：

### 5.1 发送消息前

- [ ] 是否使用了 `send_with_fallback()` 而不是直接 `message()`?
- [ ] 是否提供了备选卡片内容?

### 5.2 写入文档前

- [ ] 是否使用了 `sanitize_for_feishu()` 清理内容?
- [ ] 是否检查了清理后的结构?

### 5.3 操作文档/表格前

- [ ] 是否使用了 `auto_detect_tool()` 确认工具类型?
- [ ] 是否根据返回的工具类型调用对应方法?

---

## 6. 验证集成是否生效

运行测试脚本验证：

```bash
cd /home/bruce/.openclaw/workspace
python3 feishu_capsule_integration.py
```

预期输出：
```
======================================================================
Feishu Capsule 自动集成层 - 测试
======================================================================

[测试1] URL 自动检测
----------------------------------------------------------------------
URL: https://xxx.feishu.cn/docs/abc123
推荐工具: feishu-doc
...

[测试2] 文档内容自动清理
----------------------------------------------------------------------
清理后的内容:
# 测试标题

这是第一段。
...

[测试3] 集成执行报告
----------------------------------------------------------------------
总执行次数: 4
执行记录:
  1. tool_selection
     工具: feishu-doc
  2. tool_selection
     工具: feishu-bitable
  3. tool_selection
     工具: feishu-sheet
  4. content_sanitization
     清理后长度: 61

======================================================================
测试完成 - 所有 Capsule 已正确集成
======================================================================
```

---

## 7. 文件清单

| 文件 | 用途 | 状态 |
|------|------|------|
| `feishu_url_detector.py` | URL 检测 Gene 实现 | ✅ 继承完成 |
| `feishu_doc_sanitizer.py` | 文档清理 Capsule 实现 | ✅ 继承完成 |
| `feishu_fallback_capsule.py` | 消息降级 Capsule 实现 | ✅ 继承完成 |
| `feishu_capsule_integration.py` | 集成层 | ✅ **本次创建** |
| `FEISHU_CAPSULE_INTEGRATION.md` | 配置指南 | ✅ **本次创建** |

---

## 8. 后续优化建议

### 8.1 短期

- [ ] 在实际任务中使用集成层，验证效果
- [ ] 记录使用日志，分析 Capsule 触发频率
- [ ] 完善错误处理和边界情况

### 8.2 中期

- [ ] 考虑发布自己的 Capsule 到 EvoMap
- [ ] 探索 OpenClaw 插件机制，实现自动 Hook
- [ ] 添加更多飞书相关的 Capsule 继承

### 8.3 长期

- [ ] 建立 Capsule 效果追踪机制
- [ ] 自动优化集成策略
- [ ] 贡献回 EvoMap 社区

---

**配置完成时间**: 2026-03-05 19:00  
**配置者**: 小爪 🐾
