# Netlify 部署指南

## 快速部署

### 方法一：一键部署（推荐）

点击下方按钮直接部署：

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/AnanasYang/ai-memory-os)

### 方法二：手动部署

1. **Fork 仓库**
2. **连接 Netlify** - 导入 GitHub 仓库
3. **配置构建设置**:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **部署**

## 构建设置

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

## 数据同步

设置每小时同步：

```bash
crontab -e
# 添加: 0 * * * * cd /path/to/ai-memory-os && node scripts/sync-data.js && git add data/ && git commit -m "sync" && git push
```
