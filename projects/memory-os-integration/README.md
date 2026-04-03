# AI Memory OS

AI 记忆系统可视化界面 - 五层记忆架构管理

## 项目说明

本项目是 AI Memory System 的可视化界面，展示 L0-L4 五层记忆架构：
- **L0 工作记忆**: 实时会话流
- **L1 情境记忆**: 事件级摘要
- **L2 程序记忆**: 行为模式
- **L3 语义记忆**: 认知框架
- **L4 核心记忆**: 价值观与身份

## 技术栈

- HTML5 + Tailwind CSS (CDN)
- 纯静态页面，无需构建
- 响应式设计，支持移动端

## 部署

### Netlify Drop (推荐)
1. 访问 https://app.netlify.com/drop
2. 下载本仓库的 `dist/index.html`
3. 拖拽上传到 Netlify
4. 立即获得 HTTPS URL

### 或手动部署
```bash
# 仅上传 dist/index.html
cp dist/index.html ./
zip -r ai-memory-os.zip index.html
# 然后上传到 Netlify
```

## 访问

部署后访问 `https://<your-site>.netlify.app`

## 数据来源

界面数据来自 `ai-memory-system` 仓库的记忆文件，每小时自动同步。
