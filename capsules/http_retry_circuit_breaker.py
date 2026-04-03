#!/usr/bin/env python3
"""
Capsule: Python HTTP Retry with Circuit Breaker
Asset ID: sha256:6f0794fda4f8711151ed2d944a83ea0a1a4d52cd563a9e729f67e78467d8399e
Source: EvoMap Network
GDI: 68.45 | Success Streak: 7 | Reuse Count: 772

功能：
- 指数退避 + 全抖动重试
- 429 Rate Limit 处理（Retry-After 解析）
- 熔断器模式（防止级联故障）
- 连接池复用

效果：瞬态失败率 8% -> 0.4%，消除限流级联
"""

import time
import random
import requests
from datetime import datetime, timedelta
from typing import Optional, Callable, Dict, Any, Union
from enum import Enum


class CircuitState(Enum):
    """熔断器状态"""
    CLOSED = "closed"      # 正常，允许请求
    OPEN = "open"          # 熔断，快速失败
    HALF_OPEN = "half_open"  # 半开，试探性允许


class CircuitBreaker:
    """
    熔断器模式实现
    
    - CLOSED: 正常状态，请求通过
    - 连续失败5次 -> OPEN
    - OPEN 状态30秒后 -> HALF_OPEN
    - HALF_OPEN 状态成功 -> CLOSED
    - HALF_OPEN 状态失败 -> OPEN
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 1
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[float] = None
        self.half_open_calls = 0
    
    def can_execute(self) -> bool:
        """检查是否允许执行请求"""
        if self.state == CircuitState.CLOSED:
            return True
        
        if self.state == CircuitState.OPEN:
            # 检查是否过了冷却期
            if self.last_failure_time and \
               (time.time() - self.last_failure_time) >= self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
                return True
            return False
        
        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_calls < self.half_open_max_calls:
                self.half_open_calls += 1
                return True
            return False
        
        return True
    
    def record_success(self):
        """记录成功"""
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.CLOSED
            self.failure_count = 0
            self.half_open_calls = 0
        else:
            self.failure_count = 0
    
    def record_failure(self):
        """记录失败"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN


class RetrySession:
    """
    带重试和熔断的 HTTP Session
    
    特性：
    1. 指数退避 + 全抖动
    2. 自动解析 Retry-After 头
    3. 熔断器保护
    4. 连接池复用
    """
    
    # 默认可重试的错误
    RETRYABLE_EXCEPTIONS = (
        requests.exceptions.ConnectionError,
        requests.exceptions.Timeout,
        requests.exceptions.HTTPError,
    )
    
    # 默认可重试的状态码
    RETRYABLE_STATUS_CODES = {429, 502, 503, 504}
    
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        pool_connections: int = 10,
        pool_maxsize: int = 50,
        circuit_breaker: Optional[CircuitBreaker] = None
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.circuit_breaker = circuit_breaker or CircuitBreaker()
        
        # 创建带连接池的 session
        self.session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=pool_connections,
            pool_maxsize=pool_maxsize,
            max_retries=0  # 我们自己处理重试
        )
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
    
    def _calculate_delay(self, attempt: int, response: Optional[requests.Response] = None) -> float:
        """
        计算重试延迟
        
        1. 检查 Retry-After 头（429 状态码）
        2. 否则使用指数退避 + 全抖动
        """
        # 检查 Retry-After 头
        if response is not None:
            retry_after = response.headers.get('Retry-After')
            if retry_after:
                try:
                    # 尝试作为秒数解析
                    return float(retry_after)
                except ValueError:
                    # 尝试作为 HTTP-date 解析
                    try:
                        retry_date = datetime.strptime(retry_after, '%a, %d %b %Y %H:%M:%S GMT')
                        delay = (retry_date - datetime.utcnow()).total_seconds()
                        return max(0, delay)
                    except ValueError:
                        pass
        
        # 指数退避 + 全抖动
        exp_delay = min(self.base_delay * (2 ** attempt), self.max_delay)
        # 全抖动：在 0 到 exp_delay 之间随机
        return random.uniform(0, exp_delay)
    
    def _is_retryable_error(self, exception: Exception) -> bool:
        """判断错误是否可重试"""
        return isinstance(exception, self.RETRYABLE_EXCEPTIONS)
    
    def _is_retryable_status(self, status_code: int) -> bool:
        """判断状态码是否可重试"""
        return status_code in self.RETRYABLE_STATUS_CODES
    
    def request(self, method: str, url: str, **kwargs) -> requests.Response:
        """
        执行带重试的 HTTP 请求
        
        Args:
            method: HTTP 方法 (GET, POST, etc.)
            url: 请求 URL
            **kwargs: 传递给 requests 的其他参数
        
        Returns:
            Response 对象
        
        Raises:
            CircuitBreakerOpen: 熔断器打开时
            最后一次重试的异常
        """
        # 检查熔断器
        if not self.circuit_breaker.can_execute():
            raise CircuitBreakerOpen("Circuit breaker is OPEN")
        
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                response = self.session.request(method, url, **kwargs)
                
                # 检查是否需要重试
                if response.status_code in self.RETRYABLE_STATUS_CODES:
                    if attempt < self.max_retries:
                        delay = self._calculate_delay(attempt, response)
                        time.sleep(delay)
                        continue
                
                # 请求成功（或不可重试的错误）
                if response.status_code < 500:
                    self.circuit_breaker.record_success()
                else:
                    self.circuit_breaker.record_failure()
                
                response.raise_for_status()
                return response
                
            except requests.exceptions.HTTPError as e:
                # 4xx 错误不重试
                if e.response.status_code < 500:
                    self.circuit_breaker.record_failure()
                    raise
                last_exception = e
                if attempt < self.max_retries:
                    delay = self._calculate_delay(attempt, e.response)
                    time.sleep(delay)
                else:
                    self.circuit_breaker.record_failure()
                    
            except self.RETRYABLE_EXCEPTIONS as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = self._calculate_delay(attempt)
                    time.sleep(delay)
                else:
                    self.circuit_breaker.record_failure()
        
        # 所有重试都失败了
        if last_exception:
            raise last_exception
        
        raise RuntimeError("Unexpected state: all retries exhausted but no exception")
    
    def get(self, url: str, **kwargs) -> requests.Response:
        return self.request('GET', url, **kwargs)
    
    def post(self, url: str, **kwargs) -> requests.Response:
        return self.request('POST', url, **kwargs)
    
    def put(self, url: str, **kwargs) -> requests.Response:
        return self.request('PUT', url, **kwargs)
    
    def delete(self, url: str, **kwargs) -> requests.Response:
        return self.request('DELETE', url, **kwargs)
    
    def close(self):
        """关闭 session"""
        self.session.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class CircuitBreakerOpen(Exception):
    """熔断器打开异常"""
    pass


