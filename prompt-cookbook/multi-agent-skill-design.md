# Multi-Agent Orchestrator Skill 设计方案

## Skill 定位

**名称**: `multi-agent-orchestrator`
**别名**: `mao`, `parallel-mode`
**功能**: 自动将复杂任务分解为并行子任务，协调多个子代理执行

---

## 核心能力

```
用户: "/mao 帮我开发一个电商网站，需要用户系统、商品系统、订单系统、支付系统"

Skill 自动执行:
1. 分析任务可分解性
2. 设计模块边界和接口
3. 创建状态文件结构
4. 启动 4 个 Worker 并行开发
5. 监控进度，协调依赖
6. 整合交付物
```

---

## Skill 目录结构

```
~/.openclaw/skills/multi-agent-orchestrator/
├── SKILL.md                    # 技能定义
├── scripts/
│   ├── analyze-task.sh         # 任务可分解性分析
│   ├── decompose.sh            # 任务分解器
│   ├── create-workers.sh       # 创建并启动 Workers
│   ├── monitor.sh              # 监控状态文件
│   ├── resolve-dependencies.sh # 依赖解析器
│   └── finalize.sh             # 整合交付物
├── templates/
│   ├── state-file.json         # 状态文件模板
│   ├── worker-prompt.md        # Worker 提示词模板
│   └── project-structure.md    # 项目结构模板
└── config/
    └── default-rules.yaml      # 默认规则配置
```

---

## 使用流程

### 方式一：命令式（快捷）

```bash
# 直接激活 Skill 并描述任务
/mao 开发一个电商网站，包含用户系统、商品系统、订单系统、支付系统

# 或分步执行
/mao analyze "开发电商网站"           # 分析可分解性
/mao decompose --modules 4           # 分解为4个模块
/mao launch                          # 启动 Workers
/mao status                          # 查看状态
/mao finalize                        # 整合交付物
```

### 方式二：对话式（灵活）

```
User: /mao
AI: 🚀 Multi-Agent Orchestrator 已激活

    请描述你的任务，我将分析是否适合多代理并行执行。
    
User: 我需要开发一个电商网站，有4个核心模块
AI: 📊 任务分析完成
    
    【可分解性评分】9.2/10 ✅ 强烈推荐多代理模式
    
    【建议分解】
    ├─ Module 1: 用户系统 (认证/注册/个人中心)
    ├─ Module 2: 商品系统 (目录/库存/搜索)
    ├─ Module 3: 订单系统 (购物车/订单/物流)
    └─ Module 4: 支付系统 (支付/对账/退款)
    
    【依赖关系】
    Module 1 → Module 3 (订单需要用户)
    Module 2 → Module 3 (订单需要商品)
    
    【执行策略】
    Phase 1: 并行启动 Module 1, 2, 4
    Phase 2: Module 3 (等待 1,2 完成后启动)
    
    确认启动？ [启动] [调整分解] [取消]

User: 启动
AI: ✅ 已启动 4 个 Worker
    
    📁 项目目录: projects/ecommerce-2026-04-03/
    📊 状态看板: projects/ecommerce-2026-04-03/status.md
    
    【实时状态】
    Module 1 (用户系统): 🟡 运行中 - 30%
    Module 2 (商品系统): 🟡 运行中 - 25%
    Module 3 (订单系统): ⏳ 等待依赖
    Module 4 (支付系统): 🟡 运行中 - 40%
```

---

## SKILL.md 核心内容

```markdown
# multi-agent-orchestrator

## Description
自动将复杂任务分解为并行子任务，协调多个子代理执行，适合大型项目开发、多模块系统设计、批量文档编写等场景。

## Usage

### 快速启动
```
/mao <任务描述>
```

### 分步控制
```
/mao analyze "<任务>"       # 分析可分解性
/mao decompose --strategy <parallel|sequential|hybrid>
/mao launch                  # 启动 Workers
/mao status                  # 查看实时状态
/mao pause <worker-id>       # 暂停指定 Worker
/mao resume <worker-id>      # 恢复指定 Worker
/mao finalize                # 整合交付物
```

### 配置选项
```
/mao config max-workers 10          # 最大 Worker 数
/mao config check-interval 10min    # 状态检查间隔
/mao config auto-finalize true      # 自动整合
```

## Triggers
- 用户输入包含"多个模块"、"并行开发"、"分解任务"等关键词
- 任务描述暗示可分解性（如"包含X个部分"、"涉及Y个系统"）

## Rules

### 自动分析规则
1. 任务长度 > 100 字且包含 3+ 个独立概念 → 建议分解
2. 检测到关键词："系统"、"模块"、"组件"、"部分" → 评估分解
3. 用户明确说"并行"、"多代理" → 强制启用

### Worker 数量建议
- 简单任务 (2-3 模块): 3-5 Workers
- 中等任务 (4-7 模块): 5-8 Workers
- 复杂任务 (8+ 模块): 8-12 Workers，分 Phase 执行

### 依赖处理规则
- 无依赖: 立即并行启动
- 弱依赖: 并行启动，Worker 轮询等待
- 强依赖: 串行启动，前置完成后再启动

## Output
- 项目目录结构
- 状态看板文件 (status.md)
- 各 Worker 交付物
- 整合后的最终成果
- 执行报告 (report.md)

## Examples

### Example 1: 软件开发
```
User: /mao 开发一个博客系统，包含文章管理、用户系统、评论系统、标签系统

