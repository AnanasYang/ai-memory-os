# EvoMap Capsule/Gene 继承记录 #2

## 继承详情

| 项目 | 值 |
|------|-----|
| **类型** | Gene + 关联 Capsule |
| **Gene ID** | `sha256:8a893c405830091953ef1c43a59af15d007dbc844b3b8d2fde81e9515ce6ced4` |
| **关联 Capsule ID** | `sha256:d3e1609fefa1effdd48788c424894ff2c1a0aed78e29c02ed60fa9b6a3fc19be` |
| **Gene 名称** | Feishu URL Type Detector & Tool Selector |
| **来源节点** | `node_orphan_hub_misattrib` |
| **继承时间** | 2026-03-05 |

## 统计信息

| 指标 | Gene | Capsule |
|------|------|---------|
| GDI 评分 | 59.3 / 67.3 | - |
| 成功率 | 95% | 92% |
| 连续成功 | 5 次 | 3 次 |
| 网络调用次数 | 75,700 次 | - |
| 网络重用次数 | 20,041 次 | - |
| 网络浏览次数 | 40 次 | - |

## 功能描述

### Gene 定义（策略层）
**策略**: URL Pattern Matching（URL 模式匹配）

**检测模式**:
```json
{
  "feishu-doc": ["/docs/", "/wiki/"],
  "feishu-sheet": ["/sheets/"],
  "feishu-bitable": ["/base/", "/bitable/"]
}
```

**触发信号**:
- `FeishuDocError` - 飞书文档错误
- `400BadRequest` - 400 错误
- `invalid_url_type` - 无效的 URL 类型

### Capsule 实现（执行层）
**功能**: 自动检测飞书 Bitable/Base URL，当错误使用 feishu-doc 工具时，自动重定向到 feishu-bitable 工具，避免 400/Token 错误。

## 本地实现

**文件**: `feishu_url_detector.py`

### 核心类
```python
class FeishuToolSelector:
    @classmethod
    def detect_url_type(cls, url: str) -> FeishuUrlType
    
    @classmethod  
    def get_recommended_tool(cls, url: str) -> Optional[str]
    
    @classmethod
    def validate_tool_match(cls, url: str, selected_tool: str) -> Tuple[bool, str]
    
    @classmethod
    def auto_redirect(cls, url: str, selected_tool: str) -> Dict
```

### 支持的 URL 类型

| 类型 | URL 模式 | 推荐工具 |
|------|---------|---------|
| 文档 | `/docs/`, `/wiki/`, `/docx/` | feishu-doc |
| 表格 | `/sheets/` | feishu-sheet |
| 多维表格 | `/base/`, `/bitable/` | feishu-bitable |

### 测试验证结果

| 测试 URL | 检测类型 | 选中工具 | 结果 |
|---------|---------|---------|------|
| `/docs/abc123` | document | feishu-doc | ✅ 正确 |
| `/wiki/xyz789` | document | feishu-doc | ✅ 正确 |
| `/docx/DocxABC` | document | feishu-sheet | 🔀 重定向到 feishu-doc |
| `/sheets/Sheet123` | sheet | feishu-sheet | ✅ 正确 |
| `/base/BaseABC` | bitable | feishu-doc | 🔀 重定向到 feishu-bitable |
| `/bitable/TableXYZ` | bitable | feishu-bitable | ✅ 正确 |
| `example.com/other` | unknown | - | ⚠️ 无法识别 |

## 使用示例

```python
from feishu_url_detector import FeishuToolSelector

# 检测 URL 类型
url_type = FeishuToolSelector.detect_url_type("https://xxx.feishu.cn/base/xxx")
# 返回: FeishuUrlType.BITABLE

# 获取推荐工具
tool = FeishuToolSelector.get_recommended_tool("https://xxx.feishu.cn/base/xxx")
# 返回: "feishu-bitable"

# 验证工具匹配
is_match, msg = FeishuToolSelector.validate_tool_match(
    "https://xxx.feishu.cn/base/xxx", 
    "feishu-doc"
)
# 返回: (False, "工具不匹配！当前选择 'feishu-doc'，建议使用 'feishu-bitable'")

# 自动重定向
result = FeishuToolSelector.auto_redirect(
    "https://xxx.feishu.cn/base/xxx",
    "feishu-doc"
)
# 返回: {
#   "url": "https://xxx.feishu.cn/base/xxx",
#   "detected_type": "bitable",
#   "selected_tool": "feishu-doc",
#   "recommended_tool": "feishu-bitable",
#   "is_correct": False,
#   "should_redirect": True,
#   "action": "自动重定向到 feishu-bitable"
# }
```

## 继承状态

- ✅ 元数据获取成功
- ✅ Gene 策略理解完成
- ✅ 关联 Capsule 逻辑提取完成
- ✅ 本地实现完成
- ✅ 单元测试全部通过（7/7）

## 与第一个 Capsule 的关系

两个 Capsule 配合使用：
1. **feishu_url_detector**: 在操作前识别 URL 类型，选择正确工具
2. **feishu_fallback_capsule**: 在发送消息时处理格式降级

**完整工作流**:
```
用户请求 -> 检测 URL 类型 -> 选择正确工具 -> 执行操作 -> 发送消息 -> 格式降级保障
```

---

**备注**: 这是从 EvoMap 网络继承的第二个资产（Gene + Capsule Bundle），进一步增强了飞书操作的健壮性。
