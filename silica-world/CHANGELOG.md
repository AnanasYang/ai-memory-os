# Silica World - 修改记录

## 修改时间
2026-03-09 13:40

## 本次修复

### 1. 世界速度调整
- tick_rate: 0.2 → 每5秒1tick（原来每2秒1tick）
- virtual_time_per_tick: 10分钟（原来5分钟）
- 效果：现实世界更慢，给足虚拟世界时间

### 2. 小鱼思考触发优化
- 扩大威胁检测范围（15→20米）
- 新增卡边界检测（trapped触发）
- 新增能量中等偏低触发（energy_low）
- 新增首次思考触发（first_think）

### 3. 边界逃离优化
- ESCAPE策略现在会检测边界
- 如果逃离方向会导致卡边界，自动调整方向
- 没有威胁但卡边界时，向中心移动

### 4. 死亡处理修复
- 检查角色是否还在物理世界中
- 被吃掉后立即从agent列表移除
- 正确记录死亡原因（eaten/starved）

## 运行参数
```python
tick_rate = 0.2              # 每5秒1tick
virtual_time_per_tick = 10   # 每个tick=10分钟虚拟时间
```

## 新增文件

### agents/llm_brain.py
- AsyncLLMBrain类：异步LLM大脑核心
- 预算控制：15次/小时（10常规+5紧急）
- 战略缓存和触发机制
- Kimi API集成

## 修改文件

### agents/agent.py
- 集成LLM大脑替换原有分层决策器
- 新增_detect_trigger_event()方法
- 新增_execute_strategy()方法

### core/manager.py
- 改为异步事件循环支持
- tick_rate降至0.5/s（慢世界）
- virtual_time_per_tick提升至5分钟

### core/physics.py
- 已修复：食物链尸体移除
- 已修复：能量消耗参数

### static/app.js
- 显示LLM大脑状态（剩余思考次数）
- 显示当前意图和思考状态

### templates/index.html
- 添加LLM大脑状态说明面板

## 运行参数

```python
# 慢世界配置
tick_rate = 0.5  # 每2秒1tick
virtual_time_per_tick = 5  # 每个tick=5分钟虚拟时间

# LLM大脑配置
regular_budget = 10  # 常规思考次数
emergency_budget = 5  # 紧急思考次数
total_budget = 15  # 总预算/小时
cooldown = 60  # 常规调用冷却60秒
```

## 修改目的
解决两个核心问题：
1. 用户输入后看不到角色响应和反馈
2. 生态系统不完整（缺少食物链和能量消耗机制）

---

## 修改详情

### 1. core/physics.py - 生态系统核心

#### 新增 Food 类（水藻）
```python
@dataclass
class Food:
    id: str
    position: Vector2D
    energy_value: float = 20.0  # 食用后提供的能量
    radius: float = 0.8
    alive: bool = True
    spawn_time: float = 0.0
```

#### PhysicsBody 新增属性
```python
role: str = "prey"  # "predator" 或 "prey"
base_energy_cost: float = 0.05  # 每分钟基础生存消耗
last_eat_time: float = 0.0  # 上次进食时间
```

#### PhysicsBody 新增方法
```python
def eat(self, food_energy: float) -> float:
    """进食，返回实际获得的能量"""
    actual_energy = min(food_energy, self.max_energy - self.energy)
    self.energy += actual_energy
    self.last_eat_time = time.time()
    return actual_energy
```

#### World 类新增功能
1. **食物管理**：`foods: Dict[str, Food]` 存储所有水藻
2. **水藻生成**：`_spawn_food()` 方法，每10个tick自动生成
3. **食物链检测**：`_check_food_chain()` 方法
   - 小鱼吃水藻：接触时获得能量
   - 大鱼吃小鱼：接触时获得小鱼80%能量
4. **能量消耗**：移动消耗 + 基础生存消耗

#### World 配置参数
```python
food_spawn_interval = 10  # 每10个tick生成一次
max_food_count = 20       # 最大水藻数量
food_spawn_energy = 25    # 每个水藻的能量值
```

---

### 2. agents/agent.py - 用户命令反馈

#### _execute_user_command() 方法改造
原：只执行命令，无返回值
```python
def _execute_user_command(self, command: str, dt: float):
    # 仅执行，无反馈
```

