# 研学港浏览器扩展安装指南

## 快速安装步骤

### 1. 准备研学港本地服务器
确保研学港本地服务器正在运行：

```bash
cd academic-rating
npm run dev
```

服务器默认运行在 `http://localhost:3000`

### 2. 安装浏览器扩展

1. 打开 Chrome 浏览器，在地址栏输入：
   ```
   chrome://extensions/
   ```

2. 在页面右上角开启"开发者模式"

3. 点击"加载已解压的扩展程序"按钮

4. 选择本项目中的 `extension` 文件夹

5. 点击"选择文件夹"完成安装

### 3. 验证安装
- 工具栏中应出现研学港扩展图标
- 点击图标查看扩展弹窗
- 访问学术网站测试DOI检测功能

## 测试建议

### 推荐测试网站
1. **Nature论文**：https://www.nature.com/articles/s41467-025-62625-w
2. **IEEE论文**：https://ieeexplore.ieee.org/document/[任意论文ID]
3. **arXiv论文**：https://arxiv.org/abs/[任意论文ID]

### 测试功能清单
- [ ] 自动检测DOI号
- [ ] 悬浮图标显示
- [ ] 拖拽图标移动
- [ ] 边缘自动吸附
- [ ] 点击打开侧边栏
- [ ] 自动搜索功能
- [ ] 跳转到研学港网站

## 常见问题

### Q: 扩展图标没有出现怎么办？
A: 检查扩展是否成功加载，在 chrome://extensions/ 页面确认扩展状态为"已启用"

### Q: 检测不到DOI怎么办？
A: 确保访问的是支持的学术网站，并且页面包含有效的DOI信息

### Q: 侧边栏显示错误页面？
A: 检查本地研学港服务器是否正在运行，默认地址为 localhost:3000

### Q: 如何卸载扩展？
A: 在 chrome://extensions/ 页面找到研学港扩展，点击"移除"按钮

## 开发者选项

### 调试扩展
- 弹窗调试：右键点击扩展图标 > "检查弹出式窗口"
- 内容脚本调试：在目标页面按F12，在Console中查看扩展日志
- 后台脚本调试：在扩展详情页点击"Service Worker"

### 自定义配置
可以通过浏览器开发者工具修改扩展设置：

```javascript
// 在控制台中执行
chrome.storage.sync.set({
  researchopiaUrl: 'http://localhost:3001',  // 修改服务器地址
  sidebarWidth: 500,                         // 修改侧边栏宽度
  floatingEnabled: true                      // 启用/禁用悬浮图标
});
```

---

安装成功后，您就可以在支持的学术网站上享受研学港扩展带来的便捷搜索体验了！