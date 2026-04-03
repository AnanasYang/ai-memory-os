"""
Silica World - Agent System
硅基生命体 - 角色AI与记忆系统（LLM大脑版）
"""

import json
import time
import math
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import random

from core.physics import PhysicsBody, Vector2D
from agents.llm_brain import AsyncLLMBrain, Strategy


@dataclass
class Memory:
    """记忆单元"""
    timestamp: float  # 虚拟世界时间
    level: int  # L0-L4
    content: str
    importance: float = 1.0  # 0-1，用于记忆衰减
    
    def to_dict(self):
        return {
            "time": round(self.timestamp, 1),
            "level": self.level,
            "content": self.content[:100] + "..." if len(self.content) > 100 else self.content,
            "importance": round(self.importance, 2)
        }


class AgentMind:
    """
    角色心智 - 基于5层记忆架构 + 分层决策
    简化版：L0(状态), L1(情境), L2(习惯), L3(认知), L4(核心)
    """
    
    def __init__(self, agent_id: str, name: str, role: str):
        self.agent_id = agent_id
        self.name = name
        self.role = role  # "predator"(大鱼) 或 "prey"(小鱼)
        
        # 5层记忆
        self.l0_state: Dict[str, Any] = {}  # 当前状态
        self.l1_episodic: List[Memory] = []  # 情境记忆（最近事件）
        self.l2_procedural: Dict[str, Any] = {}  # 习惯/技能
        self.l3_semantic: Dict[str, Any] = {}  # 认知框架
        self.l4_core: Dict[str, Any] = {}  # 核心价值观
        
        # 感知配置
        self.perception_range = 40.0  # 视野半径
        
        # 初始化L4核心层
        self._init_core_identity()
        
        # 认知资源
        self.attention = 100.0
        self.max_attention = 100.0
        self.attention_recovery_rate = 5.0  # 每分钟恢复
        
        # LLM调用控制
        self.last_llm_call = 0
        self.llm_cooldown = 30  # 秒，控制token消耗
        self.llm_call_count = 0
        
        # 当前意图（由L2战略层生成）
        self.current_intent: Optional[Intent] = None
        self.current_action: Optional[Action] = None  # 当前执行的动作
        
        # 记忆添加的便捷方法别名
        self.add_memory = self.add_episodic_memory
    
    def _init_core_identity(self):
        """初始化核心价值观（L4）"""
        if self.role == "predator":
            self.l4_core = {
                "identity": "大鱼 - 鱼缸中的顶级掠食者",
                "values": ["生存", "力量", "领地控制"],
                "drives": ["捕食小鱼", "维持能量", "避免无谓消耗"],
                "fears": ["饥饿", "被困", "失去优势"]
            }
            self.l2_procedural = {
                "preferred_strategy": "伏击",
                "known_hiding_spots": [],
                "hunting_success_rate": 0.5
            }
        else:  # prey
            self.l4_core = {
                "identity": "小鱼 - 灵活的生存者",
                "values": ["生存", "敏捷", "警觉"],
                "drives": ["躲避捕食者", "寻找食物", "保存体力"],
                "fears": ["被吃掉", "体力耗尽", "无处可逃"]
            }
            self.l2_procedural = {
                "escape_patterns": ["突然转向", "躲入缝隙", "快速游动"],
                "known_safe_zones": [],
                "evasion_success_rate": 0.5
            }
    
    def update_l0_state(self, world_time: float, body: PhysicsBody, 
                       visible_objects: List[Dict], world_state: Dict):
        """更新状态层（每tick）"""
        self.l0_state = {
            "time": world_time,
            "position": body.position.to_dict(),
            "velocity": body.velocity.to_dict(),
            "energy": body.energy,
            "speed": body.velocity.magnitude(),
            "visible_objects": visible_objects,
            "world_time": world_time
        }
    
    def add_episodic_memory(self, event: str, importance: float = 1.0):
        """添加情境记忆（L1）"""
        memory = Memory(
            timestamp=self.l0_state.get("time", 0),
            level=1,
            content=event,
            importance=importance
        )
        self.l1_episodic.append(memory)
        # 保持最近50条记忆
        if len(self.l1_episodic) > 50:
            self.l1_episodic = sorted(self.l1_episodic, 
                                     key=lambda m: m.importance, 
                                     reverse=True)[:50]
    
    def decay_memories(self, dt: float):
        """记忆衰减"""
        # L1记忆随时间衰减重要性
        for memory in self.l1_episodic:
            memory.importance *= (0.99 ** dt)  # 指数衰减
        
        # 清理不重要记忆
        self.l1_episodic = [m for m in self.l1_episodic if m.importance > 0.1]
    
    def get_relevant_memories(self, context: str, limit: int = 5) -> List[Memory]:
        """获取相关记忆（简单关键词匹配）"""
        keywords = context.lower().split()
        scored_memories = []
        
        for memory in self.l1_episodic:
            score = memory.importance
            memory_text = memory.content.lower()
            for keyword in keywords:
                if keyword in memory_text:
                    score += 0.5
            scored_memories.append((score, memory))
        
        scored_memories.sort(reverse=True, key=lambda x: x[0])
        return [m for _, m in scored_memories[:limit]]
    
    def decide_action(self, world_time: float, available_time: float) -> Dict[str, Any]:
        """
        决策 - 基于记忆层选择行动
        简单版：不调用LLM，基于规则决策（控制token消耗）
        """
        # 恢复注意力
        self.attention = min(self.max_attention, 
                           self.attention + self.attention_recovery_rate * available_time)
        
        # 基于L0状态快速决策
        energy = self.l0_state.get("energy", 100)
        visible = self.l0_state.get("visible_objects", [])
        
        decision = {
            "type": "idle",
            "target": None,
            "duration": available_time,
            "reasoning": []
        }
        
        # L4核心驱动：生存优先
        if energy < 30:
            decision["type"] = "rest"
            decision["reasoning"].append("L4: 能量低，生存优先，需要休息")
            return decision
        
        # 检测威胁/机会
        threats = [obj for obj in visible if obj.get("type") == "predator" and obj.get("id") != self.agent_id]
        opportunities = [obj for obj in visible if obj.get("type") == "prey"]
        
        if self.role == "prey" and threats:
            # L2习惯：逃跑模式
            nearest_threat = min(threats, key=lambda t: t.get("distance", 999))
            decision["type"] = "escape"
            decision["target"] = nearest_threat
            decision["direction"] = self._calculate_escape_direction(nearest_threat)
            decision["reasoning"].append(f"L2: 发现威胁{nearest_threat['id']},启动逃跑模式")
            self.add_episodic_memory(f"被{nearest_threat['id']}威胁，开始逃跑", 0.8)
            
        elif self.role == "predator" and opportunities:
            # L2习惯：捕食模式
            nearest_prey = min(opportunities, key=lambda p: p.get("distance", 999))
            if nearest_prey.get("distance", 999) < 20:  # 捕食范围内
                decision["type"] = "hunt"
                decision["target"] = nearest_prey
                decision["reasoning"].append(f"L2: 发现猎物{nearest_prey['id']},启动伏击")
                self.add_episodic_memory(f"开始追击{nearest_prey['id']}", 0.7)
            else:
                decision["type"] = "approach"
                decision["target"] = nearest_prey
                decision["reasoning"].append(f"L3: 猎物较远，先接近")
        
        else:
            # 探索行为
            decision["type"] = "explore"
            decision["direction"] = self._random_exploration_direction()
            decision["reasoning"].append("L3: 无威胁/机会，探索环境")
        
        return decision
    
    def _calculate_escape_direction(self, threat: Dict) -> Vector2D:
        """计算逃跑方向（远离威胁）"""
        my_pos = Vector2D(**self.l0_state.get("position", {"x": 50, "y": 50}))
        threat_pos = Vector2D(**threat.get("position", {"x": 0, "y": 0}))
        
        # 远离威胁
        escape_dir = (my_pos - threat_pos).normalize()
        
        # 加入一些随机性（L2习惯的个体差异）
        random_angle = random.uniform(-0.5, 0.5)  # ±30度
        escape_dir = Vector2D(
            escape_dir.x * math.cos(random_angle) - escape_dir.y * math.sin(random_angle),
            escape_dir.x * math.sin(random_angle) + escape_dir.y * math.cos(random_angle)
        )
        
        return escape_dir
    
    def _random_exploration_direction(self) -> Vector2D:
        """随机探索方向"""
        angle = random.uniform(0, 2 * 3.14159)
        return Vector2D(math.cos(angle), math.sin(angle))
    
    def generate_llm_decision_prompt(self) -> str:
        """
        生成LLM决策prompt（在需要深度思考时使用）
        注意：这会消耗token，需要控制调用频率
        """
        # 检查冷却时间
        current_time = time.time()
        if current_time - self.last_llm_call < self.llm_cooldown:
            return None  # 冷却中，不生成prompt
        
        recent_memories = self.get_relevant_memories("威胁 捕食 逃跑", 3)
        memory_text = "\n".join([f"- {m.content}" for m in recent_memories])
        
        prompt = f"""你是{self.name}，一个{self.l4_core['identity']}。

【核心价值观】(L4)
{', '.join(self.l4_core['values'])}
驱动：{', '.join(self.l4_core['drives'])}

【当前状态】(L0)
位置：{self.l0_state.get('position')}
能量：{self.l0_state.get('energy', 0):.1f}/100
速度：{self.l0_state.get('speed', 0):.2f}
视野内：{len(self.l0_state.get('visible_objects', []))}个对象

【最近记忆】(L1)
{memory_text if memory_text else '无重要记忆'}

【行为习惯】(L2)
{json.dumps(self.l2_procedural, ensure_ascii=False, indent=2)}

基于以上信息，你的下一个行动应该是什么？
请以JSON格式回复：{{"action": "行动类型", "target": "目标ID或null", "reason": "简短理由"}}
行动类型可选：rest(休息), move(移动), hunt(捕食), escape(逃跑), explore(探索)
"""
        
        return prompt
    
    def to_dict(self) -> dict:
        """导出状态"""
        intent_str = None
        if self.current_intent:
            intent_str = f"{self.current_intent.type.name}: {self.current_intent.reason[:30]}..."
        
        return {
            "id": self.agent_id,
            "name": self.name,
            "role": self.role,
            "l0_state": self.l0_state,
            "l1_memory_count": len(self.l1_episodic),
            "l4_identity": self.l4_core.get("identity"),
            "current_intent": intent_str,
            "attention": round(self.attention, 1),
            "llm_calls": self.llm_call_count
        }


