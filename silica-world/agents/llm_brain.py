"""
Silica World - Async LLM Brain
异步LLM大脑 - 慢世界架构
- 10次常规思考 + 5次紧急思考/小时
- 异步调用，不阻塞世界
- 战略缓存30tick有效期
"""

import asyncio
import json
import time
import urllib.request
import urllib.error
from typing import Optional, Dict, Tuple
from dataclasses import dataclass


@dataclass
class Strategy:
    """战略决策"""
    intent: str           # EXPLORE / HUNT / ESCAPE / REST
    target_id: Optional[str]
    expected_success_rate: float
    reasoning: str
    speed_multiplier: float
    timestamp: float


class AsyncLLMBrain:
    """
    异步LLM大脑
    预算：15次/小时（10常规 + 5紧急）
    """
    
    def __init__(self, agent):
        self.agent = agent
        self.total_budget = 15
        self.regular_budget = 10
        self.emergency_budget = 5
        
        self.calls_used = 0
        self.hour_start = time.time()
        
        self.pending_task = None
        self.current_strategy = None
        self.strategy_expires_at = 0
        self.last_think_time = 0
        
        self.api_key = self._load_api_key()
        self.strategy_history = []
    
    def _load_api_key(self) -> str:
        """加载API Key"""
        try:
            # 首先尝试从环境变量获取
            import os
            api_key = os.environ.get('KIMI_API_KEY', '')
            if api_key:
                print(f"[Brain] 从环境变量加载API Key: {api_key[:10]}...")
                return api_key
            
            # 然后从配置文件获取
            with open('/home/bruce/.openclaw/agents/main/agent/auth-profiles.json') as f:
                config = json.load(f)
                # 新的配置文件结构
                if 'profiles' in config:
                    profile = config['profiles'].get("moonshot:default")  # 使用moonshot
                    if profile and profile.get('type') == 'api_key':
                        api_key = profile.get('key', '')
                        if api_key:
                            print(f"[Brain] 从moonshot配置加载API Key: {api_key[:10]}...")
                            return api_key
                
                # 旧配置结构兼容
                api_key = config.get("kimi-coding:default", {}).get("key", "")
                if api_key:
                    print(f"[Brain] 从旧配置加载API Key: {api_key[:10]}...")
                    return api_key
        except Exception as e:
            print(f"[Brain] 加载API Key失败: {e}")
        
        print("[Brain] ⚠️ 未找到API Key，将使用默认策略")
        return ""
    
    def think(self, world, trigger_event=None) -> Tuple[Optional[Strategy], str]:
        """
        思考入口
        返回: (strategy, status)
        """
        now = time.time()
        
        # 重置小时计数器
        if now - self.hour_start > 3600:
            self.calls_used = 0
            self.hour_start = now
            print(f"[Brain] {self.agent.name} 思考预算已重置")
        
        # 预算耗尽
        if self.calls_used >= self.total_budget:
            return self._get_default_strategy(), "budget_exhausted"
        
        # 检查是否正在思考
        if self.pending_task and not self.pending_task.done():
            return self.current_strategy, "thinking"
        
        # 检查是否有结果返回
        if self.pending_task and self.pending_task.done():
            try:
                strategy = self.pending_task.result()
                self.current_strategy = strategy
                self.strategy_expires_at = world.time + 30
                self.calls_used += 1
                self.last_think_time = now
                self.pending_task = None
                
                # 记录历史
                self.strategy_history.append({
                    "time": world.time,
                    "strategy": strategy,
                    "trigger": trigger_event
                })
                
                # 记录到记忆
                self.agent.mind.add_episodic_memory(
                    f"深度思考 #{self.calls_used}: 选择{strategy.intent}策略 - {strategy.reasoning[:40]}",
                    importance=0.9
                )
                
                print(f"[Brain] {self.agent.name} 完成思考 #{self.calls_used}: {strategy.intent}")
                return strategy, "new_strategy"
            except Exception as e:
                print(f"[Brain] 思考失败: {e}")
                self.pending_task = None
                return self._get_default_strategy(), "error"
        
        # 判断是否需要思考
        should_think, is_emergency = self._should_think(trigger_event, world, now)
        
        if not should_think:
            if world.time > self.strategy_expires_at:
                return self._get_default_strategy(), "expired"
            return self.current_strategy, "cached"
        
        # 紧急调用检查
        if is_emergency and self.calls_used >= self.regular_budget:
            if self.calls_used >= self.total_budget:
                return self._get_default_strategy(), "emergency_exhausted"
            print(f"[Brain] 🔥 {self.agent.name} 触发紧急思考！({self.calls_used+1}/15)")
        
        # 提交异步思考
        try:
            # 尝试获取当前事件循环
            loop = asyncio.get_running_loop()
            self.pending_task = loop.create_task(
                self._call_llm_async(world)
            )
            return self.current_strategy, "submitted"
        except RuntimeError:
            # 没有事件循环，使用同步调用
            print(f"[Brain] {self.agent.name} 同步思考中...")
            strategy = self._sync_call_llm(self._build_prompt(self._build_context(world)))
            self.current_strategy = strategy
            self.strategy_expires_at = world.time + 30
            self.calls_used += 1
            self.last_think_time = time.time()
            
            # 记录到记忆
            self.agent.mind.add_episodic_memory(
                f"深度思考 #{self.calls_used}: 选择{strategy.intent}策略 - {strategy.reasoning[:40]}",
                importance=0.9
            )
            
            print(f"[Brain] {self.agent.name} 完成思考 #{self.calls_used}: {strategy.intent}")
            return strategy, "sync_think"
    
    def _should_think(self, trigger_event, world, now) -> Tuple[bool, bool]:
        """判断是否需要思考"""
        
        # 紧急触发
        emergency_triggers = ["energy_below_20", "being_hunted", "hunt_failed", "trapped"]
        if trigger_event in emergency_triggers:
            return True, True
        
        # 常规触发
        if trigger_event in ["new_prey", "collision", "strategy_expired"]:
            if now - self.last_think_time < 60:  # 60秒冷却
                return False, False
            return True, False
        
        # 保底触发
        if world.time > self.strategy_expires_at and now - self.last_think_time > 120:
            return True, False
        
        return False, False
    
    async def _call_llm_async(self, world) -> Strategy:
        """异步调用Kimi - 使用asyncio线程池"""
        context = self._build_context(world)
        prompt = self._build_prompt(context)
        
        # 在线程池中执行同步HTTP请求
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._sync_call_llm, prompt
        )
    
    def _sync_call_llm(self, prompt: str) -> Strategy:
        """同步调用LLM API - 使用OpenClaw内置机制"""
        # 如果没有API Key，直接返回默认策略
        if not self.api_key:
            print("[Brain] 无API Key，使用默认策略")
            return self._get_default_strategy()
        
        try:
            # 使用OpenClaw的sessions_spawn调用Kimi
            import subprocess
            import tempfile
            import os
            
            # 创建临时文件存储prompt
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(prompt)
                prompt_file = f.name
            
            # 调用OpenClaw的Kimi
            result = subprocess.run(
                ['openclaw', 'sessions', 'spawn', '--agent', 'main', '--model', 'kimi-coding/k2p5',
                 '--task', f'请基于以下信息做出战略决策，回复JSON格式: {prompt}'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # 清理临时文件
            os.unlink(prompt_file)
            
            if result.returncode == 0:
                # 解析结果
                output = result.stdout
                # 尝试从输出中提取JSON
                return self._parse_response(output)
            else:
                print(f"[Brain] OpenClaw调用失败: {result.stderr}")
                return self._get_default_strategy()
                
        except Exception as e:
            print(f"[Brain] 调用失败: {e}")
            return self._get_default_strategy()
    
    def _build_context(self, world) -> Dict:
        """构建上下文"""
        body = self.agent.body
        mind = self.agent.mind
        
        visible = self.agent.perceive(world)
        prey_list = [v for v in visible if v.get("type") == "prey"]
        threat_list = [v for v in visible if v.get("type") == "predator"]
        
        return {
            "role": mind.role,
            "name": self.agent.name,
            "energy": round(body.energy, 1),
            "energy_status": "critical" if body.energy < 20 else "low" if body.energy < 50 else "normal",
            "position": {"x": round(body.position.x, 1), "y": round(body.position.y, 1)},
            "velocity": {"x": round(body.velocity.x, 2), "y": round(body.velocity.y, 2)},
            "prey_count": len(prey_list),
            "prey_nearest": min([p["distance"] for p in prey_list]) if prey_list else None,
            "threat_count": len(threat_list),
            "threat_nearest": min([t["distance"] for t in threat_list]) if threat_list else None,
            "remaining_calls": self.total_budget - self.calls_used,
            "calls_used": self.calls_used,
            "recent_memories": [m.content for m in mind.l1_episodic[-3:]],
        }
    
    def _build_prompt(self, context: Dict) -> str:
        """构建prompt"""
        role_name = "大鱼（捕食者）" if context['role'] == 'predator' else '小鱼（猎物）'
        
        # 计算饥饿程度
        energy = context['energy']
        if context['role'] == 'predator':
            if energy > 70:
                hunger = "饱腹（不需要进食）"
            elif energy > 40:
                hunger = "有点饿（可以进食）"
            else:
                hunger = "饥饿（需要进食）"
        else:  # prey
            if energy > 60:
                hunger = "能量充足"
            elif energy > 30:
                hunger = "能量中等"
            else:
                hunger = "能量不足（需要吃水藻）"
        
        return f"""【角色信息】
名称: {context['name']}
角色: {role_name}
能量: {context['energy']}/100 ({context['energy_status']})
饥饿状态: {hunger}
位置: ({context['position']['x']}, {context['position']['y']})
当前速度: {((context['velocity']['x']**2 + context['velocity']['y']**2)**0.5):.1f} m/min
剩余思考次数: {context['remaining_calls']}/15（已用{context['calls_used']}次）

【当前局势】
视野内猎物: {context['prey_count']}个
最近猎物距离: {context['prey_nearest'] if context['prey_nearest'] else '无'}
视野内威胁: {context['threat_count']}个  
最近威胁距离: {context['threat_nearest'] if context['threat_nearest'] else '无'}

【最近记忆】
{chr(10).join(['- ' + m[:60] for m in context['recent_memories']])}

【决策要求】
1. 选择意图: EXPLORE(探索) / HUNT(捕猎) / ESCAPE(逃跑) / REST(休息)
   - HUNT只在饥饿状态需要进食时选择
   - REST在能量低或不需要移动时选择
   - EXPLORE用于寻找食物或探索环境
   - ESCAPE只在有威胁时选择
2. 如果HUNT，预期成功率是多少(0-1)
3. 解释你的推理（为什么选这个策略，考虑能量和饥饿状态）
4. 建议速度倍率(0.3-1.0，考虑能量消耗)

请以JSON格式回复:
{{
    "intent": "HUNT",
    "expected_success_rate": 0.7,
    "reasoning": "能量60，有点饿，发现猎物距离15米，选择伏击策略",
    "speed_multiplier": 0.8
}}"""
    
    def _parse_response(self, content: str) -> Strategy:
        """解析响应"""
        try:
            # 提取JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            data = json.loads(content.strip())
            
            return Strategy(
                intent=data.get("intent", "EXPLORE"),
                target_id=data.get("target_id"),
                expected_success_rate=data.get("expected_success_rate", 0.5),
                reasoning=data.get("reasoning", "使用默认策略"),
                speed_multiplier=data.get("speed_multiplier", 0.6),
                timestamp=time.time()
            )
        except Exception as e:
            print(f"[Brain] 解析失败: {e}")
            return self._get_default_strategy()
    
    def _get_default_strategy(self) -> Strategy:
        """默认策略"""
        return Strategy(
            intent="EXPLORE",
            target_id=None,
            expected_success_rate=0.5,
            reasoning="使用默认探索策略（无LLM指导）",
            speed_multiplier=0.5,
            timestamp=time.time()
        )
    
    def to_dict(self) -> Dict:
        """导出状态"""
        return {
            "calls_used": self.calls_used,
            "remaining": self.total_budget - self.calls_used,
            "current_intent": self.current_strategy.intent if self.current_strategy else None,
            "thinking": self.pending_task is not None and not self.pending_task.done(),
            "strategy_expires_at": self.strategy_expires_at
        }
