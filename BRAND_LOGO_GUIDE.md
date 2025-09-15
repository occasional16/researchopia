# 研学港 Researchopia 品牌标识使用指南

## 📋 概览

**品牌名称**: 研学港 Researchopia  
**标语**: 研学并进，智慧共享 | Where Research Meets Community  
**创建日期**: 2025年9月11日  
**版本**: 2.0  

## 🎨 品牌标识设计理念

### 设计概念：学术港湾 (Academic Harbor)
我们的logo设计围绕"港湾"的概念，寓意研学港是学者们的聚集地和知识的港湾：

- **港口波浪** 🌊 - 代表知识的流动和传播
- **学术书本** 📚 - 象征学术研究的核心
- **指引灯塔** 💡 - 寓意为研究者指明方向
- **Researchopia字样** - 体现"研究者的理想国"愿景

### 配色方案
- **主色**: `#7c3aed` (紫色) - 代表智慧、学术权威
- **辅色**: `#a855f7` (淡紫色) - 和谐过渡色彩
- **强调色**: `#fbbf24` (橙色) - 代表创新、活力
- **背景色**: 白色/渐变色 - 确保可读性

## 📁 文件资源

### Logo文件
- `logo-main.svg` (120x120px) - 主Logo，适用于大尺寸展示
- `logo-small.svg` (60x60px) - 小尺寸Logo，适用于导航栏
- `favicon.svg` (32x32px) - 网站图标

### 组件文件
- `BrandLogo.tsx` - 可重用的品牌Logo组件
- `LoadingLogo.tsx` - 加载动画Logo组件

## 🎯 使用场景

### 1. 网站应用
- **首页Hero区域**: 使用130px动画Logo
- **导航栏**: 使用40px小Logo + 悬停效果
- **404页面**: 使用120px完整Logo展示
- **加载页面**: 使用100px动画Loading Logo
- **Favicon**: 浏览器标签页图标

### 2. 尺寸规范
| 使用场景 | 推荐尺寸 | 变体 | 主题 | 动画 |
|---------|---------|------|------|------|
| 首页Hero | 120-150px | icon-only | gradient | ✅ |
| 导航栏 | 32-40px | icon-only | light | ❌ |
| 404页面 | 100-120px | full | light | ✅ |
| 加载页面 | 80-100px | icon-only | gradient | ✅ |
| 移动端 | 24-32px | icon-only | light | ❌ |

## 🎨 主题变体

### Light Theme (浅色主题)
```tsx
<BrandLogo 
  size={120} 
  variant="full" 
  theme="light" 
  animated={false}
/>
```
- 适用于白色/浅色背景
- 文字颜色：深灰色系

### Dark Theme (深色主题)
```tsx
<BrandLogo 
  size={120} 
  variant="full" 
  theme="dark" 
  animated={false}
/>
```
- 适用于深色背景
- 文字颜色：白色系

### Gradient Theme (渐变主题)
```tsx
<BrandLogo 
  size={120} 
  variant="full" 
  theme="gradient" 
  animated={true}
/>
```
- 适用于品牌色渐变背景
- 最具视觉冲击力的版本

## 🔧 组件使用方法

### BrandLogo 组件参数
```tsx
interface BrandLogoProps {
  size?: number          // Logo尺寸 (默认: 120)
  variant?: 'full' | 'icon-only' | 'text-only'  // 变体类型
  theme?: 'light' | 'dark' | 'gradient'          // 主题
  animated?: boolean     // 是否启用动画 (默认: false)
  className?: string     // 额外CSS类
  onClick?: () => void   // 点击事件
}
```

### LoadingLogo 组件参数
```tsx
interface LoadingLogoProps {
  size?: number          // Logo尺寸 (默认: 60)
  showText?: boolean     // 是否显示文字 (默认: false)
  className?: string     // 额外CSS类
}
```

## ✅ 使用规范

### ✅ 正确使用
- 保持Logo的完整性，不要随意拉伸变形
- 在浅色背景使用light主题
- 在深色背景使用dark主题
- 在品牌场景使用gradient主题
- 重要场合启用动画效果
- 保持合适的留白空间

### ❌ 避免使用
- 不要改变Logo的颜色搭配
- 不要在Logo上添加其他元素
- 不要在低对比度背景使用相似主题
- 不要过度缩小导致细节不清晰
- 不要在性能敏感场景滥用动画

## 🚀 最佳实践

### 响应式设计
```tsx
// 桌面端
<BrandLogo size={120} variant="full" />

// 平板端  
<BrandLogo size={80} variant="icon-only" />

// 移动端
<BrandLogo size={60} variant="icon-only" />
```

### 性能优化
- 静态展示场景关闭动画
- 使用SVG格式保证矢量性
- 合理使用组件缓存

### 可访问性
- 为Logo添加合适的alt描述
- 保证颜色对比度符合WCAG标准
- 支持高对比度模式

## 📈 品牌发展

这套品牌标识系统设计灵活，支持未来扩展：
- 可以轻松添加新的主题变体
- 支持动画效果的定制化
- 组件化设计便于维护和更新

---

**版权所有** © 2025 研学港 Researchopia  
**设计团队**: GitHub Copilot AI Assistant  
**技术实现**: Next.js 15 + React 19 + TypeScript
