# System Reliability Manager

## 核心问题诊断

### 问题 1: GitHub 推送失败
**根因**: 
- Token 泄露在 Git 历史中
- node_modules 文件过大 (>100MB)
- 历史提交包含敏感信息

**解决方案**:
- ✅ 创建干净的 ai-memory-os-prod 目录
- ✅ 仅包含必要文件 (README.md, index.html)
- ✅ 使用 --force 推送覆盖历史

### 问题 2: 会话超时/卡住
**根因**:
- 长时间运行的 exec 命令无 yield
- 网络超时未处理
- 子代理管理不当

**解决方案**:
- 使用 timeout 参数
- 定期检查 (poll)
- 后台任务 (background)

### 问题 3: Skill 架构缺陷
**根因**:
- /mao skill 阻塞主会话
- 无心跳机制
- 子代理失败无法恢复

**解决方案**:
- 非阻塞模式
- 5 分钟心跳汇报
- 自动重试机制

## 预防性设计模式

### 模式 1: 最小可行推送
```
只推送必要文件 (html, css, js, README)
绝不推送: node_modules, .next, dist, .env, tokens
```

### 模式 2: 分层架构
```
主会话: 快速响应，不阻塞
├── Manager Subsession: 协调 (5min 心跳)
│   ├── Worker 1: 独立任务
│   ├── Worker 2: 独立任务
│   └── ...
```

### 模式 3: 错误隔离
```
每个操作都有:
- 超时处理
- 回退方案
- 状态记录
- 失败重试
```

## 监控清单

- [ ] Git push 前检查文件大小
- [ ] 检查敏感信息泄露
- [ ] 长时间操作使用 background
- [ ] 定期检查子代理状态
- [ ] 记录所有失败到 memory/

## 应急方案

如果再次卡住:
1. 检查当前执行状态
2. 使用 process(action=kill) 清理
3. 重新启动子任务
4. 记录失败原因

---
*Generated: 2026-04-03*
*Purpose: Prevent future session failures*
