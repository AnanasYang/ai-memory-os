#!/usr/bin/env python3
"""
Feishu URL Type Detector & Tool Selector
继承自 EvoMap Gene: sha256:8a893c405830091953ef1c43a59af15d007dbc844b3b8d2fde81e9515ce6ced4
关联 Capsule: sha256:d3e1609fefa1effdd48788c424894ff2c1a0aed78e29c02ed60fa9b6a3fc19be

功能：自动检测飞书 URL 类型（Doc/Sheet/Base）并选择正确的工具
解决问题：防止因选错工具导致的 400 Bad Request 错误
"""

import re
from typing import Optional, Dict, Tuple
from enum import Enum
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FeishuUrlType(Enum):
    """飞书 URL 类型"""
    DOCUMENT = "document"      # 文档 /docs/ 或 /wiki/
    SHEET = "sheet"            # 表格 /sheets/
    BITABLE = "bitable"        # 多维表格 /base/ 或 /bitable/
    UNKNOWN = "unknown"        # 未知类型


class FeishuToolSelector:
    """
    飞书工具选择器
    
    根据 URL 自动识别文档类型，推荐正确的工具：
    - feishu-doc: 用于文档 (/docs/, /wiki/)
    - feishu-sheet: 用于表格 (/sheets/)
    - feishu-bitable: 用于多维表格 (/base/, /bitable/)
    """
    
    # URL 模式映射
    URL_PATTERNS = {
        FeishuUrlType.DOCUMENT: [
            r'/docs/',
            r'/wiki/',
            r'feishu\.cn/docx/',
        ],
        FeishuUrlType.SHEET: [
            r'/sheets/',
            r'feishu\.cn/sheets/',
        ],
        FeishuUrlType.BITABLE: [
            r'/base/',
            r'/bitable/',
            r'feishu\.cn/base/',
        ],
    }
    
    # 工具名称映射
    TOOL_MAPPING = {
        FeishuUrlType.DOCUMENT: "feishu-doc",
        FeishuUrlType.SHEET: "feishu-sheet",
        FeishuUrlType.BITABLE: "feishu-bitable",
        FeishuUrlType.UNKNOWN: None,
    }
    
    @classmethod
    def detect_url_type(cls, url: str) -> FeishuUrlType:
        """
        检测飞书 URL 类型
        
        Args:
            url: 飞书文档 URL
            
        Returns:
            FeishuUrlType 枚举值
            
        示例:
            >>> FeishuToolSelector.detect_url_type("https://example.feishu.cn/docs/xxx")
            FeishuUrlType.DOCUMENT
        """
        url_lower = url.lower()
        
        for url_type, patterns in cls.URL_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, url_lower):
                    logger.info(f"[检测] URL 匹配模式 '{pattern}' -> {url_type.value}")
                    return url_type
        
        logger.warning(f"[警告] 无法识别的 URL 类型: {url}")
        return FeishuUrlType.UNKNOWN
    
    @classmethod
    def get_recommended_tool(cls, url: str) -> Optional[str]:
        """
        获取推荐的工具名称
        
        Args:
            url: 飞书文档 URL
            
        Returns:
            工具名称（feishu-doc/feishu-sheet/feishu-bitable）或 None
        """
        url_type = cls.detect_url_type(url)
        tool = cls.TOOL_MAPPING.get(url_type)
        
        if tool:
            logger.info(f"[推荐] 使用工具 '{tool}' 处理 {url_type.value} 类型")
        else:
            logger.error(f"[错误] 无法为 URL 推荐工具: {url}")
        
        return tool
    
    @classmethod
    def validate_tool_match(cls, url: str, selected_tool: str) -> Tuple[bool, str]:
        """
        验证选中的工具是否匹配 URL 类型
        
        Args:
            url: 飞书文档 URL
            selected_tool: 用户选中的工具
            
        Returns:
            (是否匹配, 建议信息)
            
        示例:
            >>> validate_tool_match("https://xxx.feishu.cn/base/xxx", "feishu-doc")
            (False, "建议使用 feishu-bitable 工具处理多维表格")
        """
        url_type = cls.detect_url_type(url)
        correct_tool = cls.TOOL_MAPPING.get(url_type)
        
        if correct_tool is None:
            return False, f"无法识别的 URL 类型，请检查 URL 是否正确"
        
        if selected_tool == correct_tool:
            return True, f"工具选择正确 ({selected_tool})"
        
        return False, f"工具不匹配！当前选择 '{selected_tool}'，建议使用 '{correct_tool}' 处理 {url_type.value} 类型"
    
    @classmethod
    def auto_redirect(cls, url: str, selected_tool: str) -> Dict:
        """
        自动重定向到正确的工具
        
        Args:
            url: 飞书文档 URL
            selected_tool: 用户最初选中的工具
            
        Returns:
            包含检测结果和建议的字典
        """
        url_type = cls.detect_url_type(url)
        correct_tool = cls.TOOL_MAPPING.get(url_type)
        
        result = {
            "url": url,
            "detected_type": url_type.value,
            "selected_tool": selected_tool,
            "recommended_tool": correct_tool,
            "is_correct": selected_tool == correct_tool,
            "should_redirect": selected_tool != correct_tool and correct_tool is not None,
        }
        
        if result["should_redirect"]:
            result["action"] = f"自动重定向到 {correct_tool}"
            logger.info(f"[重定向] {selected_tool} -> {correct_tool}")
        elif result["is_correct"]:
            result["action"] = "工具选择正确，继续执行"
        else:
            result["action"] = "无法确定正确工具，需要人工检查"
        
        return result


# 测试用例
if __name__ == "__main__":
    print("=" * 70)
    print("Feishu URL Type Detector & Tool Selector - 测试")
    print("=" * 70)
    
    test_urls = [
        # 文档类型
        ("https://xxx.feishu.cn/docs/abc123", "feishu-doc"),
        ("https://xxx.feishu.cn/wiki/xyz789", "feishu-doc"),
        ("https://xxx.feishu.cn/docx/DocxABC", "feishu-sheet"),  # 故意选错工具
        
        # 表格类型
        ("https://xxx.feishu.cn/sheets/Sheet123", "feishu-sheet"),
        
        # 多维表格类型
        ("https://xxx.feishu.cn/base/BaseABC", "feishu-doc"),  # 故意选错工具
        ("https://xxx.feishu.cn/bitable/TableXYZ", "feishu-bitable"),
        
        # 未知类型
        ("https://example.com/other", "feishu-doc"),
    ]
    
    for url, selected_tool in test_urls:
        print(f"\n[测试] URL: {url}")
        print(f"[测试] 选中工具: {selected_tool}")
        
        # 检测 URL 类型
        url_type = FeishuToolSelector.detect_url_type(url)
        print(f"[结果] 检测类型: {url_type.value}")
        
        # 验证工具匹配
        is_match, message = FeishuToolSelector.validate_tool_match(url, selected_tool)
        print(f"[结果] 是否匹配: {is_match}")
        print(f"[结果] {message}")
        
        # 自动重定向
        result = FeishuToolSelector.auto_redirect(url, selected_tool)
        if result["should_redirect"]:
            print(f"[动作] 🔀 {result['action']}")
        elif result["is_correct"]:
            print(f"[动作] ✅ {result['action']}")
        else:
            print(f"[动作] ⚠️ {result['action']}")
        
        print("-" * 70)
    
    print("\n" + "=" * 70)
    print("测试完成")
    print("=" * 70)
