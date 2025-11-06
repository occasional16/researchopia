# 用户指南系统重构日志

**日期**: 2025-11-03  
**版本**: v1.0  
**类型**: 完全重构

## 变更摘要

将原有的简单用户指南页面（带 iframe 嵌入）完全重构为现代化的 MDX + 组件化系统。

## 主要变更

### 1. 技术架构升级 ✨

**之前**:
- 简单的 React 页面 + iframe 嵌入静态 HTML
- 样式简陋，缺乏交互性
- 难以维护和更新

**现在**:
- MDX (Markdown + JSX) 内容系统
- 组件化布局和导航
- 动态路由和静态生成
- 现代化 UI 设计

### 2. 目录结构 📁

创建了完整的模块化目录：

```
src/app/guide/
├── page.tsx                    # 美观的导航首页
├── guide-config.ts             # 集中配置
├── [category]/[slug]/          # 动态路由
├── components/                 # 共享组件
│   ├── GuideLayout.tsx         # 侧边栏布局
│   ├── TableOfContents.tsx     # 右侧目录
│   ├── CodeBlock.tsx           # 代码块（带复制）
│   └── GuideNavigation.tsx     # 上一页/下一页
└── content/                    # MDX 内容
    ├── getting-started/
    ├── website/
    ├── zotero-plugin/
    ├── browser-extension/
    └── best-practices/
```

### 3. 内容组织 📝

将 `docs/USER-GUIDE.md` 的内容拆分为 18 个独立的 MDX 文件：

**快速开始** (2 个):
- 账号注册和登录
- 平台概览

**网站使用** (4 个):
- 搜索和浏览论文
- 查看论文详情
- 管理个人资料
- 社交互动

**Zotero 插件** (4 个):
- 安装和配置
- 查看社区标注
- 共读会话
- 同步个人标注

**浏览器扩展** (4 个):
- 安装扩展
- DOI 自动识别
- 快速访问论文
- 自定义设置

**最佳实践** (4 个):
- 高效阅读技巧
- 标注分享策略
- 隐私和安全
- 常见问题 FAQ

### 4. UI/UX 改进 🎨

#### 主入口页面
- 渐变色头部背景
- 卡片式分类展示
- 每个分类显示子项目列表
- 响应式网格布局
- 快速访问链接区域

#### 指南详情页
- 三栏布局（侧边栏 + 内容 + 目录）
- 响应式设计（移动端汉堡菜单）
- 代码块一键复制
- 上一页/下一页导航
- 锚点平滑滚动

#### 视觉元素
- Emoji 图标
- 彩色提示框
- 网格布局卡片
- 渐变色背景
- 悬停动画效果

### 5. 技术实现 ⚙️

#### 依赖包
```json
{
  "@next/mdx": "^15.x",
  "@mdx-js/loader": "^3.x",
  "@mdx-js/react": "^3.x",
  "remark-gfm": "^4.x",
  "rehype-highlight": "^7.x",
  "rehype-slug": "^6.x",
  "rehype-autolink-headings": "^7.x",
  "gray-matter": "^4.x",
  "fuse.js": "^7.x"
}
```

#### Next.js 配置
- 支持 `.md` 和 `.mdx` 页面扩展
- Remark 和 Rehype 插件集成
- MDX 组件映射（自定义代码块、链接、标题）

#### 样式系统
- 自定义 `.prose` 类用于 MDX 内容
- Tailwind CSS 工具类
- 响应式断点
- 深色模式准备（待实现）

### 6. SEO 优化 🔍

- 每个页面独立的 `<title>` 和 `<meta description>`
- 语义化 HTML 结构（`<article>`, `<nav>`, `<aside>`）
- 自动生成标题锚点
- Open Graph 标签支持

### 7. 性能优化 ⚡

- 静态生成（SSG）所有指南页面
- MDX 文件按需加载
- 图片自动优化（Next.js Image）
- Vercel CDN 全球分发

## 文件清单

### 新增文件 (26 个)

