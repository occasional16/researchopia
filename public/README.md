# Public资源文件夹

这个文件夹包含了网站的静态资源文件。

## 📁 文件说明

### 核心品牌资源
- `favicon.svg` - 网站图标，显示在浏览器标签页
- `logo-main.svg` - 主要Logo，用于网站顶部等显著位置  
- `logo-small.svg` - 小尺寸Logo，用于移动端等空间有限场景

### 功能配置文件
- `manifest.json` - PWA应用配置，支持添加到主屏幕等功能
- `sw.js` - Service Worker文件，提供离线缓存功能
- `user-guide.html` - 用户指南页面，由/guide路由加载显示

### 第三方资源
- `next.svg` - Next.js框架图标
- `vercel.svg` - Vercel部署平台图标

## 🎯 使用方式

这些文件可以直接通过URL访问：
- `https://yoursite.com/favicon.svg`
- `https://yoursite.com/logo-main.svg`
- 等等...

在代码中引用：
```tsx
// 在组件中使用
<Image src="/logo-main.svg" alt="Logo" />

// 在CSS中使用
background-image: url('/logo-small.svg');
```

## ⚠️ 注意事项

- 不要在这个文件夹放置敏感信息
- 所有文件都是公开可访问的
- 建议图片文件使用SVG格式以获得更好的可缩放性
- 修改favicon.svg后需要清除浏览器缓存才能看到变化

---

*最后清理时间: 2025-09-17*  
*清理前文件数: 28个*  
*清理后文件数: 8个*  
*删除的文件: 20个测试、调试、演示文件*