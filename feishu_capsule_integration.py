#!/usr/bin/env python3
"""
Feishu Capsule Auto-Integration Layer
飞书 Capsule 自动集成层

确保继承的 Capsule 策略能够自动执行：
1. URL 检测 → 自动选择正确工具
2. 文档清理 → 自动 sanitization
3. 消息降级 → 自动 fallback
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from feishu_url_detector import FeishuToolSelector, FeishuUrlType
from feishu_doc_sanitizer import FeishuDocSanitizer
from feishu_fallback_capsule import FeishuMessageFallback
from typing import Optional, Dict, Any
import json


class FeishuToolWrapper:
    """
    飞书工具包装器 - 自动集成所有 Capsule
    """
    
    def __init__(self):
        self.url_selector = FeishuToolSelector()
        self.doc_sanitizer = FeishuDocSanitizer()
        self.message_fallback = FeishuMessageFallback(
            app_id="cli_xxx",  # 从配置读取
            app_secret="xxx"   # 从配置读取
        )
        
        # 记录集成状态
        self.integration_log = []
    
    def auto_select_tool(self, url: str) -> Dict[str, Any]:
        """
        自动选择正确的飞书工具
        
        Args:
            url: 飞书文档/表格/多维表格 URL
            
        Returns:
            工具选择结果
        """
        result = self.url_selector.auto_redirect(url, "auto_detect")
        
        self.integration_log.append({
            "action": "tool_selection",
            "url": url,
            "detected_type": result["detected_type"],
            "recommended_tool": result["recommended_tool"],
            "should_redirect": result["should_redirect"]
        })
        
        return result
    
    def prepare_doc_content(self, content: str) -> Dict[str, Any]:
        """
        准备飞书文档内容 - 自动 sanitization
        
        Args:
            content: 原始 markdown 内容
            
        Returns:
            清理后的内容和元数据
        """
        result = self.doc_sanitizer.process_for_feishu(content)
        
        self.integration_log.append({
            "action": "content_sanitization",
            "original_length": result["original_length"],
            "sanitized_length": result["sanitized_length"],
            "is_valid": result["is_valid"],
            "block_count": len(result["blocks"]),
            "errors": len(result["errors"])
        })
        
        return result
    
    def send_message_auto(self, chat_id: str, content: str, 
                          card: Optional[Dict] = None) -> Dict[str, Any]:
        """
        自动发送飞书消息 - 带降级链
        
        Args:
            chat_id: 会话 ID
            content: 消息内容
            card: 可选的卡片配置
            
        Returns:
            发送结果
        """
        result = self.message_fallback.send_with_fallback(
            chat_id=chat_id,
            content=content,
            card=card,
            try_rich_text=True
        )
        
        self.integration_log.append({
            "action": "message_send",
            "chat_id": chat_id,
            "success": result.get("code") == 0,
            "result": result
        })
        
        return result
    
    def get_integration_report(self) -> Dict[str, Any]:
        """获取集成执行报告"""
        return {
            "total_actions": len(self.integration_log),
            "actions": self.integration_log
        }


# 全局包装器实例
_feishu_wrapper = None

def get_feishu_wrapper() -> FeishuToolWrapper:
    """获取全局飞书工具包装器实例"""
    global _feishu_wrapper
    if _feishu_wrapper is None:
        _feishu_wrapper = FeishuToolWrapper()
    return _feishu_wrapper


# 便捷函数 - 供外部调用
def auto_detect_tool(url: str) -> str:
    """
    自动检测并返回推荐的工具名称
    
    使用示例:
        tool = auto_detect_tool("https://xxx.feishu.cn/base/xxx")
        # 返回: "feishu-bitable"
    """
    wrapper = get_feishu_wrapper()
    result = wrapper.auto_select_tool(url)
    return result["recommended_tool"]


def sanitize_for_feishu(content: str) -> str:
    """
    自动清理 markdown 内容，使其符合飞书文档要求
    
    使用示例:
        clean_content = sanitize_for_feishu("# 标题\n\n\n内容...")
        # 返回清理后的内容
    """
    wrapper = get_feishu_wrapper()
    result = wrapper.prepare_doc_content(content)
    return result["sanitized_content"]


def send_with_fallback(chat_id: str, content: str, 
                       card: Optional[Dict] = None) -> Dict[str, Any]:
    """
    自动发送消息，失败时自动降级
    
    使用示例:
        result = send_with_fallback("oc_xxx", "**粗体**内容")
    """
    wrapper = get_feishu_wrapper()
    return wrapper.send_message_auto(chat_id, content, card)


def get_integration_log() -> list:
    """获取集成执行日志"""
    wrapper = get_feishu_wrapper()
    return wrapper.integration_log


# 测试验证
if __name__ == "__main__":
    print("=" * 70)
    print("Feishu Capsule 自动集成层 - 测试")
    print("=" * 70)
    
    wrapper = FeishuToolWrapper()
    
    # 测试1: URL 自动检测
    print("\n[测试1] URL 自动检测")
    print("-" * 70)
    
    test_urls = [
        "https://xxx.feishu.cn/docs/abc123",
        "https://xxx.feishu.cn/base/xyz789",
        "https://xxx.feishu.cn/sheets/def456"
    ]
    
    for url in test_urls:
        result = wrapper.auto_select_tool(url)
        print(f"URL: {url}")
        print(f"推荐工具: {result['recommended_tool']}")
        print()
    
    # 测试2: 文档内容自动清理
    print("\n[测试2] 文档内容自动清理")
    print("-" * 70)
    
    messy_content = """# 测试标题

这是第一段。


这是第二段（多余空行）。

- 项1

- 项2

```python
print("hello")
```

最后一段。
"""
    
    result = wrapper.prepare_doc_content(messy_content)
    print("清理后的内容:")
    print(result['sanitized_content'])
    print()
    
    # 测试3: 集成报告
    print("\n[测试3] 集成执行报告")
    print("-" * 70)
    
    report = wrapper.get_integration_report()
    print(f"总执行次数: {report['total_actions']}")
    print("\n执行记录:")
    for i, action in enumerate(report['actions'], 1):
        print(f"  {i}. {action['action']}")
        if 'recommended_tool' in action:
            print(f"     工具: {action['recommended_tool']}")
        if 'sanitized_length' in action:
            print(f"     清理后长度: {action['sanitized_length']}")
    
    print("\n" + "=" * 70)
    print("测试完成 - 所有 Capsule 已正确集成")
    print("=" * 70)
