# 🎨 研学港 Logo 使用指南

## 📝 Logo 文件说明

### 主要Logo文件
- **`logo-main.svg`** - 学术港湾主Logo，120x120px，用于首页、大尺寸展示
- **`logo-small.svg`** - 简化版Logo，60x60px，用于导航栏、按钮
- **`favicon.svg`** - 网站图标，32x32px，用于浏览器标签页

### Logo 设计理念
**核心概念：** 学术港湾 + 指引灯塔
- 📚 **书本核心**：代表学术研究和知识积累的根本
- 🏗️ **港湾寓意**：体现研学港作为学者安全停靠的温暖港湾  
- � **灯塔指引**：象征为学术研究指明方向，照亮前路
- 🌊 **港口波浪**：柔和的波浪线条体现包容与流动的知识交流
- 🎯 **温暖色调**：紫色专业感 + 橙色温暖感，营造亲和而权威的氛围

## 🎯 品牌色彩规范

### 主色系
```css
主紫色: #7c3aed  /* 品牌主色，代表深度与专业 */
辅助紫: #a855f7  /* 连接线颜色，代表活力与创新 */
强调橙: #f59e0b  /* 节点颜色，代表智慧与温暖 */
```

### 使用场景色彩搭配
- **专业场合**：主紫色 + 白色背景
- **友好交互**：主紫色 + 辅助紫渐变
- **重点强调**：强调橙色作为CTA按钮或重要信息

## 📐 Logo 尺寸规范

### 标准尺寸
- **大Logo**: 120px × 120px (首页横幅、关于我们页面)
- **中Logo**: 60px × 60px (导航栏、侧边栏)  
- **小Logo**: 32px × 32px (favicon、小图标)
- **微Logo**: 16px × 16px (极小场景，仅显示RH)

### 最小使用尺寸
- ⚠️ Logo不得小于 24px × 24px
- ⚠️ 文字版本不得小于 16px 高度
- ⚠️ 在小尺寸下使用简化版本（仅显示RH）

## 🎪 Logo 变体使用

### 1. 标准彩色版本
```html
<!-- 主要Logo -->
<img src="/logo-main.svg" alt="研学港 ResearchHub" width="120" height="120">

<!-- 小尺寸Logo -->
<img src="/logo-small.svg" alt="研学港" width="60" height="60">
```

### 2. 单色版本（适用于特殊场景）
- **白色版本**：深色背景上使用
- **黑色版本**：浅色背景上使用，印刷材料
- **灰色版本**：中性色调场景

### 3. 简化版本
```html
<!-- 极简版：仅RH字母，用于极小空间 -->
<div class="logo-minimal">RH</div>
```

## 🚫 Logo 使用禁忌

### ❌ 不允许的操作
1. **不得拉伸变形** - 保持Logo原始比例
2. **不得改变颜色** - 除规定的变体外不得随意改色
3. **不得添加效果** - 禁止添加阴影、发光、3D效果
4. **不得旋转倾斜** - Logo必须保持水平垂直
5. **不得与其他图形重叠** - 保持Logo独立性
6. **不得在低对比度背景使用** - 确保Logo清晰可见

### ⚠️ 注意事项
- Logo周围必须保留足够空白空间（至少Logo高度的1/4）
- 在复杂背景上使用时，添加白色或深色背景圆形
- 印刷时确保分辨率不低于300DPI

## 🎨 应用示例

### 网站头部
```html
<nav class="navbar">
  <a href="/" class="logo-container">
    <img src="/logo-small.svg" alt="研学港" width="32" height="32">
    <div class="logo-text">
      <div class="brand-name">研学港</div>
      <div class="brand-sub">ResearchHub</div>
    </div>
  </a>
</nav>
```

### 邮件签名
```html
<div class="email-signature">
  <img src="/logo-small.svg" width="24" height="24" alt="研学港">
  <div>
    <strong>研学港 ResearchHub</strong><br>
    <small>研学并进，智慧共享</small><br>
    <a href="https://research-hub.cn">www.research-hub.cn</a>
  </div>
</div>
```

### 移动应用图标
```html
<!-- 适配iOS/Android的圆角矩形图标 -->
<div class="app-icon" style="
  width: 60px; 
  height: 60px; 
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 20px;
">
  RH
</div>
```

## 📱 响应式使用

### 桌面端 (>768px)
- 使用完整Logo + 品牌名称
- Logo尺寸: 40-60px

### 平板端 (768px-1024px)  
- 使用中等尺寸Logo + 简化文字
- Logo尺寸: 32-40px

### 移动端 (<768px)
- 使用小Logo，可省略副标题
- Logo尺寸: 24-32px

## 🖼️ 品牌应用拓展

### 社交媒体头像
- **尺寸**: 400×400px
- **格式**: PNG/JPG (透明背景用PNG)
- **设计**: 纯色背景 + 居中Logo

### 印刷材料
- **名片**: 使用简化版Logo
- **信封**: Logo放置在左上角
- **文件封面**: 使用大尺寸主Logo

### 周边产品
- **T恤**: 胸前小Logo + 背面大Logo
- **马克杯**: 环绕式Logo设计
- **笔记本**: 右下角小Logo

## 💾 文件格式说明

| 格式 | 用途 | 优点 | 适用场景 |
|------|------|------|---------|
| **SVG** | 网页、UI | 矢量、可缩放、文件小 | 网站、应用界面 |
| **PNG** | 通用 | 透明背景、兼容性好 | 文档、演示、社交媒体 |
| **JPG** | 照片背景 | 文件小、照片质感 | 复杂背景、印刷品 |
| **PDF** | 印刷 | 矢量、印刷质量高 | 名片、手册、大型印刷 |

## 🔄 Logo 更新版本控制

- **版本**: v1.0 (2025.01)
- **设计师**: AI Assistant
- **最后修改**: 2025年1月11日
- **下次评审**: 2025年6月

---

**📞 如有Logo使用疑问，请联系品牌管理团队**
**📧 Email: brand@research-hub.cn**
**🌐 Brand Portal: www.research-hub.cn/brand**
