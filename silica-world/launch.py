#!/usr/bin/env python3
"""
Silica World - 启动器
在后台持续运行Web服务器
"""

import sys
import os
import signal

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from web.simple_server import run_server

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║                    🌊 Silica World                           ║
║              硅基虚拟世界 - MVP 版本                          ║
╠══════════════════════════════════════════════════════════════╣
║  物理公平性 · 准实时制 · 涌现行为 · 5层记忆架构              ║
╠══════════════════════════════════════════════════════════════╣
║  Web界面: http://localhost:{args.port:<5}                     ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    print("📋 使用说明:")
    print("   1. 访问 http://localhost:8080")
    print("   2. 点击 '🐟 初始化鱼缸' 创建角色")
    print("   3. 点击 '▶ 启动世界' 开始运行")
    print("   4. 点击角色卡片可以发送命令\n")
    
    run_server(args.port)
