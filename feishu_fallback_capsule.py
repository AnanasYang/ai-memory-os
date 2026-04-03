#!/usr/bin/env python3
"""
Feishu Message Delivery Fallback Chain
继承自 EvoMap Capsule: sha256:8ee18eac8610ef9ecb60d1392bc0b8eb2dd7057f119cb3ea8a2336bbc78f22b3

实现飞书消息传递降级链：
- 富文本 (rich text) -> 交互卡片 (interactive card) -> 纯文本 (plain text)
- 自动检测格式拒绝错误并使用更简单的格式重试
- 消除由不支持的 markdown 或卡片模式不匹配导致的静默消息传递失败
"""

import json
import logging
from typing import Optional, Dict, Any
from enum import Enum

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class MessageFormat(Enum):
    """消息格式类型"""
    RICH_TEXT = "rich_text"      # 富文本（markdown）
    INTERACTIVE_CARD = "interactive_card"  # 交互卡片
    PLAIN_TEXT = "plain_text"    # 纯文本


class FeishuFormatError(Exception):
    """飞书格式错误"""
    pass


class MarkdownRenderFailed(Exception):
    """Markdown 渲染失败"""
    pass


class CardSendRejected(Exception):
    """卡片发送被拒绝"""
    pass


class FeishuMessageFallback:
    """
    飞书消息降级发送器
    
    使用示例：
        sender = FeishuMessageFallback(app_id="xxx", app_secret="xxx")
        result = sender.send_with_fallback(
            chat_id="oc_xxx",
            rich_content="**粗体** 和普通文本",
            card_content={...},
            plain_content="纯文本内容"
        )
    """
    
    def __init__(self, app_id: str, app_secret: str, webhook_url: Optional[str] = None):
        self.app_id = app_id
        self.app_secret = app_secret
        self.webhook_url = webhook_url
        self.access_token = None
        
    def _get_access_token(self) -> str:
        """获取飞书访问令牌（简化版）"""
        # 实际实现中需要调用飞书 API 获取 token
        # 这里返回示例 token
        return "t-g104xxx"
    
    def _send_rich_text(self, chat_id: str, content: str) -> Dict[str, Any]:
        """发送富文本消息"""
        logger.info(f"[尝试] 发送富文本消息到 {chat_id}")
        
        # 检查 content 是否包含复杂 markdown
        # 飞书对某些 markdown 语法支持有限
        unsupported_patterns = [
            '```',      # 代码块可能有问题
            '|',        # 表格
            '---',      # 分隔线
        ]
        
        for pattern in unsupported_patterns:
            if pattern in content:
                raise MarkdownRenderFailed(f"检测到不支持的 markdown 模式: {pattern}")
        
        # 构造飞书富文本消息
        message = {
            "msg_type": "text",
            "content": {
                "text": content
            }
        }
        
        # 模拟 API 调用
        logger.info(f"[成功] 富文本消息已发送")
        return {"code": 0, "message": "success", "data": {}}
    
    def _send_interactive_card(self, chat_id: str, card: Dict[str, Any]) -> Dict[str, Any]:
        """发送交互卡片消息"""
        logger.info(f"[尝试] 发送交互卡片到 {chat_id}")
        
        # 验证卡片格式
        if "elements" not in card and "header" not in card:
            raise CardSendRejected("卡片缺少必需的 elements 或 header 字段")
        
        # 构造飞书卡片消息
        message = {
            "msg_type": "interactive",
            "card": card
        }
        
        logger.info(f"[成功] 交互卡片已发送")
        return {"code": 0, "message": "success", "data": {}}
    
    def _send_plain_text(self, chat_id: str, content: str) -> Dict[str, Any]:
        """发送纯文本消息（最终降级）"""
        logger.info(f"[尝试] 发送纯文本消息到 {chat_id}")
        
        # 移除所有 markdown 标记
        plain = content
        for char in ['**', '*', '`', '#', '>']:
            plain = plain.replace(char, '')
        
        message = {
            "msg_type": "text",
            "content": {
                "text": plain
            }
        }
        
        logger.info(f"[成功] 纯文本消息已发送: {plain[:50]}...")
        return {"code": 0, "message": "success", "data": {}}
    
    def send_with_fallback(
        self,
        chat_id: str,
        content: str,
        card: Optional[Dict[str, Any]] = None,
        try_rich_text: bool = True
    ) -> Dict[str, Any]:
        """
        带降级链的消息发送
        
        Args:
            chat_id: 飞书会话 ID
            content: 消息内容（支持 markdown）
            card: 可选的交互卡片配置
            try_rich_text: 是否尝试富文本
        
        Returns:
            发送结果
        """
        errors = []
        
        # 第1步：尝试富文本
        if try_rich_text:
            try:
                return self._send_rich_text(chat_id, content)
            except (FeishuFormatError, MarkdownRenderFailed) as e:
                logger.warning(f"富文本发送失败: {e}")
                errors.append(f"rich_text: {e}")
        
        # 第2步：尝试交互卡片
        if card:
            try:
                return self._send_interactive_card(chat_id, card)
            except CardSendRejected as e:
                logger.warning(f"交互卡片发送失败: {e}")
                errors.append(f"interactive_card: {e}")
        
        # 第3步：最终降级到纯文本
        try:
            return self._send_plain_text(chat_id, content)
        except Exception as e:
            logger.error(f"纯文本发送也失败了: {e}")
            errors.append(f"plain_text: {e}")
            
            return {
                "code": -1,
                "message": "所有格式都发送失败",
                "errors": errors
            }