# 导入math用于随机方向计算
import math


class SilicaAgent:
    """
    硅基生命体 - 物理实体+心智的完整角色
    """
    
    def __init__(self, agent_id: str, name: str, role: str, 
                 x: float = 50, y: float = 50):
        self.id = agent_id
        self.name = name
        
        # 创建物理身体
        if role == "predator":
            self.body = PhysicsBody(
                id=agent_id,
                position=Vector2D(x, y),
                velocity=Vector2D(0, 0),
                mass=2.0,  # 大鱼质量大
                radius=3.0,  # 大鱼体积大
                max_speed=4.0,  # 大鱼速度慢
                energy=100,
                role="predator"
            )
        else:  # prey
            self.body = PhysicsBody(
                id=agent_id,
                position=Vector2D(x, y),
                velocity=Vector2D(0, 0),
                mass=1.0,  # 小鱼质量小
                radius=1.5,  # 小鱼体积小
                max_speed=6.0,  # 小鱼速度快
                energy=100,
                role="prey"
            )
        
        # 创建心智
        self.mind = AgentMind(agent_id, name, role)
        
        # 创建LLM大脑（异步）
        self.llm_brain = AsyncLLMBrain(self)
        
        # 用户控制状态
        self.user_controlled = False
        self.user_command = None
    
    def perceive(self, world) -> List[Dict]:
        """感知周围世界（视野范围）"""
        visible = []
        view_range = 30.0  # 视野半径
        
        for body_id, body in world.bodies.items():
            if body_id == self.id:
                continue
            
            distance = self.body.position.distance_to(body.position)
            if distance < view_range:
                # 判断类型（简单启发式：质量大的是捕食者）
                obj_type = "predator" if body.mass > 1.5 else "prey"
                
                visible.append({
                    "id": body_id,
                    "type": obj_type,
                    "distance": round(distance, 1),
                    "position": body.position.to_dict(),
                    "velocity": body.velocity.to_dict()
                })
        
        return visible
    
    def act(self, world, dt: float) -> dict:
        """执行行动 - LLM大脑驱动"""
        result = {"type": "ai_decision", "details": {}}
        
        # 1. 感知
        visible = self.perceive(world)
        self.mind.update_l0_state(world.time, self.body, visible, world.get_state())
        
        # 2. 检查用户控制
        if self.user_controlled and self.user_command:
            result = self._execute_user_command(self.user_command, dt)
            result["agent_id"] = self.id
            result["agent_name"] = self.name
            result["type"] = "user_command"
            self.user_command = None
            return result
        
        # 3. LLM大脑思考（异步，不阻塞）
        trigger = self._detect_trigger_event(world)
        strategy, status = self.llm_brain.think(world, trigger)
        
        # 4. 执行策略
        if strategy:
            self._execute_strategy(strategy, world, dt)
            self.mind.current_intent = type('obj', (object,), {
                'type': type('IntentType', (), {'name': strategy.intent})(),
                'reason': strategy.reasoning
            })()
        
        # 5. 记忆衰减
        self.mind.decay_memories(dt)
        
        return result
    
    def _detect_trigger_event(self, world) -> Optional[str]:
        """检测触发事件，用于决定是否调用LLM"""
        
        # 1. 能量危机（最高优先级）
        if self.body.energy < 20:
            return "energy_below_20"
        
        # 2. 检测威胁（小鱼专用）
        visible = self.mind.l0_state.get("visible_objects", [])
        threats = [v for v in visible if v.get("type") == "predator" and v.get("id") != self.id]
        if threats and self.mind.role == "prey":
            nearest = min(threats, key=lambda t: t.get("distance", 999))
            if nearest.get("distance", 999) < 20:  # 扩大检测范围
                return "being_hunted"
        
        # 3. 检测卡边界（小鱼容易卡边界）
        margin = 8.0
        if (self.body.position.x < margin or 
            self.body.position.x > world.width - margin or
            self.body.position.y < margin or 
            self.body.position.y > world.height - margin):
            # 检查是否已经在边界停留了一段时间
            recent_memories = [m for m in self.mind.l1_episodic if "边界" in m.content]
            if len(recent_memories) >= 2:
                return "trapped"
        
        # 4. 发现新猎物（大鱼专用）
        preys = [v for v in visible if v.get("type") == "prey" and v.get("id") != self.id]
        if preys and self.mind.role == "predator":
            return "new_prey"
        
        # 5. 能量中等偏低（提醒需要寻找食物）
        if self.body.energy < 50:
            return "energy_low"
        
        # 6. 战略过期
        if self.llm_brain.strategy_expires_at < world.time:
            return "strategy_expired"
        
        # 7. 长时间没有思考（保底）
        if self.llm_brain.last_think_time == 0:  # 从未思考过
            return "first_think"
        
        return None
    
    def _execute_strategy(self, strategy: Strategy, world, dt: float):
        """执行LLM生成的策略"""
        intent = strategy.intent
        speed = strategy.speed_multiplier * self.body.max_speed
        
        if intent == "REST":
            self.body.velocity = Vector2D(0, 0)
            self.body.recover_energy(dt)
            
        elif intent == "EXPLORE":
            # 随机探索方向
            if self.body.velocity.magnitude() < 0.1:
                angle = random.uniform(0, 2 * 3.14159)
                self.body.velocity = Vector2D(
                    speed * math.cos(angle),
                    speed * math.sin(angle)
                )
            else:
                # 保持当前方向
                self.body.velocity = self.body.velocity.normalize() * speed
                
        elif intent == "HUNT":
            # 寻找最近的猎物并追击
            visible = self.perceive(world)
            preys = [v for v in visible if v.get("type") == "prey"]
            if preys:
                target = min(preys, key=lambda p: p.get("distance", 999))
                target_pos = Vector2D(**target.get("position", {"x": 0, "y": 0}))
                direction = (target_pos - self.body.position).normalize()
                self.body.velocity = direction * speed
            else:
                # 没有猎物，转为探索
                self._execute_strategy(
                    Strategy("EXPLORE", None, 0.5, "没有猎物，转为探索", 0.5, 0),
                    world, dt
                )
                
        elif intent == "ESCAPE":
            # 远离最近的威胁，同时避免卡边界
            visible = self.perceive(world)
            threats = [v for v in visible if v.get("type") == "predator"]
            
            if threats:
                threat = min(threats, key=lambda t: t.get("distance", 999))
                threat_pos = Vector2D(**threat.get("position", {"x": 0, "y": 0}))
                
                # 逃离方向
                escape_dir = (self.body.position - threat_pos).normalize()
                
                # 如果靠近边界，调整方向
                margin = 10.0
                new_pos = self.body.position + escape_dir * speed * 2
                
                if new_pos.x < margin or new_pos.x > world.width - margin:
                    escape_dir.x *= -1  # 反转x方向
                if new_pos.y < margin or new_pos.y > world.height - margin:
                    escape_dir.y *= -1  # 反转y方向
                
                self.body.velocity = escape_dir.normalize() * speed
                
            else:
                # 没有威胁，但可能卡边界，向中心移动
                center = Vector2D(world.width / 2, world.height / 2)
                direction = (center - self.body.position).normalize()
                self.body.velocity = direction * speed
    
    def _execute_user_command(self, command: str, dt: float) -> dict:
        """执行用户命令（自然语言），返回执行结果"""
        command = command.lower().strip()
        result = {"executed": False, "action": "unknown", "response": ""}
        
        if "休息" in command or "rest" in command:
            self.body.velocity = Vector2D(0, 0)
            self.mind.add_episodic_memory(f"接受用户命令：休息", 0.9)
            result = {"executed": True, "action": "rest", "response": f"{self.name} 停止移动，开始休息恢复能量"}
        
        elif "向左" in command or "left" in command:
            self.body.velocity = Vector2D(-self.body.max_speed * 0.5, 0)
            self.mind.add_episodic_memory(f"接受用户命令：向左游", 0.9)
            result = {"executed": True, "action": "move_left", "response": f"{self.name} 开始向左游动"}
        
        elif "向右" in command or "right" in command:
            self.body.velocity = Vector2D(self.body.max_speed * 0.5, 0)
            self.mind.add_episodic_memory(f"接受用户命令：向右游", 0.9)
            result = {"executed": True, "action": "move_right", "response": f"{self.name} 开始向右游动"}
        
        elif "向上" in command or "up" in command:
            self.body.velocity = Vector2D(0, -self.body.max_speed * 0.5)
            self.mind.add_episodic_memory(f"接受用户命令：向上游", 0.9)
            result = {"executed": True, "action": "move_up", "response": f"{self.name} 开始向上游动"}
        
        elif "向下" in command or "down" in command:
            self.body.velocity = Vector2D(0, self.body.max_speed * 0.5)
            self.mind.add_episodic_memory(f"接受用户命令：向下游", 0.9)
            result = {"executed": True, "action": "move_down", "response": f"{self.name} 开始向下游动"}
        
        elif "快" in command or "fast" in command or "加速" in command:
            if self.body.velocity.magnitude() > 0:
                self.body.velocity = self.body.velocity.normalize() * self.body.max_speed
                self.mind.add_episodic_memory(f"接受用户命令：加速", 0.9)
                result = {"executed": True, "action": "speed_up", "response": f"{self.name} 加速到最大速度"}
            else:
                result = {"executed": False, "action": "speed_up", "response": f"{self.name} 需要先指定方向才能加速"}
        
        elif "慢" in command or "slow" in command or "减速" in command:
            self.body.velocity = self.body.velocity * 0.5
            self.mind.add_episodic_memory(f"接受用户命令：减速", 0.9)
            result = {"executed": True, "action": "slow_down", "response": f"{self.name} 减速到原来的一半"}
        
        else:
            self.mind.add_episodic_memory(f"收到无法理解的用户命令：{command}", 0.5)
            result = {"executed": False, "action": "unknown", "response": f"{self.name} 无法理解命令 '{command}'"}
        
        return result
    
    def set_user_command(self, command: str):
        """接收用户命令"""
        self.user_command = command
    
    def to_dict(self) -> dict:
        """完整状态导出"""
        # 处理意图（可能是动态对象或普通对象）
        intent_dict = None
        if self.mind.current_intent:
            if hasattr(self.mind.current_intent, 'to_dict'):
                intent_dict = self.mind.current_intent.to_dict()
            else:
                # 动态对象，手动提取属性
                intent_type = getattr(self.mind.current_intent.type, 'name', 'UNKNOWN') if hasattr(self.mind.current_intent, 'type') else 'UNKNOWN'
                intent_dict = {
                    'type': intent_type,
                    'reason': getattr(self.mind.current_intent, 'reason', '')
                }
        
        action_dict = None
        if self.mind.current_action:
            if hasattr(self.mind.current_action, 'to_dict'):
                action_dict = self.mind.current_action.to_dict()
            else:
                action_dict = {'reason': 'unknown'}
        
        return {
            "id": self.id,
            "name": self.name,
            "role": self.mind.role,
            "body": self.body.to_dict(),
            "mind": self.mind.to_dict(),
            "user_controlled": self.user_controlled,
            "intent": intent_dict,
            "action": action_dict,
            "llm_brain": self.llm_brain.to_dict()
        }
