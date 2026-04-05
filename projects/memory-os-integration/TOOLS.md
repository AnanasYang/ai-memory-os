# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

### Tavily Search

**API Key**: [配置在环境变量中]
**路径**: `/home/bruce/.openclaw/workspace/skills/tavily-search/`

**使用方法**:
```bash
export TAVILY_API_KEY=your_api_key
node /home/bruce/.openclaw/workspace/skills/tavily-search/scripts/search.mjs "query" --topic news -n 10
```

---

### GitHub

**Token**: [配置在环境变量中]
**用户名**: AnanasYang
**作用**: 用于推送仓库、创建 release 等 GitHub API 操作

**使用方法**:
```bash
# 配置 Git 使用 Token（HTTPS）
git remote set-url origin https://[TOKEN]@github.com/AnanasYang/REPO_NAME.git

# 或使用 API
curl -H "Authorization: token [TOKEN]" \
     https://api.github.com/user/repos
```

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
