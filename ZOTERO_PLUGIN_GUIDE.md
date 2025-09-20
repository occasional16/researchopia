# 研学港 Zotero插件增强版使用指南

## 🎯 问题解决方案

### 1. 登录问题修复

**问题**: 面板一直显示未登录
**解决方案**: 
- 新增智能认证管理器，支持多种登录方式
- 自动检测可用端口（3000-3009）
- 支持token自动刷新和验证

### 2. 分享功能修复

**问题**: 点击分享标注后显示"分享失败：未知错误"
**解决方案**:
- 修复API请求错误处理
- 添加详细的错误信息显示
- 支持多端口自动切换

### 3. 社区标注显示修复

**问题**: 社区标注下方显示虚假信息而非真实标注
**解决方案**:
- 修复标注数据获取逻辑
- 区分"我的标注"和"社区标注"
- 添加数据验证和错误处理

### 4. 多端口支持

**问题**: localhost端口经常被占用
**解决方案**:
- 支持端口3000-3009自动检测
- 动态切换可用端口
- 更新manifest.json权限配置

## 🚀 安装方法

### 方法1: 使用构建脚本（推荐）

```bash
# Linux/Mac
npm run zotero:build

# Windows
npm run zotero:build:win
```

### 方法2: 手动安装

1. 将以下文件复制到Zotero插件目录：
   - `researchopia-enhanced-v2.js` → `researchopia.js`
   - `enhanced-styles-v2.css` → `style.css`
   - `auth-manager-v2.js` → `auth-manager.js`
   - `manifest.json`
   - `prefs.js`
   - `bootstrap.js`（新建）

2. 创建 `bootstrap.js` 文件：

```javascript
/*
 * 研学港 Zotero插件 - Bootstrap
 */

// 加载认证管理器
Services.scriptloader.loadSubScript(Zotero.Researchopia.rootURI + 'auth-manager.js');

// 初始化认证管理器
Zotero.Researchopia.AuthManager.init();

// 加载样式
const styleSheet = Zotero.Researchopia.rootURI + 'style.css';
const styleSheetService = Components.classes['@mozilla.org/content/style-sheet-service;1']
  .getService(Components.interfaces.nsIStyleSheetService);
const ioService = Components.classes['@mozilla.org/network/io-service;1']
  .getService(Components.interfaces.nsIIOService);
const uri = ioService.newURI(styleSheet, null, null);
styleSheetService.loadAndRegisterSheet(uri, styleSheetService.USER_SHEET);

// 插件启动
function startup({ id, version, rootURI }) {
  Zotero.Researchopia.init({ id, version, rootURI });
}

// 插件关闭
function shutdown() {
  try {
    Zotero.Researchopia.log('Plugin shutdown completed');
  } catch (error) {
    Zotero.Researchopia.log('Error during shutdown: ' + error.message);
  }
}

// 安装
function install() {
  Zotero.Researchopia.log('Plugin installed');
}

// 卸载
function uninstall() {
  Zotero.Researchopia.log('Plugin uninstalled');
}
```

## 🔧 功能特性

### 1. 智能认证管理
- 自动检测可用端口
- 支持多种登录方式
- Token自动刷新
- 登录状态持久化

### 2. 标注管理
- 我的标注：显示Zotero中的本地标注
- 社区标注：显示其他用户分享的标注
- 标注同步：将本地标注同步到云端
- 标注分享：将标注设为公开分享

### 3. 实时协作
- 多用户在线状态显示
- 实时标注同步
- 协作会话管理

### 4. 现代化界面
- 响应式设计
- 标签页式布局
- 实时状态指示
- 用户友好反馈

## 📋 使用步骤

### 1. 启动服务

```bash
# 启动完整服务
npm run dev:full

# 或分别启动
npm run dev          # Web服务
npm run websocket:enhanced  # WebSocket服务
```

### 2. 安装插件

1. 运行构建脚本生成插件包
2. 在Zotero中安装生成的 `.xpi` 文件
3. 重启Zotero

### 3. 使用插件

1. **选择文献**: 在Zotero中选择任意有DOI的文献
2. **查看面板**: 在右侧面板查看"研学港 Researchopia"标签页
3. **登录**: 点击"登录"按钮进行身份验证
4. **管理标注**: 
   - 查看"我的标注"标签页查看本地标注
   - 查看"社区标注"标签页查看共享标注
   - 点击"同步标注"上传本地标注
   - 点击"分享标注"将标注设为公开

## 🛠️ 故障排除

### 1. 插件无法加载

**症状**: Zotero中看不到研学港面板
**解决方案**:
- 检查Zotero版本（需要7.0+）
- 确认插件文件完整性
- 查看Zotero错误日志
- 重新安装插件

### 2. 连接失败

**症状**: 显示"未连接"状态
**解决方案**:
- 确保研学港服务器正在运行
- 检查端口是否被占用
- 尝试重启服务器
- 检查防火墙设置

### 3. 登录失败

**症状**: 点击登录无响应或显示错误
**解决方案**:
- 确保网络连接正常
- 检查服务器状态
- 清除浏览器缓存
- 尝试手动输入API地址

### 4. 标注同步失败

**症状**: 点击同步标注显示错误
**解决方案**:
- 确保已登录
- 检查文献是否有DOI
- 确认服务器API正常
- 查看错误日志

### 5. 社区标注显示异常

**症状**: 显示虚假信息或加载失败
**解决方案**:
- 确保已登录
- 检查网络连接
- 刷新标注列表
- 检查服务器数据

## 🔍 调试方法

### 1. 查看日志

在Zotero中打开开发者工具：
1. 按 `Ctrl+Shift+I` (Windows) 或 `Cmd+Option+I` (Mac)
2. 查看Console标签页
3. 查找以 `[timestamp] Researchopia:` 开头的日志

### 2. 检查网络请求

1. 打开开发者工具
2. 切换到Network标签页
3. 执行操作（如登录、同步）
4. 查看API请求和响应

### 3. 验证配置

检查以下配置是否正确：
- API端口是否可用
- 服务器是否运行
- 数据库连接是否正常
- 认证配置是否正确

## 📞 技术支持

### 常见问题

1. **Q: 为什么看不到研学港面板？**
   A: 确保选择了有DOI的文献，并且插件已正确安装。

2. **Q: 登录后还是显示未登录？**
   A: 尝试刷新页面或重启Zotero，检查token是否有效。

3. **Q: 社区标注显示空白？**
   A: 确保服务器正在运行，并且有用户分享了标注。

4. **Q: 同步标注失败？**
   A: 检查网络连接和服务器状态，确保文献有DOI。

### 获取帮助

- **GitHub Issues**: 报告bug和功能请求
- **文档**: 查看项目文档
- **社区**: 加入开发者社区讨论

## 🎉 更新日志

### v2.0.0 (最新版本)

**新增功能**:
- 智能认证管理系统
- 多端口自动检测
- 现代化界面设计
- 实时协作功能

**问题修复**:
- 修复登录状态显示问题
- 修复分享标注错误
- 修复社区标注显示异常
- 修复端口占用问题

**性能优化**:
- 优化网络请求处理
- 改进错误处理机制
- 提升用户体验

---

**注意**: 使用前请确保研学港服务器正在运行，并且网络连接正常。如有问题，请查看故障排除部分或联系技术支持。
