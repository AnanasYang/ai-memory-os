import threading
import time
import json
import asyncio
from typing import Dict, Optional, List
from datetime import datetime

from core.physics import World, Vector2D
from agents.agent import SilicaAgent


class SilicaWorldManager:
    """
    硅基世界管理器 - 异步LLM大脑版本
    """
    
    def __init__(self, width: float = 100, height: float = 100):
        # 物理世界
        self.world = World(width, height)
        
        # 角色管理
        self.agents: Dict[str, SilicaAgent] = {}
        
        # 运行状态
        self.running = False
        self.paused = False
        self.tick_rate = 0.333  # 约0.333 tick/s = 每3秒1tick
        self.time_scale = 1.0
        
        # 虚拟时间配置
        self.virtual_time_per_tick = 1.0  # 每个tick = 1分钟虚拟时间
        
        # 历史记录（用于回放和分析）
        self.history: List[dict] = []
        self.max_history = 1000  # 保留最近1000个状态
        
        # 统计
        self.stats = {
            "total_ticks": 0,
            "start_time": None,
            "collisions": 0,
            "agent_deaths": 0
        }
        
        # 线程
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
    
    def add_agent(self, agent_id: str, name: str, role: str, 
                  x: float = None, y: float = None) -> SilicaAgent:
        """添加角色"""
        if x is None:
            x = self.world.width * (0.3 if role == "predator" else 0.7)
        if y is None:
            y = self.world.height / 2
        
        agent = SilicaAgent(agent_id, name, role, x, y)
        
        with self._lock:
            self.agents[agent_id] = agent
            self.world.add_body(agent.body)
        
        print(f"[World] 添加角色: {name} ({role}) 位置({x:.1f}, {y:.1f})")
        return agent
    
    def remove_agent(self, agent_id: str):
        """移除角色"""
        with self._lock:
            if agent_id in self.agents:
                del self.agents[agent_id]
                self.world.remove_body(agent_id)
    
    def send_command(self, agent_id: str, command: str) -> dict:
        """向角色发送用户命令，返回执行结果"""
        with self._lock:
            if agent_id in self.agents:
                self.agents[agent_id].set_user_command(command)
                # 立即执行获取结果（在tick中执行）
                result = self.agents[agent_id].act(self.world, self.virtual_time_per_tick)
                # 记录到世界事件日志
                if result.get("executed") is not None:
                    self.world.log_event("user_command", {
                        "agent_id": agent_id,
                        "agent_name": result.get("agent_name", agent_id),
                        "command": command,
                        "executed": result.get("executed"),
                        "action": result.get("action"),
                        "response": result.get("response")
                    })
                return result
        return {"executed": False, "error": "Agent not found"}
    
    def toggle_user_control(self, agent_id: str, controlled: bool = True):
        """切换用户控制模式"""
        with self._lock:
            if agent_id in self.agents:
                self.agents[agent_id].user_controlled = controlled
                status = "接管" if controlled else "释放"
                print(f"[World] 角色 {self.agents[agent_id].name} 已被用户{status}")
    
    def start(self):
        """启动世界"""
        if self.running:
            return
        
        self.running = True
        self.paused = False
        self.stats["start_time"] = datetime.now().isoformat()
        
        # 启动异步事件循环
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_async_loop, daemon=True)
        self._thread.start()
        
        print(f"[World] 硅基世界已启动！Tick率: {self.tick_rate}/s (慢世界模式)")
        print(f"[World] 每tick = {self.virtual_time_per_tick}分钟虚拟时间")
    
    def _run_async_loop(self):
        """运行异步事件循环"""
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._async_run())
    
    async def _async_run(self):
        """异步主循环"""
        tick_interval = 1.0 / self.tick_rate
        
        while self.running:
            if self.paused:
                await asyncio.sleep(0.1)
                continue
            
            loop_start = time.time()
            
            # 执行一个tick（在事件循环中运行同步代码）
            await self._loop.run_in_executor(None, self._tick)
            
            # 控制tick速率
            elapsed = time.time() - loop_start
            sleep_time = tick_interval - elapsed
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
    
    def stop(self):
        """停止世界"""
        self.running = False
        if hasattr(self, '_loop'):
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread:
            self._thread.join(timeout=2)
        print("[World] 硅基世界已停止")
    
    def _tick(self):
        """执行一个tick"""
        with self._lock:
            # 1. 所有角色行动（收集执行结果）- 只处理还存在于物理世界的角色
            command_results = []
            agents_to_remove = []
            
            for agent_id, agent in list(self.agents.items()):
                # 检查角色是否还在物理世界中
                if agent.id not in self.world.bodies:
                    # 角色已从物理世界移除（被吃掉或其他原因）
                    agents_to_remove.append(agent_id)
                    continue
                
                if agent.body.alive:
                    result = agent.act(self.world, self.virtual_time_per_tick)
                    # 如果是用户命令，记录结果
                    if result.get("type") == "user_command" or result.get("executed") is not None:
                        command_results.append(result)
                else:
                    # 角色已死亡
                    agents_to_remove.append(agent_id)
            
            # 移除已死亡/被吃掉的角色
            for agent_id in agents_to_remove:
                if agent_id in self.agents:
                    agent = self.agents[agent_id]
                    self.stats["agent_deaths"] += 1
                    self.world.log_event("death", {"agent_id": agent.id, "name": agent.name, "reason": "eaten_or_starved"})
                    del self.agents[agent_id]
            
            # 记录用户命令执行结果到世界事件
            for result in command_results:
                self.world.log_event("user_command", {
                    "agent_id": result.get("agent_id"),
                    "agent_name": result.get("agent_name", result.get("agent_id")),
                    "executed": result.get("executed"),
                    "action": result.get("action"),
                    "response": result.get("response")
                })
            
            # 2. 物理世界推进
            self.world.step(self.virtual_time_per_tick)
            
            # 3. 检查是否有新死亡的角色（能量耗尽）
            dead_agents = []
            for agent_id, agent in list(self.agents.items()):
                if not agent.body.alive:
                    dead_agents.append(agent_id)
            
            # 从管理器中移除死亡的角色
            for agent_id in dead_agents:
                if agent_id in self.agents:
                    agent = self.agents[agent_id]
                    self.stats["agent_deaths"] += 1
                    self.world.log_event("death", {"agent_id": agent.id, "name": agent.name, "reason": "starved"})
                    del self.agents[agent_id]
            
            # 4. 统计
            self.stats["total_ticks"] += 1
            self.stats["collisions"] = len([e for e in self.world.events if e["type"] == "collision"])
            
            # 5. 记录历史（每5个tick记录一次，节省内存）
            if self.stats["total_ticks"] % 5 == 0:
                self._record_state()
    
    def _record_state(self):
        """记录当前状态到历史"""
        state = {
            "tick": self.stats["total_ticks"],
            "virtual_time": self.world.time,
            "real_time": time.time(),
            "agents": {aid: agent.to_dict() for aid, agent in self.agents.items()},
            "events": self.world.events[-5:]  # 最近5个事件
        }
        
        self.history.append(state)
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]
    
    def get_current_state(self) -> dict:
        """获取当前完整状态"""
        with self._lock:
            return {
                "running": self.running,
                "paused": self.paused,
                "tick": self.stats["total_ticks"],
                "virtual_time": round(self.world.time, 1),
                "world_size": {"width": self.world.width, "height": self.world.height},
                "agents": {aid: agent.to_dict() for aid, agent in self.agents.items()},
                "foods": {fid: food.to_dict() for fid, food in self.world.foods.items()},
                "food_count": len(self.world.foods),
                "events": self.world.events[-20:],  # 最近20个事件
                "stats": self.stats
            }
    
    def get_agent_info(self, agent_id: str) -> Optional[dict]:
        """获取角色详细信息"""
        with self._lock:
            if agent_id in self.agents:
                agent = self.agents[agent_id]
                return {
                    **agent.to_dict(),
                    "memories": [m.to_dict() for m in agent.mind.l1_episodic[-10:]]  # 最近10条记忆
                }
        return None
    
    def get_observation_for_agent(self, agent_id: str) -> Optional[dict]:
        """获取某个角色的观测视角（用于展示）"""
        with self._lock:
            if agent_id not in self.agents:
                return None
            
            agent = self.agents[agent_id]
            visible = agent.perceive(self.world)
            
            return {
                "agent_id": agent_id,
                "agent_name": agent.name,
                "position": agent.body.position.to_dict(),
                "energy": agent.body.energy,
                "visible_objects": visible,
                "recent_memories": [m.content for m in agent.mind.l1_episodic[-3:]],
                "current_intent": agent.mind.current_intent
            }
    
    def reset(self):
        """重置世界"""
        self.stop()
        with self._lock:
            self.world = World(self.world.width, self.world.height)
            self.agents.clear()
            self.history.clear()
            self.stats = {
                "total_ticks": 0,
                "start_time": None,
                "collisions": 0,
                "agent_deaths": 0
            }
        print("[World] 世界已重置")


# 全局管理器实例（单例模式）
_world_manager: Optional[SilicaWorldManager] = None


def get_world_manager(width: float = 100, height: float = 100) -> SilicaWorldManager:
    """获取世界管理器实例"""
    global _world_manager
    if _world_manager is None:
        _world_manager = SilicaWorldManager(width, height)
    return _world_manager


def reset_world_manager():
    """重置世界管理器"""
    global _world_manager
    if _world_manager:
        _world_manager.stop()
    _world_manager = None