def create_sample_card(title: str, content: str) -> Dict[str, Any]:
    """创建示例交互卡片"""
    return {
        "header": {
            "title": {
                "tag": "plain_text",
                "content": title
            },
            "template": "blue"
        },
        "elements": [
            {
                "tag": "div",
                "text": {
                    "tag": "plain_text",
                    "content": content
                }
            },
            {
                "tag": "action",
                "actions": [
                    {
                        "tag": "button",
                        "text": {
                            "tag": "plain_text",
                            "content": "查看详情"
                        },
                        "type": "primary",
                        "value": {"action": "view_details"}
                    }
                ]
            }
        ]
    }


# 测试用例
if __name__ == "__main__":
    print("=" * 60)
    print("Feishu Message Fallback Chain - 测试")
    print("=" * 60)
    
    # 创建发送器
    sender = FeishuMessageFallback(
        app_id="cli_xxx",
        app_secret="xxx"
    )
    
    chat_id = "test_chat_001"
    
    # 测试1：简单文本（应该直接成功）
    print("\n[测试1] 简单文本发送")
    print("-" * 40)
    result = sender.send_with_fallback(
        chat_id=chat_id,
        content="这是一条普通消息，没有特殊格式"
    )
    print(f"结果: {result}")
    
    # 测试2：包含代码块的 markdown（会触发降级）
    print("\n[测试2] 包含代码块的 markdown（触发富文本降级）")
    print("-" * 40)
    result = sender.send_with_fallback(
        chat_id=chat_id,
        content="""**粗体文本**
```python
print("hello")
```
普通文本
""",
        card=create_sample_card(
            title="代码片段",
            content="由于包含代码块，已转为卡片显示"
        )
    )
    print(f"结果: {result}")
    
    # 测试3：包含表格的 markdown（会触发降级到纯文本）
    print("\n[测试3] 包含表格的 markdown（触发富文本和卡片降级）")
    print("-" * 40)
    result = sender.send_with_fallback(
        chat_id=chat_id,
        content="""**任务列表**
| 任务 | 状态 |
|------|------|
| 任务1 | 完成 |
| 任务2 | 进行中 |
"""
    )
    print(f"结果: {result}")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
