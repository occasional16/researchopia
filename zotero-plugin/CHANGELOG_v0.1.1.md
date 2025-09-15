# 研学港 Researchopia - 更新日志 v0.1.1

## 本次更新内容

### ✅ 图标设计统一化
**问题**：各尺寸图标设计不一致
**解决**：将所有图标文件统一使用logo-main.svg的设计风格

**更新的文件**：
- `icons/icon16.svg` - 16x16像素版本
- `icons/icon32.svg` - 32x32像素版本  
- `icons/icon48.svg` - 48x48像素版本
- `icons/icon96.svg` - 96x96像素版本
- `icons/icon128.svg` - 128x128像素版本

**设计特色**：
- 紫色主调 (#7c3aed, #8b5cf6, #a855f7)
- 文档/书本图标表示学术研究
- 灯泡图标表示洞察和发现
- 波浪纹理体现知识流动
- 统一的Researchopia品牌标识

### ✅ Item Pane头部对齐修复  
**问题**：插件标题与按钮整体与折叠箭头不在同一行高，按钮下方被容器遮挡
**解决**：优化CSS样式确保与标准Item Pane对齐

**修复详情**：
- 增加header高度从26px到32px，匹配Zotero标准
- 调整按钮高度和垂直间距，防止被遮挡
- 添加专门的Item Pane section样式覆盖
- 确保标题和按钮垂直居中对齐

**CSS更新**：
```css
.academic-rating-header {
  height: 32px;
  min-height: 32px;
  line-height: 32px;
}

.academic-rating-btn {
  height: 28px;
  margin: 2px 0;
}

/* Zotero Item Pane 特定样式 */
.zotero-item-pane-section[data-pane-id*="researchopia"] .zotero-item-pane-section-header {
  min-height: 32px !important;
  display: flex !important;
  align-items: center !important;
}
```

## 视觉效果改进

### 之前的问题
- 图标设计不统一，缺乏品牌一致性
- Item Pane头部高度不匹配，视觉不协调  
- 按钮位置偏移，可能被容器裁切

### 修复后的效果
- 所有图标采用统一的Researchopia设计语言
- Header与Zotero标准Item Pane完全对齐
- 按钮正确显示，无遮挡问题
- 整体视觉与Reference插件等原生组件保持一致

## 手动构建说明

请按照以下步骤重新打包插件：

1. **选择文件**：在当前目录中选择所有文件和文件夹，**排除**：
   - `*.ps1` 脚本文件
   - `*.xpi` 旧版本文件  
   - `temp_*` 临时文件

2. **创建压缩包**：右键 -> 发送到 -> 压缩文件夹

3. **重命名**：改名为 `researchopia-v0.1.1.xpi`

4. **安装测试**：在Zotero中安装新版本

## 预期效果

安装后你应该看到：
- 所有位置的图标都采用统一的紫色Researchopia设计
- Item Pane中的插件头部与其他section完美对齐
- "刷新"和"在浏览器打开"按钮正确显示，无遮挡

## 文件清单

确保XPI包中包含以下内容：
```
manifest.json
bootstrap.js  
researchopia.js
style.css
icons/
  ├── icon16.svg    (新设计)
  ├── icon32.svg    (新设计)
  ├── icon48.svg    (新设计)
  ├── icon96.svg    (新设计)
  ├── icon128.svg   (新设计)
  └── logo-main.svg (原始设计)
locale/
  ├── en-US/researchopia.ftl
  └── zh-CN/researchopia.ftl
```