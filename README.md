# AI Memory OS

基于 5 层记忆架构的智能可视化系统

## 🌟 系统介绍

AI Memory OS 是一个用于可视化管理 AI 记忆系统的 Web 应用。它采用 5 层记忆架构（L0-L4）+ Intent 轨道的双层设计，帮助 AI 更好地理解和记忆用户的行为模式、认知框架和核心价值。

## 🏗️ 架构设计

```
AI Memory OS
├── L0 状态层       # 当前会话上下文
├── L1 情境层       # 近期对话摘要（每周 review）
├── L2 行为层       # 重复行为模式（每月 review）
├── L3 认知层       # 思维模式与决策框架（每季度 review）
├── L4 核心层       # 价值观与身份（每年 review，仅人工修改）
└── Intent 轨道     # 目标、偏好、边界
```

## 📁 项目结构

```
ai-memory-os/
├── data/                   # JSON 数据文件
│   ├── memories-l1.json    # L1 情境层数据
│   ├── memories-l2.json    # L2 行为层数据
│   ├── memories-l3.json    # L3 认知层数据
│   ├── memories-l4.json    # L4 核心层数据
│   ├── intent.json         # Intent 轨道数据
│   └── stats.json          # 系统统计信息
├── index.html              # 首页 - 记忆概览
├── galaxy.html             # Memory Galaxy - 网络可视化
├── timeline.html           # Timeline - 时间线热力图
├── intent.html             # Intent - 目标轨道
├── package.json            # 项目配置
└── README.md               # 项目说明
```

## 🚀 快速开始

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/AnanasYang/ai-memory-os.git
cd ai-memory-os

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 查看应用

### 部署到 GitHub Pages

本项目是纯静态网站，可直接部署到 GitHub Pages：

1. 推送到 GitHub 仓库
2. 在仓库 Settings > Pages 中选择部署分支
3. 访问 `https://ananasYang.github.io/ai-memory-os`

## 📊 功能特性

### 🏠 首页 (index.html)
- 系统状态概览
- 记忆层统计卡片
- 近期记忆列表
- 标签云
- 详情弹窗

### 🌌 Memory Galaxy (galaxy.html)
- D3.js 力导向图可视化
- 5 层记忆节点网络
- 层级筛选功能
- 节点拖拽交互
- 点击查看详情

### 📅 Timeline (timeline.html)
- GitHub 风格活动热力图
- 记忆时间线展示
- 月度统计
- 活动分布图表

### 🎯 Intent 页面 (intent.html)
- 目标轨道可视化
- 进度追踪
- 偏好设置展示
- 数据源管理

## 🔄 数据更新

数据文件位于 `data/` 目录，基于 `ai-memory-system/` 中的真实记忆数据生成：

- `memories-l1.json` - 从 `ai-memory-system/Memory/L1-episodic/` 提取
- `memories-l2.json` - 从 `ai-memory-system/Memory/L2-procedural/` 提取
- `memories-l3.json` - 从 `ai-memory-system/Memory/L3-semantic/` 提取
- `memories-l4.json` - 从 `ai-memory-system/Memory/L4-core/` 提取
- `intent.json` - 从 `ai-memory-system/Intent/` 提取

## 🛠️ 技术栈

- **前端框架**: 纯 HTML/CSS/JavaScript
- **样式**: Tailwind CSS (CDN)
- **可视化**: D3.js v7
- **图标**: Lucide Icons
- **字体**: Inter (Google Fonts)

## 📈 开发状态

- [x] 数据层构建
- [x] 首页增强
- [x] Memory Galaxy 可视化
- [x] Timeline 时间线
- [x] Intent 目标轨道
- [x] 响应式设计
- [x] GitHub Pages 部署

## 📝 License

MIT License - 详见 LICENSE 文件

---

**AI Memory OS © 2026 | 基于 5 层记忆架构构建**