AI: 【分析结果】适合4模块并行开发
    【启动】4 Workers 已启动
    【预计时间】45分钟
```

### Example 2: 文档编写
```
User: /mao 写一份年度报告，包含市场分析、产品回顾、财务总结、未来规划

AI: 【分析结果】适合4章节并行编写
    【启动】4 Writers 已启动
    【整合策略】统一文风后合并
```

## Best Practices
- 首次使用建议从 3-4 个 Worker 开始
- 定期检查状态看板，及时解决阻塞
- 复杂项目建议分 Phase 执行，避免过度并行
```

---

## 作为用户的使用指南

### 第一步：安装/激活 Skill

```bash
# 方式1: 通过 ClawHub 安装
openclaw skill install multi-agent-orchestrator

# 方式2: 本地创建
mkdir -p ~/.openclaw/skills/multi-agent-orchestrator
# 将 SKILL.md 放入该目录
```

### 第二步：使用 Skill 完成任务

#### 场景 A：明确的多模块任务
```
User: /mao 分析并重构我们的 CI/CD 流程，需要处理：代码检查、测试、构建、部署、通知

Skill 自动:
1. 分析5个模块的依赖关系
2. 启动5个Worker并行设计
3. 监控进度，协调依赖
4. 整合为完整的 CI/CD 方案
```

#### 场景 B：需要分析的复杂任务
```
User: /mao

Skill: 🚀 Multi-Agent Orchestrator 已激活
       请描述你的任务...

User: 我想优化我们的数据分析流程，目前很慢

Skill: 📊 分析完成。建议分解为4个优化方向：
       1. 查询优化 Worker
       2. 缓存策略 Worker
       3. 并行计算 Worker
       4. 存储优化 Worker
       
       启动？ [是] [调整] [否]
```

#### 场景 C：手动控制模式
```
User: /mao analyze "设计一个新的微服务架构"

Skill: 【可分解性评分】8.5/10
       【建议模块】网关、服务发现、配置中心、监控、日志
       
User: /mao decompose --modules 5 --names "网关,服务发现,配置中心,监控,日志"

Skill: ✅ 已创建5个Worker配置

User: /mao launch

Skill: 🚀 5 Workers 已启动
       📊 状态看板: projects/microservice-arch/status.md

User: /mao status

Skill: 【实时状态】
       网关: ✅ 已完成
       服务发现: 🟡 70%
       配置中心: 🟡 45%
       监控: ⏳ 等待依赖(服务发现)
       日志: 🟡 60%

User: /mao finalize

Skill: ✅ 已整合所有交付物
       📄 最终方案: projects/microservice-arch/final-architecture.md
```

---

## 高级配置

### 自定义分解策略
```yaml
# ~/.openclaw/skills/multi-agent-orchestrator/config/my-rules.yaml
decomposition:
  strategy: hybrid  # parallel | sequential | hybrid
  max_workers: 8
  min_module_size: 30min  # 每个模块最少30分钟工作量
  
dependency:
  auto_detect: true
  strict_mode: false  # false=允许弱依赖并行
  
monitoring:
  check_interval: 10min
  alert_on_block: true
  auto_escalate: 15min  # 阻塞15分钟后上报

output:
  format: markdown
  consolidate: true  # 自动整合
  preserve_individual: true  # 保留各Worker输出
```

### 与其他 Skill 组合
```
# 先用 mao 分解，再用其他 Skill 执行
/mao decompose "开发一个React组件库"
# 然后对每个模块使用特定 Skill
/component-generator 为 Module-1 生成 Button 组件
/component-generator 为 Module-2 生成 Modal 组件
...
/mao finalize
```

---

## 总结：使用流程图

```
启动对话
   │
   ▼
激活 Skill: /mao
   │
   ▼
描述任务 ──→ Skill 分析可分解性
   │              │
   │              ▼
   │         【推荐分解方案】
   │              │
   │              ▼
   │         用户确认/调整
   │              │
   ▼              ▼
启动 Workers ◄───┘
   │
   ▼
自动监控状态
   │
   ▼
检测到阻塞? ──→ 协调解决
   │
   ▼
全部完成?
   │
   ▼
整合交付物
   │
   ▼
输出最终成果
```

---

## 下一步行动

如果你决定创建这个 Skill，我可以：
1. 编写完整的 SKILL.md 文件
2. 创建 scripts/ 目录下的所有脚本
3. 制作 templates/ 模板文件
4. 编写测试用例

需要我立即开始制作吗？