**配置和组件**:
- `src/app/guide/guide-config.ts`
- `src/app/guide/components/GuideLayout.tsx`
- `src/app/guide/components/TableOfContents.tsx`
- `src/app/guide/components/CodeBlock.tsx`
- `src/app/guide/components/GuideNavigation.tsx`
- `src/app/guide/[category]/[slug]/page.tsx`
- `mdx-components.tsx`

**MDX 内容文件 (18 个)**:
- `content/getting-started/account.mdx`
- `content/getting-started/overview.mdx`
- `content/website/search.mdx`
- `content/website/paper-details.mdx`
- `content/website/profile.mdx`
- `content/website/social.mdx`
- `content/zotero-plugin/installation.mdx`
- `content/zotero-plugin/view-annotations.mdx`
- `content/zotero-plugin/reading-sessions.mdx`
- `content/zotero-plugin/sync-annotations.mdx`
- `content/browser-extension/installation.mdx`
- `content/browser-extension/doi-detection.mdx`
- `content/browser-extension/quick-access.mdx`
- `content/browser-extension/settings.mdx`
- `content/best-practices/reading-tips.mdx`
- `content/best-practices/annotation-sharing.mdx`
- `content/best-practices/privacy-security.mdx`
- `content/best-practices/faq.mdx`

**文档**:
- `src/app/guide/README.md`

### 修改文件 (3 个)

- `src/app/guide/page.tsx` - 完全重写
- `next.config.ts` - 添加 MDX 支持
- `src/app/globals.css` - 添加 `.prose` 样式

## 待完成功能

### 优先级：高
- [ ] 全文搜索功能（使用 Fuse.js）
- [ ] 更多 MDX 内容完善（当前为示例/占位符）

### 优先级：中
- [ ] 深色模式支持
- [ ] 用户反馈机制（"这个页面有帮助吗？"）
- [ ] 页面浏览统计

### 优先级：低
- [ ] 多语言支持（英文版本）
- [ ] 打印样式优化
- [ ] PDF 导出功能

## 测试清单

### 功能测试
- [x] 主入口页面显示正常
- [x] 动态路由生成正确
- [x] 侧边栏导航工作
- [x] 移动端汉堡菜单
- [x] 代码块复制功能
- [x] 上一页/下一页导航
- [x] 外部链接在新标签打开

### 兼容性测试
- [ ] Chrome/Edge/Firefox/Safari
- [ ] 桌面/平板/手机
- [ ] 不同屏幕尺寸

### 性能测试
- [ ] Lighthouse 评分 > 90
- [ ] 首屏加载时间 < 2s
- [ ] 页面切换流畅

## 影响范围

### 用户端
- ✅ **正面**: 更美观、更易用的用户指南
- ✅ **正面**: 更好的移动端体验
- ⚠️ **注意**: 旧的 iframe 方式已移除

### 开发端
- ✅ **正面**: 更容易维护和更新内容
- ✅ **正面**: 模块化结构便于扩展
- ⚠️ **学习成本**: 需要了解 MDX 语法

### SEO
- ✅ **正面**: 更好的搜索引擎优化
- ✅ **正面**: 每个页面独立索引

## 数据迁移

- ✅ 原有的 `docs/USER-GUIDE.md` 保持不变
- ✅ 内容已提取并改写为 MDX 格式
- ✅ 两套文档并存，各有用途

## 回滚计划

如果出现问题，可以：
1. 恢复 `src/app/guide/page.tsx` 到之前版本
2. 保留 `/user-guide.html` 作为备用
3. 删除 `content/` 和 `components/` 文件夹

## 文档更新

- [x] 创建 `src/app/guide/README.md`
- [x] 创建本更新日志
- [ ] 更新主 README.md（提及新的用户指南）
- [ ] 更新 CHANGELOG.md

## 相关链接

- **GitHub Issue**: (待创建)
- **Pull Request**: (待创建)
- **预览链接**: https://researchopia.com/guide

## 致谢

感谢社区的反馈和建议！

---

**作者**: Researchopia Team  
**审核**: 待审核  
**状态**: ✅ 完成
