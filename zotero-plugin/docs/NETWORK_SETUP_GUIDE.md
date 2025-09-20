# Zotero插件网络配置指南

## 问题描述
当点击"分享标注"按钮时，如果显示"NetworkError when attempting to fetch resource"，说明插件无法连接到后端API服务器。

## 解决方案

### 方案1：启动后端服务器（推荐）

1. **启动Researchopia后端服务**：
   ```bash
   # 在项目根目录运行
   npm run dev
   # 或者
   npm start
   ```

2. **验证服务器运行**：
   - 打开浏览器访问：http://localhost:3000/api/v1/health
   - 应该看到服务器响应

3. **重新测试插件**：
   - 在Zotero中重新加载插件
   - 点击"分享标注"按钮
   - 现在应该能正常分享到服务器

### 方案2：使用离线模式（当前已实现）

插件现在支持离线模式，当检测到服务器不可用时，会自动切换到离线模式：

1. **离线模式功能**：
   - 自动检测服务器连接状态
   - 服务器离线时自动切换到离线模式
   - 显示"离线模式：已处理 X 个标注"的提示
   - 标注数据会在本地处理（模拟分享）

2. **离线模式提示**：
   - ✅ 离线模式：已处理 X 个标注
   - 标注已保存到本地（离线模式）

### 方案3：配置不同的API地址

如果需要连接到不同的服务器，可以修改配置：

1. **通过Zotero配置**：
   ```javascript
   // 在Zotero开发者控制台中运行
   Zotero.Prefs.set('extensions.researchopia.apiBase', 'http://your-server:port/api/v1', true);
   ```

2. **修改默认配置**：
   编辑 `config.js` 文件中的 `apiBase` 值

## 网络错误类型

### 1. NetworkError
- **原因**：无法连接到服务器
- **解决**：启动后端服务器或使用离线模式

### 2. CORS错误
- **原因**：跨域请求被阻止
- **解决**：确保后端服务器配置了正确的CORS头

### 3. 超时错误
- **原因**：服务器响应时间过长
- **解决**：检查服务器性能或增加超时时间

## 调试步骤

### 1. 检查服务器状态
```javascript
// 在Zotero开发者控制台中运行
fetch('http://localhost:3000/api/v1/health')
  .then(response => console.log('服务器状态:', response.status))
  .catch(error => console.log('服务器连接失败:', error));
```

### 2. 测试插件网络功能
```javascript
// 运行网络测试
Services.scriptloader.loadSubScript("chrome://researchopia/content/test-annotation-fix.js");
testAnnotationFix();
```

### 3. 查看详细日志
在Zotero开发者控制台中查看以"Researchopia-Annotation:"开头的日志信息

## 配置选项

### API配置
- `apiBase`: API服务器地址（默认：http://localhost:3000/api/v1）
- `apiTimeout`: 请求超时时间（默认：10000ms）
- `retryAttempts`: 重试次数（默认：3）

### 离线模式配置
- 自动检测服务器状态
- 网络错误时自动切换
- 显示离线模式提示

## 常见问题

### Q: 为什么显示"服务器未运行或无法连接"？
A: 后端API服务器没有启动，请运行 `npm run dev` 启动服务器。

### Q: 离线模式是什么意思？
A: 当服务器不可用时，插件会自动切换到离线模式，在本地处理标注数据，模拟分享功能。

### Q: 如何连接到远程服务器？
A: 修改 `apiBase` 配置为远程服务器地址，确保服务器支持CORS。

### Q: 如何查看详细的网络错误信息？
A: 在Zotero开发者控制台中查看日志，或运行调试脚本。

## 版本信息
- 修复版本：2024.12.19
- 支持模式：在线模式 + 离线模式
- 兼容性：Zotero 7.x, 8.0 beta, 8.0+
