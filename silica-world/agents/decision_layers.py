"""
Silica World - 分层决策架构
L0反射层 + L1战术层 + L2战略层
"""

import asyncio
import json
import math
import os
import random
from dataclasses import dataclass
from enum import Enum, auto
from typing import Dict, List, Optional, Tuple


class IntentType(Enum):
    """意图类型 - L2战略层输出"""
    EXPLORE = auto()      # 探索
    HUNT = auto()         # 捕猎
    ESCAPE = auto()       # 逃跑
    REST = auto()         # 休息
    PATROL = auto()       # 巡逻


@dataclass
class Intent:
    """高层意图 - 由L2战略层生成"""
    type: IntentType
    target_id: Optional[str] = None
    target_position: Optional[Tuple[float, float]] = None
    priority: float = 1.0
    created_at: float = 0.0
    expires_at: float = 0.0
    reason: str = ""
    
    def is_expired(self, current_time: float) -> bool:
        return current_time > self.expires_at
    
    def to_dict(self):
        return {
            'type': self.type.name,
            'target_id': self.target_id,
            'target_position': self.target_position,
            'priority': self.priority,
            'expires_at': self.expires_at,
            'reason': self.reason
        }


@dataclass  
class Action:
    """低层动作 - L1战术层输出"""
    vx: float  # x方向速度
    vy: float  # y方向速度
    speed_multiplier: float = 1.0  # 速度倍率（0-1，用于节省能量）
    reason: str = ""
    
    def to_dict(self):
        return {
            'vx': round(self.vx, 2),
            'vy': round(self.vy, 2),
            'speed_multiplier': round(self.speed_multiplier, 2),
            'reason': self.reason
        }


class L0ReflexLayer:
    """
    L0反射层 - 纯物理规则，每tick执行
    职责：即时威胁响应、边界约束、物理限制
    """
    
    def __init__(self, agent):
        self.agent = agent
        self.threat_memory = {}  # 威胁记忆 {target_id: last_seen_time}
    
    def process(self, world) -> Optional[Action]:
        """
        处理反射级响应
        返回Action如果有反射动作，否则None让上层处理
        """
        body = self.agent.body
        perception = self.agent.mind.l0_state
        
        # 1. 边界反射 - 碰到边界立即转向
        margin = 5.0
        if body.position.x < margin:
            return Action(vx=abs(body.max_speed * 0.5), vy=0, reason="边界反射:左")
        if body.position.x > world.width - margin:
            return Action(vx=-abs(body.max_speed * 0.5), vy=0, reason="边界反射:右")
        if body.position.y < margin:
            return Action(vx=0, vy=abs(body.max_speed * 0.5), reason="边界反射:上")
        if body.position.y > world.height - margin:
            return Action(vx=0, vy=-abs(body.max_speed * 0.5), reason="边界反射:下")
        
        # 2. 能量危机 - 极低能量时强制休息
        if body.energy < 10:
            return Action(vx=0, vy=0, speed_multiplier=0, reason="能量危机:强制休息")
        
        # 3. 碰撞后反弹（简单的物理反射）
        if body.velocity.magnitude() < 0.1 and body.last_collision_time == world.time - 1:
            # 刚碰撞过且几乎静止，给一个随机方向推力
            angle = random.uniform(0, 2 * 3.14159)
            vx = body.max_speed * 0.3 * math.cos(angle)
            vy = body.max_speed * 0.3 * math.sin(angle)
            return Action(vx=vx, vy=vy, reason="碰撞反弹")
        
        return None  # 无反射动作，交给上层


