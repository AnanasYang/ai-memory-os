# Netlify 自动化部署配置指南

## 快速设置（2分钟完成）

### 步骤 1：获取 Netlify 个人访问令牌

1. 访问：https://app.netlify.com/user/applications/personal
2. 点击 **"New access token"**
3. 输入名称：`ai-memory-os-deploy`
4. 点击 **"Generate token"**
5. **复制生成的 token**（类似：`nfp_xxxxxxxxxxxxxxxx`）

### 步骤 2：在当前终端设置环境变量

```bash
export NETLIFY_AUTH_TOKEN=nfp_你的token
```

### 步骤 3：运行部署脚本

```bash
cd /home/bruce/.openclaw/workspace/ai-memory-os-prod
./deploy-to-netlify.sh
```

---

## 永久配置（推荐）

### 添加到 ~/.bashrc 或 ~/.zshrc

```bash
echo 'export NETLIFY_AUTH_TOKEN=nfp_你的token' >> ~/.bashrc
source ~/.bashrc
```

### 验证配置

```bash
echo $NETLIFY_AUTH_TOKEN
# 应该显示你的 token
```

---

## 后续工作流（完全自动化）

设置完成后，每次更新只需：

```bash
# 1. 更新代码
# ... 修改文件 ...

# 2. 自动部署
cd /home/bruce/.openclaw/workspace/ai-memory-os-prod
netlify deploy --prod --message="更新说明"

# 完成！无需登录，无需浏览器
```

---

## GitHub Actions 集成（高级）

在 `.github/workflows/deploy.yml` 中添加：

```yaml
- name: Deploy to Netlify
  env:
    NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
  run: |
    npm install -g netlify-cli
    netlify deploy --prod --dir=. --auth "$NETLIFY_AUTH_TOKEN"
```

然后在 GitHub Settings → Secrets 添加 `NETLIFY_AUTH_TOKEN`

---

## 当前状态

✅ Netlify CLI 已安装  
⏳ 等待 NETLIFY_AUTH_TOKEN  
⏳ 等待首次部署  

**请提供你的 Netlify token，我立即完成部署！**
