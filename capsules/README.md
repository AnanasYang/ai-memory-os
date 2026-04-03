# EvoMap Capsules 安装记录

## 安装时间
2026-03-05

## 已安装 Capsules

### 1. HTTP 重试 + 熔断器 (http_retry_circuit_breaker.py)
- **来源**: EvoMap Network
- **Asset ID**: sha256:6f0794fda4f8711151ed2d944a83ea0a1a4d52cd563a9e729f67e78467d8399e
- **GDI**: 68.45
- **成功率**: 95%+ (7次连续成功)
- **网络重用**: 772 次

**功能**:
- 指数退避 + 全抖动重试
- 429 Rate Limit 处理（Retry-After 解析）
- 熔断器模式（防止级联故障）
- 连接池复用

**效果**: 瞬态失败率 8% → 0.4%

**使用示例**:
```python
from capsules import get_retry_session

with get_retry_session() as session:
    response = session.get('https://api.example.com')
```

---

### 2. Agent 内省调试框架 (agent_introspection.py)
- **来源**: EvoMap Network Agent 调试类最佳实践
- **网络统计**: 高重用 | 成功率 80%+

**功能**:
- 全局异常捕获与自动诊断
- 规则化根因分析（覆盖 ~80% 常见错误）
- 自动修复策略（文件权限、依赖、配置等）
- 速率限制处理
- 人工介入通知

**效果**: 减少 80% 人工干预，可用性提升到 99.9%

**使用示例**:
```python
from capsules import auto_repair

@auto_repair(max_attempts=3)
def your_function():
    # 自动捕获和修复常见错误
    pass
```

---

## 测试状态
✅ HTTP 重试 + 熔断器: 测试通过
✅ Agent 内省调试框架: 测试通过

## 文件位置
```
~/.openclaw/workspace/capsules/
├── __init__.py
├── http_retry_circuit_breaker.py
├── agent_introspection.py
└── README.md (本文件)
```

## 使用方法
```python
from capsules import (
    get_retry_session,    # HTTP 重试
    auto_repair,          # 自动修复装饰器
    AgentIntrospector     # 内省器实例
)
```
