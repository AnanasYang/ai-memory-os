# 飞书文档权限配置指南

## 1. 系统权限概览

当前系统已授予以下飞书文档相关权限：
- docx:document:readonly - 只读访问文档
- im:message:send_as_bot - 以机器人身份发送消息
- docs:event.document_edited:read - 读取文档编辑事件
- docs:document.content:read - 读取文档内容
- docs:document.comment:read - 读取文档评论
- docs:permission.setting:readonly - 读取权限设置
- docs:doc:readonly - 只读访问文档
- docs:event:subscribe - 订阅事件
- docs:event.document_opened:read - 读取文档打开事件
- docs:event.document_deleted:read - 读取文档删除事件
- drive:file.meta.sec_label.read_only - 只读访问文件元数据标签
- drive:file:view_record:readonly - 只读查看文件记录
- drive:file:readonly - 只读访问文件
- drive:file:download - 下载文件权限
- drive:file:upload - 上传文件权限
- drive:drive:readonly - 只读访问云盘
- im:message - 发送消息权限
- im:chat:readonly - 只读访问聊天

## 2. 创建与管理权限

### 2.1 文档创建权限
- 需要 `drive:file:upload` 权限才能上传文件
- 需要 `docx:document:readonly` 权限来读取文档
- 系统当前已具备完整创建和读取文档的权限

### 2.2 文档编辑权限
- 目前已具备文档读取和上传权限
- 编辑权限取决于文档设置和文档拥有者权限

### 2.3 文件共享权限
- 通过 `docs:permission.setting:readonly` 可读取当前文档权限设置
- 系统目前权限设置已覆盖文档管理主要功能

## 3. 推荐设置

### 3.1 文档机器人权限
- 消息发送：`im:message:send_as_bot`
- 文档管理：`drive:file:upload`, `drive:file:download`
- 只读访问：`docx:document:readonly`, `docs:document.content:read`

### 3.2 最佳实践
1. 始终使用最小权限原则
2. 定期检查并更新权限设置
3. 在文档中记录权限变更历史
4. 合理配置文档访问控制

## 4. 常见问题排查

1. **提示无权限访问文档**：
   - 检查是否拥有该文档的读取权限
   - 确认机器人应用是否已设置相应权限

2. **无法创建新文档**：
   - 确认已配置文件上传权限
   - 检查云盘空间是否充足

3. **文档修改失败**：
   - 确认拥有文档编辑权限
   - 检查文档是否被锁定或共享设置

## 5. 安全注意事项

1. 不要将全权访问权限分配给应用
2. 定期审计权限设置
3. 限制机器人应用的访问范围
4. 保存权限变更的记录