class L1TacticalLayer:
    """
    L1战术层 - 规则驱动，每tick执行
    职责：将L2意图转化为具体动作、路径规划、即时战术
    """
    
    def __init__(self, agent):
        self.agent = agent
        self.last_target_check = 0
        self.current_target = None
    
    def execute(self, intent: Intent, world) -> Action:
        """
        根据L2意图执行战术动作
        """
        body = self.agent.body
        
        if intent.type == IntentType.HUNT:
            return self._tactical_hunt(intent, world)
        elif intent.type == IntentType.ESCAPE:
            return self._tactical_escape(intent, world)
        elif intent.type == IntentType.EXPLORE:
            return self._tactical_explore(intent, world)
        elif intent.type == IntentType.REST:
            return self._tactical_rest(intent, world)
        elif intent.type == IntentType.PATROL:
            return self._tactical_patrol(intent, world)
        
        # 默认行为：随机游动
        return self._default_behavior(world)
    
    def _tactical_hunt(self, intent: Intent, world) -> Action:
        """战术：追捕目标"""
        body = self.agent.body
        
        # 如果意图指定了目标ID，优先追踪
        if intent.target_id and intent.target_id in world.bodies:
            target = world.bodies[intent.target_id]
            return self._move_towards(target.position, speed_multiplier=0.9, reason=f"追捕:{intent.target_id}")
        
        # 否则在视野内寻找猎物
        visible_prey = self._get_visible_prey(world)
        if visible_prey:
            # 选择最近/能量最高的
            target = min(visible_prey, key=lambda p: body.position.distance_to(p.position))
            return self._move_towards(target.position, speed_multiplier=0.9, reason="追捕视野猎物")
        
        # 没有可见猎物，向意图目标位置移动或探索
        if intent.target_position:
            return self._move_towards(intent.target_position, speed_multiplier=0.7, reason="向猎物区域移动")
        
        return self._tactical_explore(intent, world)
    
    def _tactical_escape(self, intent: Intent, world) -> Action:
        """战术：逃离威胁"""
        body = self.agent.body
        
        # 识别威胁来源
        threat = None
        if intent.target_id and intent.target_id in world.bodies:
            threat = world.bodies[intent.target_id]
        else:
            # 在视野内找最近的捕食者
            threats = self._get_visible_threats(world)
            if threats:
                threat = min(threats, key=lambda t: body.position.distance_to(t.position))
        
        if threat:
            # 远离威胁的方向
            dx = body.position.x - threat.position.x
            dy = body.position.y - threat.position.y
            dist = (dx**2 + dy**2) ** 0.5
            if dist > 0:
                vx = (dx / dist) * body.max_speed
                vy = (dy / dist) * body.max_speed
                return Action(vx=vx, vy=vy, speed_multiplier=1.0, reason=f"逃离:{threat.id}")
        
        # 不知道威胁在哪，加速随机移动
        return self._tactical_explore(intent, world, speed_multiplier=1.0)
    
    def _tactical_explore(self, intent: Intent, world, speed_multiplier=0.6) -> Action:
        """战术：探索"""
        body = self.agent.body
        
        # 简单的随机探索，带一点惯性
        if random.random() < 0.1:  # 10%概率改变方向
            angle = random.uniform(0, 2 * 3.14159)
            vx = body.max_speed * math.cos(angle)
            vy = body.max_speed * math.sin(angle)
        else:
            # 保持当前方向
            vx = body.velocity.x
            vy = body.velocity.y
            if vx == 0 and vy == 0:
                angle = random.uniform(0, 2 * 3.14159)
                vx = body.max_speed * math.cos(angle)
                vy = body.max_speed * math.sin(angle)
        
        return Action(vx=vx, vy=vy, speed_multiplier=speed_multiplier, reason="探索")
    
    def _tactical_rest(self, intent: Intent, world) -> Action:
        """战术：休息恢复能量"""
        body = self.agent.body
        
        # 检查周围是否有威胁
        threats = self._get_visible_threats(world)
        if threats:
            # 有威胁，先逃跑！
            closest = min(threats, key=lambda t: body.position.distance_to(t.position))
            return self._move_away_from(closest.position, reason="休息时遇威胁")
        
        # 安全，休息
        return Action(vx=0, vy=0, speed_multiplier=0, reason="休息恢复")
    
    def _tactical_patrol(self, intent: Intent, world) -> Action:
        """战术：巡逻特定区域"""
        if intent.target_position:
            dist = self.agent.body.position.distance_to(intent.target_position)
            if dist > 10:
                return self._move_towards(intent.target_position, speed_multiplier=0.5, reason="巡逻移动")
        
        # 到达巡逻点或随机巡逻
        return self._tactical_explore(intent, world, speed_multiplier=0.5)
    
    def _default_behavior(self, world) -> Action:
        """默认行为：温和探索"""
        return self._tactical_explore(
            Intent(IntentType.EXPLORE), world, speed_multiplier=0.5
        )
    
    def _move_towards(self, target_pos, speed_multiplier=0.8, reason="") -> Action:
        """向目标移动"""
        body = self.agent.body
        dx = target_pos.x - body.position.x
        dy = target_pos.y - body.position.y
        dist = (dx**2 + dy**2) ** 0.5
        
        if dist > 0:
            vx = (dx / dist) * body.max_speed
            vy = (dy / dist) * body.max_speed
            return Action(vx=vx, vy=vy, speed_multiplier=speed_multiplier, reason=reason)
        
        return Action(vx=0, vy=0, reason=f"{reason}:已到达")
    
    def _move_away_from(self, threat_pos, reason="") -> Action:
        """远离威胁"""
        body = self.agent.body
        dx = body.position.x - threat_pos.x
        dy = body.position.y - threat_pos.y
        dist = (dx**2 + dy**2) ** 0.5
        
        if dist > 0:
            vx = (dx / dist) * body.max_speed
            vy = (dy / dist) * body.max_speed
            return Action(vx=vx, vy=vy, speed_multiplier=1.0, reason=reason)
        
        # 随机方向逃离
        angle = random.uniform(0, 2 * 3.14159)
        vx = body.max_speed * math.cos(angle)
        vy = body.max_speed * math.sin(angle)
        return Action(vx=vx, vy=vy, speed_multiplier=1.0, reason=f"{reason}:随机方向")
    
    def _get_visible_prey(self, world) -> List:
        """获取视野内的猎物"""
        body = self.agent.body
        prey_list = []
        
        for other in world.bodies.values():
            if other.id == body.id:
                continue
            if other.id.startswith('small') and body.id.startswith('big'):  # 大鱼看小鱼
                dist = body.position.distance_to(other.position)
                if dist <= self.agent.mind.perception_range:
                    prey_list.append(other)
        
        return prey_list
    
    def _get_visible_threats(self, world) -> List:
        """获取视野内的威胁"""
        body = self.agent.body
        threats = []
        
        for other in world.bodies.values():
            if other.id == body.id:
                continue
            if other.id.startswith('big') and body.id.startswith('small'):  # 小鱼看大鱼
                dist = body.position.distance_to(other.position)
                if dist <= self.agent.mind.perception_range:
                    threats.append(other)
        
        return threats


