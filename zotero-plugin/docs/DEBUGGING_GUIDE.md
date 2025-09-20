# Researchopia Zotero插件调试指南

## 🐛 常见问题和解决方案

### 1. 插件界面显示问题

#### 问题描述
- Item pane中只显示按钮，没有标题和完整界面
- 插件面板缺少"研学港 Researchopia"标题

#### 解决方案 (v0.4.0已修复)
- ✅ 添加了完整的标题区域 (`researchopia-header`)
- ✅ 添加了用户认证区域 (`researchopia-auth-area`)
- ✅ 改进了CSS样式，包含标题和副标题
- ✅ 集成了用户界面组件

#### 验证方法
1. 重新安装插件
2. 选择包含标注的PDF文档
3. 检查Item pane中是否显示：
   - 🌊 研学港 Researchopia (标题)
   - "学术标注分享平台" (副标题)
   - 用户认证区域
   - 分享标注和刷新按钮

### 2. Console未定义错误

#### 问题描述
```
Error during plugin startup: console is not defined
显示标注选择器失败: console is not defined
```

#### 解决方案 (v0.4.0已修复)
- ✅ 所有模块的日志系统已更新为使用Zotero.debug()
- ✅ 添加了兼容性检查，优先使用Zotero日志系统
- ✅ 添加了错误处理，避免日志错误影响功能

#### 涉及文件
- `annotation-selector.js`
- `social-features.js`
- `user-interface.js`
- `auth-manager.js`

### 3. 主网站关联检查

#### 当前配置
- **认证服务器**: `https://researchopia.com/api/auth`
- **本地API服务器**: `http://localhost:3000/api/v1` (动态检测端口)
- **存储前缀**: `extensions.researchopia.*`

#### 验证方法
1. 检查认证配置：
   ```javascript
   // 在浏览器控制台中执行
   console.log(AuthManager.config.authBaseUrl);
   // 应该显示: https://researchopia.com/api/auth
   ```

2. 检查本地API连接：
   - 启动 `npm run dev`
   - 插件会自动检测端口 (3000, 3001, 3002等)
   - 查看调试日志确认连接状态

## 🔧 调试步骤

### 启用详细日志
1. 打开Zotero
2. 进入 Help → Debug Output Logging
3. 启用 "Enable after restart"
4. 重启Zotero
5. 重现问题
6. 查看 Help → Debug Output Logging → View Output

### 检查插件加载
在调试日志中查找以下信息：
```
Researchopia plugin started successfully
Authentication manager initialized
Annotation sharing module initialized
Annotation selector initialized
Social features initialized
User interface initialized
```

### 检查Item Pane注册
查找以下日志：
```
Item Pane section registered successfully
```

### 检查API连接
查找以下日志：
```
✅ 检测到API服务器运行在端口 3000
✅ 使用检测到的API地址: http://localhost:3000/api/v1
```

## 🚀 功能测试清单

### 基础功能
- [ ] 插件正确加载和初始化
- [ ] Item pane显示完整界面（标题、认证区域、按钮）
- [ ] 标注检测功能正常
- [ ] 分享按钮响应正常

### 认证功能
- [ ] 登录按钮显示
- [ ] 登录窗口可以打开
- [ ] 用户状态正确显示
- [ ] 匿名模式功能正常

### 标注分享
- [ ] 标注检测成功
- [ ] 选择器界面显示（多个标注时）
- [ ] 分享到服务器成功
- [ ] 离线模式正常工作

### 社交功能
- [ ] 点赞功能可用
- [ ] 评论功能可用
- [ ] 用户关注功能可用

## 📋 版本历史

### v0.4.0 (当前版本)
- ✅ 修复console未定义错误
- ✅ 完善Item pane界面显示
- ✅ 添加完整的标题和用户认证区域
- ✅ 改进CSS样式和布局
- ✅ 保持主网站关联功能

### v0.3.0
- ✅ 用户认证系统
- ✅ 选择性标注分享
- ✅ 社交功能框架

### v0.2.0
- ✅ 基础标注检测和分享
- ✅ DOI处理功能
- ✅ 离线模式支持

## 🆘 获取帮助

如果遇到问题：

1. **检查调试日志**: 按照上述步骤启用详细日志
2. **验证环境**: 确保Zotero版本兼容 (7.0+)
3. **重新安装**: 卸载旧版本，安装新版本
4. **重启Zotero**: 某些更改需要重启才能生效
5. **检查API服务器**: 确保 `npm run dev` 正在运行

### 常用调试命令
```bash
# 启动API服务器
npm run dev

# 检查端口占用
netstat -ano | findstr :3000

# 重新构建插件 (如果需要)
# 注意：现在不需要自动生成XPI文件
```

### 联系支持
- 提供详细的调试日志
- 说明Zotero版本和操作系统
- 描述具体的错误现象和重现步骤