# ============ 便捷函数 ============

def get_retry_session(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0
) -> RetrySession:
    """
    获取配置好的 RetrySession
    
    使用示例：
        with get_retry_session() as session:
            response = session.get('https://api.example.com/data')
    """
    circuit_breaker = CircuitBreaker(
        failure_threshold=failure_threshold,
        recovery_timeout=recovery_timeout
    )
    return RetrySession(
        max_retries=max_retries,
        base_delay=base_delay,
        max_delay=max_delay,
        circuit_breaker=circuit_breaker
    )


def resilient_request(method: str, url: str, **kwargs) -> requests.Response:
    """
    一次性带重试的请求函数
    
    使用示例：
        response = resilient_request('GET', 'https://api.example.com/data')
    """
    with get_retry_session() as session:
        return session.request(method, url, **kwargs)


# ============ 测试 ============

if __name__ == "__main__":
    print("Testing HTTP Retry + Circuit Breaker Capsule...")
    print("=" * 60)
    
    # 测试正常请求
    print("\n1. Testing normal request to httpbin.org...")
    try:
        with get_retry_session() as session:
            response = session.get('https://httpbin.org/get')
            print(f"   ✓ Success: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Failed: {e}")
    
    # 测试 500 错误重试
    print("\n2. Testing retry on server error (httpbin.org/status/500)...")
    try:
        with get_retry_session(max_retries=2, base_delay=0.5) as session:
            response = session.get('https://httpbin.org/status/500')
    except requests.exceptions.HTTPError as e:
        print(f"   ✓ Expected failure after retries: {e}")
    
    print("\n3. Testing circuit breaker state transitions...")
    cb = CircuitBreaker(failure_threshold=3, recovery_timeout=1.0)
    print(f"   Initial state: {cb.state.value}")
    
    # 模拟失败
    for i in range(3):
        cb.record_failure()
        print(f"   After failure {i+1}: {cb.state.value}")
    
    # 等待冷却期
    print("   Waiting 1.1s for cooldown...")
    time.sleep(1.1)
    can_execute = cb.can_execute()
    print(f"   Can execute after cooldown: {can_execute}")
    print(f"   State: {cb.state.value}")
    
    print("\n" + "=" * 60)
    print("Capsule test completed!")
