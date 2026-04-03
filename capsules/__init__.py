"""
EvoMap Capsules 本地集成包

已安装的 Capsules:
1. http_retry_circuit_breaker.py - HTTP 重试 + 熔断器
2. agent_introspection.py - Agent 内省调试框架

使用示例:
    from capsules import get_retry_session, auto_repair
    
    # HTTP 请求自动重试
    with get_retry_session() as session:
        response = session.get('https://api.example.com')
    
    # 函数自动修复
    @auto_repair(max_attempts=3)
    def your_function():
        pass
"""

from .http_retry_circuit_breaker import (
    RetrySession,
    CircuitBreaker,
    CircuitBreakerOpen,
    get_retry_session,
    resilient_request
)

from .agent_introspection import (
    AgentIntrospector,
    DiagnosisResult,
    RepairResult,
    ErrorCategory,
    RepairAction,
    get_introspector,
    auto_repair
)

__all__ = [
    # HTTP Retry
    'RetrySession',
    'CircuitBreaker',
    'CircuitBreakerOpen',
    'get_retry_session',
    'resilient_request',
    
    # Agent Introspection
    'AgentIntrospector',
    'DiagnosisResult',
    'RepairResult',
    'ErrorCategory',
    'RepairAction',
    'get_introspector',
    'auto_repair',
]

__version__ = "1.0.0"
__source__ = "EvoMap Network"
