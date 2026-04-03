"""
Silica World - Core Physics Engine
物理上可信的硅基虚拟世界核心
"""

import math
import time
import uuid
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Callable
from enum import Enum
import json


class Vector2D:
    """2D向量，用于位置和速度"""
    def __init__(self, x: float = 0, y: float = 0):
        self.x = float(x)
        self.y = float(y)
    
    def __add__(self, other):
        return Vector2D(self.x + other.x, self.y + other.y)
    
    def __sub__(self, other):
        return Vector2D(self.x - other.x, self.y - other.y)
    
    def __mul__(self, scalar: float):
        return Vector2D(self.x * scalar, self.y * scalar)
    
    def magnitude(self) -> float:
        return math.sqrt(self.x**2 + self.y**2)
    
    def normalize(self):
        mag = self.magnitude()
        if mag > 0:
            return Vector2D(self.x / mag, self.y / mag)
        return Vector2D(0, 0)
    
    def distance_to(self, other) -> float:
        return (self - other).magnitude()
    
    def to_dict(self):
        return {"x": round(self.x, 2), "y": round(self.y, 2)}
    
    def __repr__(self):
        return f"({self.x:.2f}, {self.y:.2f})"


@dataclass
class Food:
    """食物（水藻）- 静态资源"""
    id: str
    position: Vector2D
    energy_value: float = 20.0  # 食用后提供的能量
    radius: float = 0.8
    alive: bool = True
    spawn_time: float = 0.0  # 生成时间
    
    def to_dict(self):
        return {
            "id": self.id,
            "position": self.position.to_dict(),
            "energy_value": self.energy_value,
            "radius": self.radius,
            "alive": self.alive,
            "type": "food"
        }


@dataclass
class PhysicsBody:
    """物理实体 - 所有世界对象的基础"""
    id: str
    position: Vector2D
    velocity: Vector2D
    mass: float = 1.0
    radius: float = 1.0
    
    # 状态
    energy: float = 100.0  # 体力/能量
    max_energy: float = 100.0
    alive: bool = True
    role: str = "prey"  # "predator" 或 "prey"
    
    # 物理常量
    max_speed: float = 5.0  # m/min (换算后)
    energy_cost_per_move: float = 0.2  # 每米消耗（增加消耗）
    base_energy_cost: float = 0.15  # 每分钟基础消耗（增加生存成本）
    
    # 碰撞记录
    last_collision_time: float = -999.0  # 上次碰撞时间
    last_eat_time: float = 0.0  # 上次进食时间
    
    def __post_init__(self):
        """初始化后的额外设置"""
        if not hasattr(self, 'last_collision_time'):
            self.last_collision_time = -999.0
    
    def update_position(self, dt: float):
        """更新位置，dt单位：分钟"""
        if not self.alive:
            return
        
        # 限制最大速度
        speed = self.velocity.magnitude()
        if speed > self.max_speed:
            self.velocity = self.velocity.normalize() * self.max_speed
        
        # 计算移动距离
        move_distance = speed * dt
        
        # 能量消耗与速度相关：速度越快，单位距离消耗越多
        # 公式：消耗 = 距离 × 基础消耗 × 质量 × (速度/最大速度)^2
        speed_factor = (speed / self.max_speed) ** 2 if self.max_speed > 0 else 0
        energy_needed = move_distance * self.energy_cost_per_move * self.mass * (1 + speed_factor)
        
        if self.energy >= energy_needed:
            self.position = self.position + self.velocity * dt
            self.energy -= energy_needed
        else:
            # 能量不足，只能移动一部分然后停止
            partial_dt = self.energy / (self.energy_cost_per_move * self.mass * (1 + speed_factor) * speed) if speed > 0 else 0
            self.position = self.position + self.velocity * partial_dt
            self.energy = 0
            self.velocity = Vector2D(0, 0)  # 耗尽能量，停止
        
        # 基础能量消耗（生存成本）- 与速度无关的固定消耗
        base_cost = self.base_energy_cost * dt * self.mass
        self.energy -= base_cost
        
        # 检查是否死亡（能量耗尽）
        if self.energy <= 0:
            self.energy = 0
            self.alive = False
            self.velocity = Vector2D(0, 0)
    
    def recover_energy(self, dt: float):
        """恢复能量（休息状态）"""
        if not self.alive:
            return
        recovery_rate = 2.0  # 每分钟恢复2点
        self.energy = min(self.max_energy, self.energy + recovery_rate * dt)
    
    def eat(self, food_energy: float) -> float:
        """进食，返回实际获得的能量"""
        actual_energy = min(food_energy, self.max_energy - self.energy)
        self.energy += actual_energy
        self.last_eat_time = time.time()
        return actual_energy
    
    def to_dict(self):
        return {
            "id": self.id,
            "position": self.position.to_dict(),
            "velocity": self.velocity.to_dict(),
            "mass": self.mass,
            "radius": self.radius,
            "energy": round(self.energy, 1),
            "max_energy": self.max_energy,
            "alive": self.alive,
            "role": self.role,
            "speed": round(self.velocity.magnitude(), 2)
        }