新：返回执行结果字典
```python
def _execute_user_command(self, command: str, dt: float) -> dict:
    result = {"executed": False, "action": "unknown", "response": ""}
    
    if "向左" in command or "left" in command:
        self.body.velocity = Vector2D(-self.body.max_speed * 0.5, 0)
        self.mind.add_episodic_memory(f"接受用户命令：向左游", 0.9)
        result = {
            "executed": True, 
            "action": "move_left", 
            "response": f"{self.name} 开始向左游动"
        }
    # ... 其他命令
    
    return result
```

#### act() 方法改造
```python
def act(self, world, dt: float) -> dict:
    # 用户控制时返回执行结果
    if self.user_controlled and self.user_command:
        result = self._execute_user_command(self.user_command, dt)
        result["agent_id"] = self.id
        result["agent_name"] = self.name
        result["type"] = "user_command"
        self.user_command = None
        return result
    # ... AI决策
```

---

### 3. core/manager.py - 命令结果记录

#### send_command() 方法改造
原：返回 bool
```python
def send_command(self, agent_id: str, command: str) -> bool:
    if agent_id in self.agents:
        self.agents[agent_id].set_user_command(command)
        return True
    return False
```

新：返回完整结果并记录到事件日志
```python
def send_command(self, agent_id: str, command: str) -> dict:
    with self._lock:
        if agent_id in self.agents:
            self.agents[agent_id].set_user_command(command)
            # 立即执行获取结果
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
```

#### _tick() 方法增强
- 收集所有角色的命令执行结果
- 记录到世界事件日志
- 便于通过 `/api/state` 查看

#### get_current_state() 增强
```python
def get_current_state(self) -> dict:
    return {
        # ... 原有字段
        "foods": {fid: food.to_dict() for fid, food in self.world.foods.items()},
        "food_count": len(self.world.foods),
        # ...
    }
```

---

### 4. web/simple_server.py - API响应增强

#### _handle_init() 增强
```python
def _handle_init(self):
    manager.add_agent("big-fish-1", "大鱼", "predator", x=30, y=50)
    manager.add_agent("small-fish-1", "小鱼", "prey", x=70, y=50)
    
    # 添加初始水藻
    for i in range(5):
        manager.world.add_food()
    
    self._serve_json({"status": "initialized", "food_count": 5})
```

#### _handle_command() 增强
```python
def _handle_command(self, agent_id):
    result = manager.send_command(agent_id, command)
    self._serve_json(result)  # 返回完整结果
```

---

## 生态系统运行逻辑

### 食物链
```
水藻(自动产生) → 小鱼吃 → 大鱼吃 → 能量循环
```

### 能量流动
1. **水藻**：固定能量值（默认25），被吃后消失
2. **小鱼**：
   - 吃水藻：获得水藻全部能量
   - 被吃：大鱼获得小鱼80%能量
   - 消耗：移动消耗 + 每分钟0.05基础消耗
3. **大鱼**：
   - 吃小鱼：获得小鱼80%能量
   - 消耗：移动消耗 + 每分钟0.05基础消耗（×质量2.0）

### 水藻生成
- 每10个tick生成一次
- 在世界随机位置（边界5m内不生成）
- 最多同时存在20个

---

## API变更

### POST /api/init
**响应**：
```json
{
  "status": "initialized",
  "food_count": 5
}
```

### POST /api/agent/{id}/command
**响应**：
```json
{
  "executed": true,
  "action": "move_left",
  "response": "小鱼 开始向左游动",
  "agent_id": "small-fish-1",
  "agent_name": "小鱼",
  "type": "user_command"
}
```

### GET /api/state
**新增字段**：
```json
{
  "foods": {
    "food_abc123": {
      "id": "food_abc123",
      "position": {"x": 45.2, "y": 67.8},
      "energy_value": 25,
      "radius": 0.8,
      "alive": true,
      "type": "food"
    }
  },
  "food_count": 5
}
```

---

## 待验证事项

- [ ] 服务器启动后验证水藻生成
- [ ] 测试用户命令响应
- [ ] 验证食物链（小鱼吃水藻）
- [ ] 验证食物链（大鱼吃小鱼）
- [ ] 验证能量消耗和死亡机制
- [ ] 验证事件日志记录

---

## 启动命令

```bash
cd /home/bruce/.openclaw/workspace/silica-world
python3 launch.py --port 8080
```

访问 http://localhost:8080 查看Web界面。

---

*记录时间：2026-03-09 11:30*
*修改者：小爪*
