# AI Memory OS - 架构说明与自动更新方案

## 当前架构：纯静态的局限性

### 为什么选择纯静态？
1. **简化部署**：无需服务器，Netlify/GitHub Pages 免费托管
2. **快速加载**：CDN 分发，全球访问快
3. **零维护**：无需担心服务器宕机

### 核心问题：无法自动更新

| 场景 | 纯静态表现 | 期望表现 |
|------|-----------|---------|
| ai-memory-system 新增记忆 | ❌ 网页不更新 | ✅ 自动显示新记忆 |
| 每小时数据同步 | ❌ 需要手动 push | ✅ 定时自动同步 |
| 用户刷新页面 | 看到旧数据 | 看到最新数据 |

**原因**：纯静态页面在构建时生成，运行时不会主动获取新数据。

---

## 解决方案：GitHub Actions 自动同步

### 方案 1：定时触发重新部署（推荐）

创建 `.github/workflows/sync.yml`：

```yaml
name: Hourly Memory Sync

on:
  schedule:
    - cron: '0 * * * *'  # 每小时运行
  workflow_dispatch:  # 支持手动触发

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Sync Data
        run: |
          # 克隆 ai-memory-system 仓库
          git clone https://github.com/AnanasYang/ai-memory-system.git /tmp/ai-memory-system
          
          # 运行同步脚本
          node scripts/sync-data.js
          
      - name: Commit Changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add data/
          git diff --cached --quiet || git commit -m "sync: update memories from ai-memory-system [$(date)]"
          git push
```

**效果**：
- 每小时自动从 ai-memory-system 拉取最新数据
- 自动提交并推送到 GitHub
- Netlify 检测到 push 自动重新部署
- 用户刷新页面看到最新数据

---

### 方案 2：客户端动态获取（更实时）

修改 `index.html`，使用 JavaScript 定时获取：

```javascript
// 每小时刷新数据
setInterval(() => {
  fetch('https://raw.githubusercontent.com/AnanasYang/ai-memory-os/main/data/stats.json')
    .then(r => r.json())
    .then(data => updateUI(data));
}, 3600000); // 1小时

// 页面加载时立即获取最新数据
fetch('https://raw.githubusercontent.com/AnanasYang/ai-memory-os/main/data/memories-l1.json')
  .then(r => r.json())
  .then(data => renderMemories(data));
```

**效果**：
- 页面无需重新部署
- 客户端直接读取 GitHub 原始数据
- 更实时，但依赖 GitHub API

---

### 方案 3：混合架构（最佳）

结合方案 1 和 2：

1. **GitHub Actions**：每小时同步数据到本仓库
2. **客户端缓存**：页面加载时显示本地数据（快）
3. **背景更新**：每 5 分钟检查是否有新数据

```javascript
// 混合方案代码示例
async function loadData() {
  // 1. 先显示本地缓存（快速）
  const cached = localStorage.getItem('memories-l1');
  if (cached) renderMemories(JSON.parse(cached));
  
  // 2. 后台获取最新数据
  const response = await fetch('data/memories-l1.json?v=' + Date.now());
  const fresh = await response.json();
  
  // 3. 如果有变化，更新显示
  if (JSON.stringify(fresh) !== cached) {
    renderMemories(fresh);
    localStorage.setItem('memories-l1', JSON.stringify(fresh));
  }
}
```

---

## 实施建议

### 立即实施（方案 1）

1. 添加 GitHub Actions 工作流
2. 创建同步脚本 `scripts/sync-data.js`
3. 配置 GitHub Token 权限
4. 测试定时触发

### 长期优化（方案 3）

1. 重构为 Next.js/React
2. 添加客户端数据获取
3. 实现增量更新
4. 添加实时 WebSocket（可选）

---

## 对比总结

| 方案 | 实时性 | 复杂度 | 成本 | 推荐度 |
|------|--------|--------|------|--------|
| 纯静态（当前） | ❌ 无 | 低 | 免费 | ⭐ |
| 方案 1：定时部署 | ⭐⭐ 小时级 | 中 | 免费 | ⭐⭐⭐⭐ |
| 方案 2：客户端获取 | ⭐⭐⭐ 分钟级 | 中 | 免费 | ⭐⭐⭐ |
| 方案 3：混合 | ⭐⭐⭐⭐ 近实时 | 高 | 免费 | ⭐⭐⭐⭐⭐ |

**推荐**：先实施方案 1（1小时延迟可接受），未来升级到方案 3。
