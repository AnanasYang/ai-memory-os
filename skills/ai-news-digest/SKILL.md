# AI 前沿追踪日报 Skill

## 基本信息
- **名称**: ai-news-digest
- **版本**: 4.0.0
- **用途**: 每日自动生成 AI/自动驾驶领域前沿资讯简报
- **执行时间**: 每日 10:00 (Asia/Shanghai)
- **输出方式**: 飞书文档（逐块追加+500ms延迟）

---

## 核心原则

### 1. 宁缺毋滥
- 质量优先于数量
- 每层内容可降级收录（降低相关性阈值）并减量（最少可至 0 条）
- 无符合条件内容时，该层标注"*本层今日无重大动态*"

### 2. 零幻觉
- LLM 只能基于 Tavily 返回的真实结果生成内容
- 允许对标题进行轻微改写以提高可读性
- 禁止添加搜索结果中不存在的信息
- 每条要点必须能在搜索结果中找到依据

### 3. 格式可控
- **输出格式**: 飞书文档
- **每条新闻结构**: 3点客观总结 + 来源链接
- **来源显示**: 显示实际来源名称（如"量子位"），不是"链接"

---

## 信息源配置（完整版）

### 核心层/近层 - 中文
| 媒体名称 | 站点域名 | 搜索关键词 | 数量 | 阈值 |
|---------|---------|-----------|------|------|
| 量子位 | qbitai.com | `自动驾驶 AI site:qbitai.com` | 10 | ≥70% |
| 机器之心 | jiqizhixin.com | `人工智能 site:jiqizhixin.com` | 10 | ≥70% |
| InfoQ | infoq.cn | `AI site:infoq.cn` | 5 | ≥70% |

### 核心层/近层 - 国际
| 媒体名称 | 搜索关键词 | 数量 | 阈值 |
|---------|-----------|------|------|
| 国际自动驾驶 | `autonomous driving Waymo Tesla news` | 10 | ≥70% |
| 国际机器人 | `robotics AI physical AI` | 8 | ≥70% |
| 国际大模型 | `LLM large language model breakthrough` | 8 | ≥70% |
| OpenAI动态 | `OpenAI news` | 3 | ≥70% |
| NVIDIA动态 | `NVIDIA AI chip autonomous driving` | 3 | ≥70% |

### 支撑层
| 媒体名称 | 站点域名 | 搜索关键词 | 数量 | 阈值 |
|---------|---------|-----------|------|------|
| 36氪 | 36kr.com | `AI投资 融资 site:36kr.com` | 5 | ≥70% |
| 甲子光年 | jazzyear.com | `人工智能 产业 site:jazzyear.com` | 3 | ≥70% |
| 高工智能汽车 | gg-auto.com | `自动驾驶 政策 site:gg-auto.com` | 3 | ≥70% |
| 工信部 | miit.gov.cn | `人工智能 政策 site:miit.gov.cn` | 2 | ≥80% |
| 网信办 | cac.gov.cn | `生成式AI 监管 site:cac.gov.cn` | 2 | ≥80% |
| 盖世汽车 | gasgoo.com | `自动驾驶 法规 site:gasgoo.com` | 3 | ≥70% |

### 外延层
| 媒体名称 | 站点域名 | 搜索关键词 | 数量 | 阈值 |
|---------|---------|-----------|------|------|
| arXiv | arxiv.org | `autonomous driving arxiv` | 3 | ≥70% |
| IEEE Spectrum | spectrum.ieee.org | `AI robotics site:spectrum.ieee.org` | 3 | ≥70% |

---

## 收录标准（宁缺毋滥）

### 必须满足（全部）
- [ ] 与自动驾驶/AI/机器人/物理AI相关
- [ ] 是新闻/技术进展/产品发布（排除广告/招聘/活动通知）
- [ ] 有明确来源（官方博客/权威媒体/论文）
- [ ] Tavily 相关性 ≥ 阈值

### 优先收录
- ✅ 产品发布（L4系统、芯片、仿真平台）
- ✅ 技术突破（新模型、新算法、数据集）
- ✅ 合作/融资（有技术价值的）
- ✅ 政策发布（自动驾驶法规、AI治理）
- ✅ 重磅论文（arXiv顶会）