class World:
    """虚拟世界 - 物理模拟的核心"""
    
    def __init__(self, width: float = 100.0, height: float = 100.0):
        self.width = width
        self.height = height
        self.bodies: Dict[str, PhysicsBody] = {}
        self.foods: Dict[str, Food] = {}  # 水藻/食物
        self.time = 0.0  # 虚拟时间（分钟）
        self.tick_count = 0
        
        # 食物生成配置
        self.food_spawn_interval = 10  # 每10个tick生成一次
        self.max_food_count = 20  # 最大水藻数量
        self.food_spawn_energy = 25  # 每个水藻的能量值
        
        # 事件日志
        self.events: List[dict] = []
        
        # 边界处理
        self.boundary_behavior = "bounce"  # bounce/wrap
    
    def add_body(self, body: PhysicsBody) -> str:
        """添加物理实体"""
        self.bodies[body.id] = body
        self.log_event("spawn", {"body_id": body.id, "position": body.position.to_dict(), "role": body.role})
        return body.id
    
    def remove_body(self, body_id: str):
        """移除物理实体"""
        if body_id in self.bodies:
            del self.bodies[body_id]
            self.log_event("despawn", {"body_id": body_id})
    
    def add_food(self, x: float = None, y: float = None, energy: float = None) -> str:
        """添加水藻（食物）"""
        if x is None:
            x = random.uniform(5, self.width - 5)
        if y is None:
            y = random.uniform(5, self.height - 5)
        if energy is None:
            energy = self.food_spawn_energy
        
        food_id = f"food_{uuid.uuid4().hex[:8]}"
        food = Food(
            id=food_id,
            position=Vector2D(x, y),
            energy_value=energy,
            spawn_time=self.time
        )
        self.foods[food_id] = food
        self.log_event("food_spawn", {"food_id": food_id, "position": food.position.to_dict(), "energy": energy})
        return food_id
    
    def remove_food(self, food_id: str):
        """移除水藻"""
        if food_id in self.foods:
            del self.foods[food_id]
    
    def _spawn_food(self):
        """随机生成水藻"""
        if len(self.foods) < self.max_food_count:
            # 在随机位置生成
            self.add_food()
    
    def _check_food_chain(self):
        """检查食物链交互（吃）"""
        bodies_to_remove = []  # 需要移除的尸体
        
        # 1. 检查角色吃水藻（小鱼）
        for body in list(self.bodies.values()):
            if not body.alive or body.role != "prey":
                continue
            
            for food in list(self.foods.values()):
                if not food.alive:
                    continue
                
                distance = body.position.distance_to(food.position)
                if distance < (body.radius + food.radius):
                    # 小鱼吃到水藻
                    energy_gained = body.eat(food.energy_value)
                    food.alive = False
                    self.remove_food(food.id)
                    self.log_event("eat_food", {
                        "agent_id": body.id,
                        "food_id": food.id,
                        "energy_gained": energy_gained,
                        "position": body.position.to_dict()
                    })
        
        # 2. 检查大鱼吃小鱼
        predators = [b for b in self.bodies.values() if b.alive and b.role == "predator"]
        preys = [b for b in self.bodies.values() if b.alive and b.role == "prey"]
        
        for predator in predators:
            for prey in preys:
                distance = predator.position.distance_to(prey.position)
                if distance < (predator.radius + prey.radius):
                    # 大鱼吃到小鱼
                    energy_gained = predator.eat(prey.energy * 0.8)  # 获得小鱼80%的能量
                    
                    # 标记小鱼死亡并从物理世界移除
                    prey.alive = False
                    prey.energy = 0
                    bodies_to_remove.append(prey.id)
                    
                    self.log_event("predation", {
                        "predator_id": predator.id,
                        "prey_id": prey.id,
                        "energy_gained": energy_gained,
                        "position": predator.position.to_dict()
                    })
        
        # 3. 移除所有死亡的尸体（避免大鱼围着尸体转）
        for body_id in bodies_to_remove:
            if body_id in self.bodies:
                del self.bodies[body_id]
                self.log_event("despawn", {"body_id": body_id, "reason": "eaten"})
    
    def step(self, dt: float = 1.0):
        """
        推进世界一个时间步
        dt: 虚拟时间增量（分钟）
        """
        self.time += dt
        self.tick_count += 1
        
        # 1. 更新所有实体位置
        for body in self.bodies.values():
            body.update_position(dt)
            self._apply_boundary(body)
        
        # 2. 碰撞检测与处理
        self._handle_collisions()
        
        # 3. 食物链交互（吃）
        self._check_food_chain()
        
        # 4. 生成新水藻
        if self.tick_count % self.food_spawn_interval == 0:
            self._spawn_food()
        
        # 5. 自然恢复（所有活着的实体缓慢恢复能量）
        for body in self.bodies.values():
            if body.velocity.magnitude() < 0.1:  # 几乎静止
                body.recover_energy(dt * 0.5)  # 恢复速度减半
    
    def _apply_boundary(self, body: PhysicsBody):
        """应用边界约束"""
        if self.boundary_behavior == "bounce":
            # 反弹
            if body.position.x < body.radius:
                body.position.x = body.radius
                body.velocity.x = abs(body.velocity.x)
            elif body.position.x > self.width - body.radius:
                body.position.x = self.width - body.radius
                body.velocity.x = -abs(body.velocity.x)
            
            if body.position.y < body.radius:
                body.position.y = body.radius
                body.velocity.y = abs(body.velocity.y)
            elif body.position.y > self.height - body.radius:
                body.position.y = self.height - body.radius
                body.velocity.y = -abs(body.velocity.y)
        
        elif self.boundary_behavior == "wrap":
            # 环绕
            body.position.x = body.position.x % self.width
            body.position.y = body.position.y % self.height
    
    def _handle_collisions(self):
        """处理碰撞 - 物理定律自然解决"""
        body_list = list(self.bodies.values())
        
        for i, body_a in enumerate(body_list):
            if not body_a.alive:
                continue
            
            for body_b in body_list[i+1:]:
                if not body_b.alive:
                    continue
                
                # 碰撞检测
                distance = body_a.position.distance_to(body_b.position)
                min_distance = body_a.radius + body_b.radius
                
                if distance < min_distance:
                    self._resolve_collision(body_a, body_b, distance, min_distance)
    
    def _resolve_collision(self, a: PhysicsBody, b: PhysicsBody, distance: float, min_distance: float):
        """
        碰撞响应 - 基于动量守恒
        """
        # 分离重叠
        overlap = min_distance - distance
        direction = (b.position - a.position).normalize()
        
        # 按质量比例分配分离
        total_mass = a.mass + b.mass
        a.position = a.position - direction * (overlap * b.mass / total_mass)
        b.position = b.position + direction * (overlap * a.mass / total_mass)
        
        # 动量守恒计算新速度
        relative_velocity = a.velocity - b.velocity
        velocity_along_normal = relative_velocity.x * direction.x + relative_velocity.y * direction.y
        
        if velocity_along_normal > 0:  # 已经分离，不处理
            return
        
        # 弹性碰撞（简化，假设完全弹性）
        restitution = 0.8  # 弹性系数
        impulse = -(1 + restitution) * velocity_along_normal / (1/a.mass + 1/b.mass)
        
        impulse_vector = direction * impulse
        a.velocity = a.velocity + impulse_vector * (1/a.mass)
        b.velocity = b.velocity - impulse_vector * (1/b.mass)
        
        # 能量损失（碰撞消耗）
        collision_energy_cost = 5.0
        a.energy = max(0, a.energy - collision_energy_cost)
        b.energy = max(0, b.energy - collision_energy_cost)
        
        # 记录碰撞时间
        a.last_collision_time = self.time
        b.last_collision_time = self.time
        
        # 记录事件
        self.log_event("collision", {
            "body_a": a.id,
            "body_b": b.id,
            "position": a.position.to_dict(),
            "energy_loss": collision_energy_cost
        })
    
    def log_event(self, event_type: str, data: dict):
        """记录世界事件"""
        self.events.append({
            "time": round(self.time, 2),
            "tick": self.tick_count,
            "type": event_type,
            "data": data
        })
        # 保持最近1000个事件
        if len(self.events) > 1000:
            self.events = self.events[-1000:]
    
    def get_state(self) -> dict:
        """获取世界当前状态"""
        return {
            "time": round(self.time, 2),
            "tick": self.tick_count,
            "width": self.width,
            "height": self.height,
            "bodies": {bid: body.to_dict() for bid, body in self.bodies.items()},
            "foods": {fid: food.to_dict() for fid, food in self.foods.items()},
            "food_count": len(self.foods),
            "recent_events": self.events[-10:]  # 最近10个事件
        }
    
    def get_body_by_id(self, body_id: str) -> Optional[PhysicsBody]:
        return self.bodies.get(body_id)


if __name__ == "__main__":
    # 简单测试
    world = World(100, 100)
    
    # 创建两个测试实体
    body1 = PhysicsBody(
        id="test1",
        position=Vector2D(30, 50),
        velocity=Vector2D(2, 0),
        mass=2.0,
        radius=3.0,
        role="predator"
    )
    
    body2 = PhysicsBody(
        id="test2", 
        position=Vector2D(70, 50),
        velocity=Vector2D(-2, 0),
        mass=1.0,
        radius=2.0,
        role="prey"
    )
    
    world.add_body(body1)
    world.add_body(body2)
    
    # 模拟10个tick
    for i in range(10):
        world.step(1.0)
        print(f"Tick {i+1}: {body1.position}, {body2.position}")
