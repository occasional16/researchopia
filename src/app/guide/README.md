# 用户指南系统说明

## 概述

新的用户指南系统采用 **MDX + 组件化** 架构，提供美观、易维护的文档体验。

## 目录结构

```
src/app/guide/
├── page.tsx                      # 主入口页面（导航）
├── guide-config.ts               # 指南配置和路由定义
├── [category]/
│   └── [slug]/
│       └── page.tsx              # 动态路由页面（MDX渲染器）
├── components/
│   ├── GuideLayout.tsx           # 布局组件（侧边栏+内容区）
│   ├── TableOfContents.tsx       # 右侧目录组件
│   ├── CodeBlock.tsx             # 代码块组件（带复制）
│   └── GuideNavigation.tsx       # 上一页/下一页导航
└── content/                      # MDX 内容文件
    ├── getting-started/          # 快速开始
    │   ├── account.mdx
    │   └── overview.mdx
    ├── website/                  # 网站使用
    │   ├── search.mdx
    │   ├── paper-details.mdx
    │   ├── profile.mdx
    │   └── social.mdx
    ├── zotero-plugin/            # Zotero 插件
    │   ├── installation.mdx
    │   ├── view-annotations.mdx
    │   ├── reading-sessions.mdx
    │   └── sync-annotations.mdx
    ├── browser-extension/        # 浏览器扩展
    │   ├── installation.mdx
    │   ├── doi-detection.mdx
    │   ├── quick-access.mdx
    │   └── settings.mdx
    └── best-practices/           # 最佳实践
        ├── reading-tips.mdx
        ├── annotation-sharing.mdx
        ├── privacy-security.mdx
        └── faq.mdx
```

## 技术栈

- **MDX**: Markdown + JSX，支持在文档中嵌入 React 组件
- **Next.js 15**: App Router + 动态路由
- **Tailwind CSS**: 样式系统
- **remark-gfm**: GitHub Flavored Markdown
- **rehype-highlight**: 代码高亮
- **gray-matter**: Frontmatter 解析

## 路由系统

### 主入口

- `/guide` - 导航页面，展示所有分类

### 动态路由

- `/guide/[category]/[slug]` - 具体指南页面
- 例如：`/guide/getting-started/account`

### 配置文件

`guide-config.ts` 定义了所有分类和页面：

```typescript
export const guideConfig: GuideCategory[] = [
  {
    title: '快速开始',
    slug: 'getting-started',
    icon: '🚀',
    items: [
      { title: '账号注册和登录', slug: 'account', ... },
      ...
    ]
  },
  ...
]
```

## MDX 文件格式

每个 MDX 文件包含 frontmatter 和内容：

```mdx
---
title: 页面标题
description: 页面描述
---

# 主标题

正文内容...

## 二级标题

可以使用 JSX 组件：

<div className="bg-blue-50 p-4">
  这是一个提示框
</div>
```

## 添加新指南页面

### 步骤 1: 更新配置

在 `guide-config.ts` 中添加新项：

```typescript
{
  title: '新页面标题',
  slug: 'new-page',
  description: '页面描述',
}
```

### 步骤 2: 创建 MDX 文件

在对应的分类文件夹中创建 `new-page.mdx`：

```mdx
---
title: 新页面标题
description: 页面描述
---

# 内容开始...
```

### 步骤 3: 自动生效

无需其他配置，页面会自动生成并加入导航。

## 样式系统

### Prose 类

MDX 内容自动应用 `.prose` 类，提供统一的排版样式：

- 标题：自动添加 ID 和滚动偏移
- 链接：外部链接在新标签打开
- 代码：内联代码和代码块有不同样式
- 列表、表格、引用：统一样式

### 自定义组件

在 MDX 中可以使用自定义 React 组件：

```mdx
<CodeBlock language="javascript">
const hello = "world";
</CodeBlock>
```

## 响应式设计

- **桌面** (lg+): 侧边栏 + 内容 + 右侧目录
- **平板** (md-lg): 可折叠侧边栏 + 内容
- **手机** (< md): 汉堡菜单 + 内容

## 与 docs/USER-GUIDE.md 的关系

| 特性 | docs/USER-GUIDE.md | 网站用户指南 |
|------|-------------------|-------------|
| **格式** | Markdown | MDX (Markdown + JSX) |
| **用途** | GitHub 文档参考 | 交互式网站展示 |
| **维护** | 完整详细的单一文件 | 模块化的多个文件 |
| **更新** | 版本发布时 | 持续优化 |

**建议**：
- `docs/USER-GUIDE.md` 作为完整的参考文档保留
- 网站指南从中提取核心内容并优化展示
- 两者独立维护，定期同步重要更新

## 性能优化

- ✅ **静态生成**: 所有指南页面在构建时生成
- ✅ **代码分割**: MDX 文件按需加载
- ✅ **图片优化**: 使用 Next.js Image 组件
- ✅ **CDN 缓存**: Cloudflare 自动 CDN 分发

## SEO 优化

- ✅ 每个页面有独立的 title 和 description
- ✅ 语义化 HTML 结构
- ✅ 自动生成 sitemap
- ✅ Open Graph 标签支持

## 待完成功能

### 搜索功能（优先级：高）

使用 Fuse.js 实现客户端全文搜索：

```typescript
// 在 GuideLayout 中添加搜索框
<SearchBar content={allGuideContent} />
```

### 深色模式（优先级：中）

基于 `prefers-color-scheme` 自动切换：

```css
@media (prefers-color-scheme: dark) {
  .prose { color: #e5e5e5; }
}
```

### 多语言支持（优先级：低）

创建 `content-en/` 文件夹存放英文版本。

## 维护建议

### 定期检查

- 检查所有链接是否有效
- 更新截图和示例
- 修正用户反馈的问题

### 版本同步

当功能更新时：
1. 更新对应的 MDX 文件
2. 同步更新 `docs/USER-GUIDE.md`（如果有重大变化）
3. 在 CHANGELOG 中记录

### 性能监控

- 使用 Lighthouse 检查性能
- 确保所有页面加载时间 < 2s
- 优化图片和资源大小

## 问题排查

### MDX 文件不显示

1. 检查文件名是否与 `guide-config.ts` 中的 `slug` 一致
2. 检查 frontmatter 格式是否正确
3. 查看浏览器控制台错误

### 样式不生效

1. 确认使用了 `.prose` 类
2. 检查 Tailwind CSS 配置
3. 清除浏览器缓存

### 导航不更新

1. 重启开发服务器
2. 检查 `guide-config.ts` 语法
3. 清除 Next.js 缓存：`rm -rf .next`

## 贡献指南

欢迎贡献新的指南内容！

1. Fork 项目
2. 在 `content/` 中添加或修改 MDX 文件
3. 更新 `guide-config.ts`（如果添加新页面）
4. 测试本地预览
5. 提交 Pull Request

---

**维护者**: Researchopia Team  
**最后更新**: 2025-11-03  
**版本**: v1.0
