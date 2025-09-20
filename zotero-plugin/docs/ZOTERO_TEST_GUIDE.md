# Zotero插件测试操作指南

## 问题解决

### 1. API路由问题 ✅
- 已修复 `/api/v1/annotations/batch` 路由，现在支持GET请求
- 浏览器访问会显示API状态信息

### 2. 动态端口检测 ✅
- 添加了自动端口检测功能（3000-3009）
- 插件会自动找到运行中的API服务器

## Zotero测试操作步骤

### 步骤1：启动后端服务器
```bash
# 在项目根目录运行
npm run dev
```
**注意**：端口可能会变化（3000-3009），插件会自动检测。

### 步骤2：在Zotero中安装/重新加载插件

#### 方法A：重新加载现有插件
1. 打开Zotero
2. 按 `Ctrl+Shift+I` 打开开发者工具
3. 在控制台中运行：
```javascript
// 重新加载插件
Zotero.Researchopia.removeFromAllWindows();
Services.scriptloader.loadSubScript("chrome://researchopia/content/researchopia.js");
Services.scriptloader.loadSubScript("chrome://researchopia/content/annotation-sharing.js");
Zotero.Researchopia.main();
```

#### 方法B：安装新的XPI文件
1. 在Zotero中：工具 → 插件和扩展
2. 点击齿轮图标 → 从文件安装插件
3. 选择 `1.xpi` 文件

### 步骤3：准备测试数据
1. 在Zotero中导入一个PDF文档
2. 在Zotero内置阅读器中打开PDF
3. 添加一些标注（高亮、注释等）
4. 保存标注

### 步骤4：测试插件功能

#### 4.1 基本测试
1. 在Zotero主界面中选中包含PDF标注的项目
2. 在右侧面板中找到"研学港 Researchopia"部分
3. 点击"分享标注"按钮
4. 观察结果：
   - **在线模式**：显示"✅ 成功分享 X 个标注到服务器！"
   - **离线模式**：显示"✅ 离线模式：已处理 X 个标注"

#### 4.2 详细测试（使用测试脚本）
1. 打开Zotero开发者工具（Ctrl+Shift+I）
2. 在控制台中运行：
```javascript
// 加载快速测试脚本
Services.scriptloader.loadSubScript("chrome://researchopia/content/quick-test.js");
// 运行测试
quickTest();
```

#### 4.3 网络连接测试
```javascript
// 加载API连接测试脚本
Services.scriptloader.loadSubScript("chrome://researchopia/content/test-api-connection.js");
// 运行网络测试
runFullTest();
```

### 步骤5：查看详细日志
在Zotero开发者控制台中查看以"Researchopia"开头的日志信息：
- 端口检测过程
- 标注检测结果
- 网络连接状态
- API请求响应

## 常见问题解决

### Q1: 显示"未检测到标注"
**解决方案**：
1. 确保选中的是包含PDF标注的项目
2. 检查PDF是否在Zotero内置阅读器中打开过
3. 确认标注已保存到Zotero

### Q2: 显示"服务器离线，将使用离线模式"
**解决方案**：
1. 检查后端服务器是否运行：`npm run dev`
2. 查看终端输出确认端口号
3. 插件会自动检测端口，无需手动配置

### Q3: 插件界面不显示
**解决方案**：
1. 重新加载插件（步骤2）
2. 检查Zotero版本兼容性
3. 查看开发者控制台错误信息

### Q4: API连接失败
**解决方案**：
1. 确认服务器运行在正确端口
2. 检查防火墙设置
3. 尝试手动访问：http://localhost:3000/api/v1/health

## 测试验证清单

- [ ] 后端服务器启动成功
- [ ] Zotero插件加载成功
- [ ] 选中包含PDF标注的项目
- [ ] 点击"分享标注"按钮
- [ ] 看到成功提示（在线或离线模式）
- [ ] 开发者控制台无错误信息

## 预期结果

### 成功情况
- 插件界面显示"研学港 Researchopia"
- 点击按钮后显示标注数量和分享结果
- 开发者控制台显示详细的检测和连接日志

### 失败情况
- 显示错误信息
- 开发者控制台显示错误日志
- 根据错误信息进行相应调试

## 调试技巧

1. **查看日志**：所有操作都有详细日志输出
2. **分步测试**：先测试标注检测，再测试网络连接
3. **检查数据**：确保PDF文档确实包含标注
4. **网络检查**：确认API服务器正常运行

## 联系支持

如果遇到问题，请提供：
1. Zotero版本信息
2. 开发者控制台的错误日志
3. 后端服务器的运行状态
4. 具体的操作步骤和结果