### 明确排除
- ❌ 纯商业八卦（无技术价值的人事变动、融资八卦）
- ❌ 企业IT Infra接入类新闻（钉钉/飞书接入XX工具）
- ❌ 广告/招聘/会议通知
- ❌ 重复内容（已在其他源收录）

---

## 执行流程

### Step 1: 环境检查
```bash
检查项:
- TAVILY_API_KEY 是否设置
- Tavily skill 路径: /home/bruce/.openclaw/workspace/skills/tavily-search/
```

### Step 2: 数据抓取（含降级策略）

#### 第一轮搜索 - 标准阈值
```bash
# 中文源 - 核心层/近层
node skills/tavily-search/scripts/search.mjs "自动驾驶 AI site:qbitai.com" --topic news -n 10
node skills/tavily-search/scripts/search.mjs "人工智能 site:jiqizhixin.com" --topic news -n 10
node skills/tavily-search/scripts/search.mjs "AI site:infoq.cn" --topic news -n 5

# 国际源 - 核心层/近层
node skills/tavily-search/scripts/search.mjs "autonomous driving AI news" --topic news -n 10
node skills/tavily-search/scripts/search.mjs "robotics AI physical AI" --topic news -n 8
node skills/tavily-search/scripts/search.mjs "LLM breakthrough" --topic news -n 8

# 中文源 - 支撑层（政策/投资）
node skills/tavily-search/scripts/search.mjs "AI投资 融资 site:36kr.com" --topic news -n 5
node skills/tavily-search/scripts/search.mjs "人工智能 政策 site:miit.gov.cn OR site:cac.gov.cn" --topic news -n 3
node skills/tavily-search/scripts/search.mjs "自动驾驶 法规 site:gasgoo.com" --topic news -n 3

# 国际源 - 外延层（观点/论文）
node skills/tavily-search/scripts/search.mjs "autonomous driving arxiv" --topic news -n 3
```

#### 第二轮搜索 - 降级
```bash
# 降低阈值（80%→60%），减少结果数（10→5）
node skills/tavily-search/scripts/search.mjs "自动驾驶 site:qbitai.com" --topic news -n 5
```

#### 去重机制
- 标题相似度 ≥ 85% 视为重复
- 保留质量最高的源

### Step 3: 内容生成（LLM边界）

#### LLM使用规则
- ✅ 基于 Tavily 返回的真实结果生成
- ✅ 允许轻微改写标题
- ✅ 合并相似报道
- ❌ 禁止添加搜索结果外的信息
- ❌ 禁止"脑补"细节

#### 输出格式
```markdown
# 【今日AI前沿 - YYYY-MM-DD】

报送人：小爪  
日期：YYYY-MM-DD  
范围：过去24小时关键动态

---

## 🔴 核心层（可落地的开源项目/模型/范式）

### 一、[改写后的标题]

关键信息：

- [要点1：1-3句话]
- [要点2：1-3句话]
- [要点3：1-3句话，可选]

来源：[来源1](链接1) | [来源2](链接2)
```

### Step 4: 执行流程

**完整执行命令**：
```bash
cd /home/bruce/.openclaw/workspace/skills/ai-news-digest && \
export TAVILY_API_KEY=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 && \
node scripts/main.mjs
```

**脚本功能** (`scripts/main.mjs`)：
1. 搜索所有配置的来源（15+个源）
2. 去重（标题相似度判断）
3. 按四层分类
4. 每条生成3点客观总结
5. 生成 Markdown 文件
6. 输出 JSON 结果

**输出格式示例**：
```markdown
### 01、DriveGPT自动驾驶大模型中国玩家首发！1200亿参数，毫末智行出品

- 毫末智行发布了参数规模达1200亿的自动驾驶大模型DriveGPT，采用生成式预训练技术路线。
- 该技术采用端到端架构，可直接从感知数据生成车辆控制指令。
- 大模型技术的应用可能重塑自动驾驶系统的开发范式和性能上限。

来源：[量子位](https://www.qbitai.com/...)
```

**3句话介绍结构**：
- 去掉"关键信息"标题，直接用3个 bullet point
- 第1句：核心内容（标题的扩展描述，不是简单重复）
- 第2句：技术细节或背景
- 第3句：影响或趋势

**介绍示例（DriveGPT）**：
- 毫末智行发布了参数规模达1200亿的自动驾驶大模型DriveGPT，采用生成式预训练技术路线。
- 该技术采用端到端架构，可直接从感知数据生成车辆控制指令。
- 大模型技术的应用可能重塑自动驾驶系统的开发范式和性能上限。

