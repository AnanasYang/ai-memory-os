#!/usr/bin/env python3
"""
Silica World - 启动脚本
硅基虚拟世界 MVP

使用方法:
    python3 run.py          # 启动Web界面
    python3 run.py --cli    # 命令行模式
"""

import sys
import os
import time
import argparse

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.manager import get_world_manager, reset_world_manager
from web.server import run_web_server


def cli_mode():
    """命令行交互模式"""
    print("🌊 Silica World - 硅基虚拟世界 (CLI模式)")
    print("=" * 50)
    
    manager = get_world_manager(width=100, height=100)
    
    # 初始化世界
    print("\n🏗️ 初始化鱼缸世界...")
    manager.add_agent("big-fish-1", "大鱼", "predator", x=30, y=50)
    manager.add_agent("small-fish-1", "小鱼", "prey", x=70, y=50)
    
    print("✅ 已创建角色：")
    print("  - 大鱼 (捕食者) 位置: (30, 50)")
    print("  - 小鱼 (猎物) 位置: (70, 50)")
    
    # 启动世界
    manager.start()
    print("\n▶️ 世界已启动！")
    print("\n可用命令:")
    print("  s - 查看状态")
    print("  p - 暂停/恢复")
    print("  c - 向角色发送命令")
    print("  o - 观察角色视角")
    print("  m - 查看记忆")
    print("  q - 退出")
    
    try:
        while True:
            cmd = input("\n> ").strip().lower()
            
            if cmd == 'q':
                print("👋 停止世界...")
                manager.stop()
                break
            
            elif cmd == 's':
                state = manager.get_current_state()
                print(f"\n📊 状态 - Tick: {state['tick']}, 虚拟时间: {state['virtual_time']}")
                for aid, agent in state['agents'].items():
                    body = agent['body']
                    status = "存活" if body['alive'] else "死亡"
                    print(f"  {agent['name']}: {status} | 能量:{body['energy']:.1f} | 位置:({body['position']['x']:.1f}, {body['position']['y']:.1f})")
            
            elif cmd == 'p':
                if manager.paused:
                    manager.resume()
                    print("▶️ 已恢复")
                else:
                    manager.pause()
                    print("⏸ 已暂停")
            
            elif cmd == 'c':
                print("选择角色:")
                for i, aid in enumerate(manager.agents.keys(), 1):
                    print(f"  {i}. {manager.agents[aid].name}")
                
                choice = input("输入编号: ").strip()
                try:
                    agent_id = list(manager.agents.keys())[int(choice)-1]
                    command = input(f"向 {manager.agents[agent_id].name} 发送命令: ").strip()
                    manager.send_command(agent_id, command)
                    print(f"✅ 已发送: {command}")
                except (IndexError, ValueError):
                    print("❌ 无效选择")
            
            elif cmd == 'o':
                for aid in manager.agents.keys():
                    obs = manager.get_observation_for_agent(aid)
                    if obs:
                        print(f"\n👁️ {obs['agent_name']} 的视角:")
                        print(f"  位置: {obs['position']}")
                        print(f"  能量: {obs['energy']:.1f}")
                        print(f"  视野内: {len(obs['visible_objects'])} 个对象")
                        for obj in obs['visible_objects']:
                            print(f"    - {obj['id']} ({obj['type']}) 距离:{obj['distance']:.1f}")
            
            elif cmd == 'm':
                for aid, agent in manager.agents.items():
                    info = manager.get_agent_info(aid)
                    print(f"\n🧠 {agent.name} 的记忆:")
                    for mem in info.get('memories', []):
                        print(f"  [{mem['time']}] {mem['content']}")
            
            else:
                print("未知命令，可用: s, p, c, o, m, q")
    
    except KeyboardInterrupt:
        print("\n👋 停止世界...")
        manager.stop()


def main():
    parser = argparse.ArgumentParser(description='Silica World - 硅基虚拟世界')
    parser.add_argument('--cli', action='store_true', help='命令行模式')
    parser.add_argument('--port', type=int, default=8080, help='Web端口 (默认8080)')
    parser.add_argument('--host', default='0.0.0.0', help='主机地址 (默认0.0.0.0)')
    
    args = parser.parse_args()
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║                    🌊 Silica World                           ║
║              硅基虚拟世界 - MVP 版本                          ║
╠══════════════════════════════════════════════════════════════╣
║  物理公平性 · 准实时制 · 涌现行为 · 5层记忆架构              ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    if args.cli:
        cli_mode()
    else:
        print(f"\n🌐 启动Web界面...")
        print(f"   地址: http://localhost:{args.port}")
        print(f"   或:   http://127.0.0.1:{args.port}")
        print("\n📱 界面功能:")
        print("   - 实时世界地图观测")
        print("   - 角色状态监控")
        print("   - 事件日志")
        print("   - 角色控制（点击卡片后输入命令）")
        print("\n⚠️  注意: 世界需要点击'初始化鱼缸'或'启动世界'按钮开始运行\n")
        
        run_web_server(host=args.host, port=args.port)


if __name__ == '__main__':
    main()
