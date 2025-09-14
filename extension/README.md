# 研学港浏览器扩展

![研学港 Logo](icons/icon48.png)

## 简介

**研学港浏览器扩展** 是研学港（Researchopia）的官方浏览器插件，基于最新的 Manifest V3 规范开发。扩展旨在为学术研究者提供便捷的论文搜索和管理工具，实现"研学并进，智慧共享"的理念。

## 主要功能

### 🔍 智能DOI检测
- 自动检测学术网页中的DOI号码
- 支持多种DOI格式和来源（meta标签、JSON-LD、页面文本、URL等）
- 覆盖主流学术出版商网站（Nature、Science、IEEE、Springer等）

### 📌 悬浮拖拽图标
- 常驻浮动图标，默认显示在网页右上角
- 支持拖拽移动，自动吸附到窗口左右边缘
- DOI检测成功时显示绿色指示器
- 点击图标快速打开研学港侧边栏

### 📖 集成侧边栏
- 点击悬浮图标展开侧边栏
- 直接在侧边栏中加载研学港网站
- 检测到DOI时自动填入搜索框并执行搜索
- 响应式设计，适配不同屏幕尺寸

### 🚀 快速搜索
- 一键在研学港中搜索检测到的DOI
- 支持新标签页打开搜索结果
- 自动填入搜索参数并执行智能搜索

## 支持的网站

扩展在以下学术网站上能够自动检测DOI：

- Nature (nature.com)
- Science (science.org)  
- IEEE (ieee.org)
- Springer (springer.com)
- ScienceDirect (sciencedirect.com)
- Wiley (wiley.com)
- Taylor & Francis (tandfonline.com)
- ACM (acm.org)
- arXiv (arxiv.org)
- PubMed (pubmed.ncbi.nlm.nih.gov)
- DOI.org (doi.org)

## 安装方法

### 开发者模式安装

1. 打开 Chrome 浏览器，进入扩展管理页面：
   ```
   chrome://extensions/
   ```

2. 开启"开发者模式"（右上角开关）

3. 点击"加载已解压的扩展程序"

4. 选择本扩展的 `extension` 文件夹

5. 扩展安装完成，图标将出现在工具栏中

### 本地和在线服务器

扩展支持连接到：
- **生产服务器**（默认）：`https://www.researchopia.com`
- **备用服务器**：`https://academic-rating.vercel.app`
- **本地开发服务器**：`http://localhost:3006` 或其他端口（3000-3009）

可以在扩展设置中切换服务器地址。

## 使用指南

### 基本使用流程

1. **访问学术网页**
   - 打开包含DOI的学术论文页面
   - 扩展会自动检测页面中的DOI

2. **使用悬浮图标**
   - 悬浮图标将出现在页面右侧
   - 检测到DOI时会显示绿色指示器
   - 可拖拽移动图标位置

3. **打开侧边栏**
   - 点击悬浮图标打开研学港侧边栏
   - 检测到的DOI会自动填入搜索框
   - 自动执行搜索并显示结果

4. **扩展弹窗**
   - 点击工具栏中的扩展图标
   - 查看当前页面检测状态
   - 快速访问各项功能

### 高级功能

- **拖拽定位**：长按悬浮图标可拖拽到任意位置，释放后自动吸附到最近边缘
- **快速搜索**：在弹窗中直接点击搜索按钮，在新标签页中打开搜索结果
- **设置管理**：通过Chrome扩展管理页面可调整扩展设置

## 技术特性

- ✅ 基于 Manifest V3，符合最新标准
- ✅ 完整的权限控制，仅请求必要权限
- ✅ 响应式设计，支持各种屏幕尺寸
- ✅ 深色模式和高对比度模式支持
- ✅ 优雅的动画效果和用户交互
- ✅ 跨域安全处理
- ✅ 本地存储配置管理

## 文件结构

```
extension/
├── manifest.json          # 扩展清单文件
├── popup.html            # 弹窗界面
├── popup.js              # 弹窗逻辑
├── background.js         # 后台服务脚本  
├── content.js            # 内容脚本
├── content.css           # 内容脚本样式
├── icons/                # 图标文件夹
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # 说明文档
```

## 开发说明

### 依赖环境

- Chrome 浏览器 88+ 或 Edge 88+
- 研学港本地服务器运行在 localhost:3000-3009

### 调试方法

1. **扩展调试**：在 `chrome://extensions/` 页面点击"检查视图"
2. **内容脚本调试**：在目标网页按F12，在Console中查看输出
3. **后台脚本调试**：在扩展详情页点击"Service Worker"链接

### 自定义配置

扩展支持通过 Chrome Storage API 进行配置：

```javascript
// 获取当前配置
chrome.storage.sync.get([
  'floatingEnabled',    // 是否显示悬浮图标
  'researchopiaUrl',    // 研学港服务器地址
  'autoDetectDOI',      // 是否自动检测DOI
  'sidebarWidth'        // 侧边栏宽度
])

// 更新配置
chrome.storage.sync.set({
  researchopiaUrl: 'https://www.researchopia.com'
})
```

## 版本历史

### v0.1.0 (当前版本)
- ✅ 初始版本发布
- ✅ 实现DOI自动检测功能
- ✅ 实现悬浮拖拽图标
- ✅ 实现集成侧边栏
- ✅ 实现智能搜索功能
- ✅ 支持主流学术网站
- ✅ 完整的用户界面和交互

## 许可证

本扩展与研学港项目保持一致的开源许可证。

## 联系方式

- 项目主页：研学港 (Researchopia)
- 技术支持：通过研学港平台联系开发团队
- 反馈建议：欢迎在研学港平台提交功能建议和问题报告

---

**研学并进，智慧共享** | Researchopia Browser Extension v0.1.0