**介绍示例（成本下降）**：
- 国内自动驾驶方案成本降至3000元级别，大幅降低了智驾功能上车门槛。
- 成本下降主要得益于芯片算力提升和算法优化，使高阶智驾可下沉至中低端车型。
- 成本下探将加速智能驾驶功能普及，推动行业从高端向大众市场渗透。

**生成后操作（简化稳定版）**：
1. 执行 `run.sh` 或 `node scripts/main.mjs` 生成 Markdown 文件
2. 直接发送 Markdown 文件给用户（飞书支持 Markdown 渲染，链接可点击）

**为何不采用飞书文档**：
- 逐块追加 80+ 个块，任何一步失败都导致文档不完整
- Markdown 文件一次性生成，发送简单稳定
- 飞书对 Markdown 文件支持良好，格式美观，链接可点击

### Step 5: 质量验证

**必须验证**：
- [ ] Markdown 文件成功生成
- [ ] 内容完整（检查四层都有标题）
- [ ] 来源正确显示（如"量子位"而非"链接"）
- [ ] 每条都有3点总结
- [ ] 文件可正常发送

**验证方式**：
```bash
# 手动执行验证
./run.sh
# 检查输出文件
cat reports/日报_$(date '+%Y-%m-%d').md
```

---

## 错误处理与容错

### 分级错误处理

| 错误级别 | 场景 | 处理 | 通知 |
|---------|------|------|------|
| L1-警告 | 某源结果不足，触发降级 | 降低阈值，减少数量 | 标注"*本层内容经降级筛选*" |
| L2-部分失败 | 某源完全失败 | 跳过该源，其他源继续 | 标注"*量子位源暂时不可用*" |
| L3-全局失败 | Tavily 全部失败 | 发送错误报告 | 发送详细错误报告 |
| L4-发送失败 | 文档创建成功但发送失败 | 重试3次 | 发送错误报告 |

### 错误报告格式
```
【AI日报生成失败 - YYYY-MM-DD】

失败环节：[数据抓取/内容生成/文档创建/消息发送]
错误信息：[详细错误]
影响范围：[全部/部分]
建议操作：[人工介入/等待自动恢复]

原始数据（如有）：
[保留原始搜索结果]
```

---

## 所需依赖

### API Key
```bash
export TAVILY_API_KEY="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"
```

### 调用的 Skills
| Skill | 用途 | 失败时 |
|------|------|--------|
| tavily-search | 中英文搜索 | 发送错误报告 |
| message | 发送 Markdown 文件 | 重试3次 |

---

## Cron 配置

**已部署任务**：
```bash
openclaw cron list
# 名称: AI前沿追踪日报
# 时间: 每天 10:00 (Asia/Shanghai)
# 状态: 已启用
```

**Cron 执行逻辑（简化稳定版）**：
1. 触发隔离会话执行 ai-news-digest skill
2. 执行 `./run.sh` 生成 Markdown 文件
3. 直接发送 Markdown 文件给用户

**手动执行**：
```bash
./run.sh
# 或
cd /home/bruce/.openclaw/workspace/skills/ai-news-digest
export TAVILY_API_KEY=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
node scripts/main.mjs
```

---

## 项目结构

```
ai-news-digest/
├── SKILL.md              # 本文档
├── run.sh                # 自动化执行脚本（推荐）
├── scripts/
│   └── main.mjs          # 主执行脚本
├── reports/
│   └── 日报_YYYY-MM-DD.md # 生成的日报
└── memory/
    └── YYYY-MM-DD.md     # 执行日志
```

---

## 变更记录

- **v4.0.1** (2026-03-12):
  - **简化输出方案**：改为直接发送 Markdown 文件（更稳定）
  - 新增 `run.sh` 自动化脚本
  - 移除飞书文档逐块追加（避免块顺序问题）
  - 优化国际来源分类（添加更多英文关键词）

- **v4.0.0** (2026-03-12):
  - 完整信息源配置（中文+国际，15+来源）
  - 3点客观总结格式
  - 来源正确显示（如"量子位"）
  - 稳定可复现的执行流程
  - 新增"宁缺毋滥"量化标准
  - 新增 LLM 边界
  - 新增分级错误处理（L1-L4）