class L2StrategicLayer:
    """
    L2战略层 - AI驱动，异步执行
    职责：目标设定、长期规划、反思记忆
    频率：每30-60虚拟分钟，或事件触发
    """
    
    # 触发事件类型
    TRIGGERS = {
        'perception_change',  # 视野内出现新对象
        'goal_achieved',      # 完成目标
        'blocked',           # 长期无法移动
        'energy_critical',   # 能量危机
        'intent_expired',    # 意图过期
        'collision',         # 发生碰撞
        'target_lost',       # 丢失目标
    }
    
    def __init__(self, agent):
        self.agent = agent
        self.current_intent: Optional[Intent] = None
        self.is_thinking = False
        self.last_deliberation_time = -999
        self.deliberation_interval = 30  # 默认30虚拟分钟思考一次
        self.pending_intent: Optional[Intent] = None  # AI思考完成后更新
    
    def should_deliberate(self, world, event_type: str = None) -> bool:
        """判断是否需要触发AI思考"""
        current_time = world.time
        
        # 事件触发
        if event_type and event_type in self.TRIGGERS:
            return True
        
        # 意图过期
        if self.current_intent and self.current_intent.is_expired(current_time):
            return True
        
        # 定时触发（有一定随机性避免同步）
        time_since_last = current_time - self.last_deliberation_time
        if time_since_last >= self.deliberation_interval:
            # 添加随机抖动，避免所有角色同时思考
            jitter = random.uniform(0, 5)
            if time_since_last >= self.deliberation_interval + jitter:
                return True
        
        return False
    
    def get_intent(self, world) -> Optional[Intent]:
        """获取当前意图（可能过期）"""
        current_time = world.time
        
        # 检查是否有新的意图从异步思考完成
        if self.pending_intent:
            self.current_intent = self.pending_intent
            self.pending_intent = None
            self.last_deliberation_time = current_time
        
        # 如果当前意图过期，返回None触发默认行为
        if self.current_intent and self.current_intent.is_expired(current_time):
            # 意图过期但还没开始新思考
            if not self.is_thinking:
                return None
        
        return self.current_intent
    
    async def deliberate(self, world):
        """
        异步AI思考 - 生成高层意图
        这个方法应该在后台线程/协程中执行
        """
        if self.is_thinking:
            return  # 已经在思考了
        
        self.is_thinking = True
        
        try:
            # 构建思考上下文
            context = self._build_context(world)
            
            # 检查是否有API密钥
            import os
            api_key = os.environ.get('KIMI_API_KEY', '')
            
            if api_key and api_key.startswith('sk-'):
                # 有API密钥，使用Kimi
                print(f"[L2] {self.agent.name} 正在使用Kimi K2.5思考...")
                intent = await self._llm_deliberate(context, world)
                print(f"[L2] {self.agent.name} AI决策: {intent.type.name} - {intent.reason}")
            else:
                # 无API密钥，使用规则
                print(f"[L2] {self.agent.name} 使用规则决策 (无API密钥)")
                intent = self._rule_based_deliberate(context, world)
            
            # 存储到pending，下次get_intent时生效
            self.pending_intent = intent
            
            # 记录决策到记忆
            self.agent.mind.add_memory(
                f"战略决策: {intent.type.name} - {intent.reason}",
                importance=0.8
            )
            
        except Exception as e:
            print(f"[L2] 决策错误: {e}")
            # 回退到默认意图
            self.pending_intent = self._default_intent(world)
        finally:
            self.is_thinking = False
    
    def _build_context(self, world) -> Dict:
        """构建决策上下文"""
        body = self.agent.body
        mind = self.agent.mind
        
        # 获取感知信息
        perception = mind.l0_state
        visible_objects = []
        
        for other in world.bodies.values():
            if other.id == body.id:
                continue
            dist = body.position.distance_to(other.position)
            if dist <= mind.perception_range:
                obj_type = "predator" if other.id.startswith("big") else "prey"
                visible_objects.append({
                    'id': other.id,
                    'type': obj_type,
                    'distance': round(dist, 1),
                    'energy': round(other.energy, 1)
                })
        
        # 最近记忆
        recent_memories = [m.content for m in mind.l1_episodic[-5:]]
        
        return {
            'role': self.agent.mind.role,
            'identity': mind.l4_core.get('identity', ''),
            'position': (round(body.position.x, 1), round(body.position.y, 1)),
            'energy': round(body.energy, 1),
            'velocity': (round(body.velocity.x, 2), round(body.velocity.y, 2)),
            'visible_objects': visible_objects,
            'recent_memories': recent_memories,
            'current_intent': self.current_intent.to_dict() if self.current_intent else None,
            'world_time': world.time
        }
    
    def _rule_based_deliberate(self, context: Dict, world) -> Intent:
        """
        基于规则的决策模拟（无AI时）
        模拟简单的决策逻辑
        """
        role = context['role']
        energy = context['energy']
        visible = context['visible_objects']
        
        current_time = world.time
        
        # 捕食者（大鱼）逻辑
        if role == 'predator':
            # 找猎物
            prey = [o for o in visible if o['type'] == 'prey']
            if prey:
                # 有猎物，追捕
                target = min(prey, key=lambda p: p['distance'])
                return Intent(
                    type=IntentType.HUNT,
                    target_id=target['id'],
                    priority=1.0,
                    created_at=current_time,
                    expires_at=current_time + 20,
                    reason=f"发现猎物 {target['id']}，距离 {target['distance']}"
                )
            
            # 没有猎物，探索
            return Intent(
                type=IntentType.EXPLORE,
                priority=0.5,
                created_at=current_time,
                expires_at=current_time + 30,
                reason="视野内无猎物，探索寻找"
            )
        
        # 猎物（小鱼）逻辑
        else:
            # 检查威胁
            threats = [o for o in visible if o['type'] == 'predator']
            if threats:
                # 有威胁，逃跑
                closest = min(threats, key=lambda t: t['distance'])
                return Intent(
                    type=IntentType.ESCAPE,
                    target_id=closest['id'],
                    priority=1.0,
                    created_at=current_time,
                    expires_at=current_time + 10,  # 逃跑意图短有效期
                    reason=f"发现捕食者 {closest['id']}，距离 {closest['distance']}"
                )
            
            # 能量低，休息
            if energy < 30:
                return Intent(
                    type=IntentType.REST,
                    priority=0.8,
                    created_at=current_time,
                    expires_at=current_time + 15,
                    reason=f"能量较低 ({energy})，需要休息"
                )
            
            # 否则探索
            return Intent(
                type=IntentType.EXPLORE,
                priority=0.5,
                created_at=current_time,
                expires_at=current_time + 30,
                reason="安全状态，继续探索"
            )
    
    async def _llm_deliberate(self, context: Dict, world) -> Intent:
        """
        LLM驱动的决策 - 使用Kimi K2.5
        """
        import aiohttp
        import os
        
        # 构建prompt
        prompt = self._build_llm_prompt(context)
        
        # 准备API调用
        api_key = os.environ.get('KIMI_API_KEY', '')
        api_url = "https://api.moonshot.cn/v1/chat/completions"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        payload = {
            "model": "kimi-k2-5",
            "messages": [
                {"role": "system", "content": "你是一个硅基虚拟世界中的AI角色决策系统。基于当前状态决定下一步的战略意图。"},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 300,
            "response_format": {"type": "json_object"}
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(api_url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status == 200:
                        data = await response.json()
                        content = data['choices'][0]['message']['content']
                        
                        # 解析JSON响应
                        try:
                            result = json.loads(content)
                            return self._parse_llm_response(result, world)
                        except json.JSONDecodeError:
                            print(f"[L2] LLM响应解析失败: {content}")
                            return self._rule_based_deliberate(context, world)
                    else:
                        error_text = await response.text()
                        print(f"[L2] LLM API错误: {response.status} - {error_text}")
                        return self._rule_based_deliberate(context, world)
        except asyncio.TimeoutError:
            print("[L2] LLM调用超时，回退到规则")
            return self._rule_based_deliberate(context, world)
        except Exception as e:
            print(f"[L2] LLM调用异常: {e}")
            return self._rule_based_deliberate(context, world)
    
    def _build_llm_prompt(self, context: Dict) -> str:
        """构建LLM决策prompt"""
        role = context['role']
        identity = context['identity']
        energy = context['energy']
        position = context['position']
        visible = context['visible_objects']
        memories = context['recent_memories']
        current_intent = context['current_intent']
        
        visible_str = "\n".join([
            f"  - {obj['id']} ({obj['type']}) 距离{obj['distance']}m 能量{obj['energy']}"
            for obj in visible
        ]) if visible else "  (视野内无其他对象)"
        
        memories_str = "\n".join([f"  - {m}" for m in memories]) if memories else "  (无近期记忆)"
        
        current_str = ""
        if current_intent:
            current_str = f"\n当前意图: {current_intent.get('type')} - {current_intent.get('reason', '')}"
        
        prompt = f"""你是{identity}。

【当前状态】
- 角色类型: {'捕食者(大鱼)' if role == 'predator' else '猎物(小鱼)'}
- 当前位置: ({position[0]}, {position[1]})
- 当前能量: {energy}/100
- 视野内对象:
{visible_str}

【最近记忆】
{memories_str}{current_str}

【可选意图】
- EXPLORE: 探索未知区域
- HUNT: 追捕猎物 (仅捕食者)
- ESCAPE: 逃离威胁 (仅猎物)
- REST: 休息恢复能量
- PATROL: 巡逻特定区域

基于以上信息，你的下一个战略意图应该是什么？

请以JSON格式回复:
{{
    "intent": "意图类型",
    "target_id": "目标ID或null",
    "priority": 0.0-1.0,
    "reason": "简短理由(20字内)",
    "duration_minutes": 意图持续时间(10-60)
}}
"""
        return prompt
    
    def _parse_llm_response(self, result: Dict, world) -> Intent:
        """解析LLM响应为Intent"""
        intent_type_str = result.get('intent', 'EXPLORE').upper()
        target_id = result.get('target_id')
        priority = result.get('priority', 0.5)
        reason = result.get('reason', 'LLM决策')
        duration = result.get('duration_minutes', 30)
        
        # 转换intent类型
        try:
            intent_type = IntentType[intent_type_str]
        except KeyError:
            intent_type = IntentType.EXPLORE
        
        current_time = world.time
        
        return Intent(
            type=intent_type,
            target_id=target_id if target_id != "null" else None,
            priority=min(1.0, max(0.1, priority)),
            created_at=current_time,
            expires_at=current_time + duration,
            reason=f"[AI]{reason}"
        )
    
    def _default_intent(self, world) -> Intent:
        """默认意图"""
        return Intent(
            type=IntentType.EXPLORE,
            priority=0.3,
            created_at=world.time,
            expires_at=world.time + 20,
            reason="无明确意图，默认探索"
        )


class HierarchicalDecisionMaker:
    """
    分层决策协调器
    整合L0/L1/L2三层决策
    """
    
    def __init__(self, agent):
        self.agent = agent
        self.l0 = L0ReflexLayer(agent)
        self.l1 = L1TacticalLayer(agent)
        self.l2 = L2StrategicLayer(agent)
        self.last_action = None
    
    def decide(self, world) -> Action:
        """
        主决策入口 - 每tick调用
        返回具体的动作指令
        """
        # L0: 反射层检查（优先级最高）
        reflex_action = self.l0.process(world)
        if reflex_action:
            self.last_action = reflex_action
            return reflex_action
        
        # 检查是否需要L2战略思考
        if self.l2.should_deliberate(world):
            # 启动异步思考（不等待结果）
            try:
                loop = asyncio.get_running_loop()
                asyncio.create_task(self.l2.deliberate(world))
            except RuntimeError:
                # 没有运行中的event loop，使用同步方式
                import threading
                def run_deliberation():
                    try:
                        new_loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(new_loop)
                        new_loop.run_until_complete(self.l2.deliberate(world))
                        new_loop.close()
                    except Exception as e:
                        print(f"[L2] 思考线程错误: {e}")
                
                thread = threading.Thread(target=run_deliberation, daemon=True)
                thread.start()
        
        # 获取当前意图（可能来自之前的L2思考）
        intent = self.l2.get_intent(world)
        
        # L1: 战术层执行
        if intent:
            action = self.l1.execute(intent, world)
        else:
            # 无有效意图，默认行为
            action = self.l1._default_behavior(world)
        
        self.last_action = action
        return action
    
    def on_event(self, event_type: str, data: Dict, world):
        """
        事件处理器 - 响应世界事件
        """
        # 某些事件可能立即触发L2重新思考
        if self.l2.should_deliberate(world, event_type):
            asyncio.create_task(self.l2.deliberate(world))
        
        # 记录事件到记忆
        if event_type == 'collision':
            other_id = data.get('other_id', 'unknown')
            self.agent.mind.add_memory(
                f"事件: 与 {other_id} 发生碰撞",
                importance=0.7
            )


# 兼容旧代码的别名
DecisionLayers = HierarchicalDecisionMaker
