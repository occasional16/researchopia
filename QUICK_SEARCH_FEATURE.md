# 快捷搜索功能说明

## 功能概述

在论文详情页面新增了"快捷搜索"功能，允许用户快速在多个学术平台搜索当前论文。此功能位于论文基本信息和评分区域之间，提供了统一、便捷的学术搜索入口。

## 主要特性

### 1. 多平台支持
支持以下主流学术网站：

**通用搜索平台：**
- Google Scholar（谷歌学术）
- Semantic Scholar（AI 驱动的学术搜索）
- ResearchGate（学术社交网络）

**专业数据库：**
- Web of Science（权威学术数据库）
- PubMed（生物医学文献）
- IEEE Xplore（电子电气工程）
- SpringerLink（Springer 出版社）
- CrossRef（DOI 注册服务）

**论文仓库：**
- Sci-Hub（免费论文全文）
- arXiv（预印本论文库）
- bioRxiv（生物学预印本）

**中文平台：**
- 百度学术
- Scholar Mirror（谷歌学术镜像）
- 中国知网
- 万方数据

### 2. 智能搜索策略
- **优先级：** DOI > 论文标题
- **DOI 搜索：** 当论文有 DOI 时，优先使用 DOI 进行精确搜索
- **标题搜索：** 当论文无 DOI 时，使用论文标题进行搜索
- **URL 编码：** 自动处理中文和特殊字符

### 3. 个性化设置
- **偏好设置：** 用户可以自定义显示哪些搜索网站
- **本地存储：** 用户偏好自动保存到本地存储
- **使用统计：** 记录各网站的使用次数
- **分类管理：** 按网站类型（通用、数据库、仓库、中文）进行分类

### 4. 用户体验优化
- **响应式设计：** 适配不同屏幕尺寸
- **展开收起：** 支持查看更多/收起功能
- **悬停效果：** 丰富的视觉反馈
- **图标标识：** 每个网站都有专门的图标和颜色标识

## 使用方法

### 基本使用
1. 访问任意论文详情页面（`/papers/[id]`）
2. 在论文信息下方找到"快捷搜索"模块
3. 点击任意学术网站按钮
4. 系统将在新标签页中打开对应网站的搜索结果

### 自定义设置
1. 点击快捷搜索模块右上角的"设置"按钮
2. 在弹出的偏好设置窗口中：
   - 勾选/取消勾选要显示的网站
   - 使用快捷操作按钮（全选、全不选、按分类选择）
   - 点击"保存设置"
3. 设置将自动保存，下次访问时生效

## 技术实现

### 组件结构
```
src/components/papers/
├── QuickSearch.tsx          # 主搜索组件
└── SearchPreferences.tsx    # 偏好设置组件
```

### 数据存储
- 用户偏好：`localStorage['quick-search-preferences']`
- 使用统计：`localStorage['quick-search-stats']`

### 搜索URL模式
每个网站都有特定的搜索URL模式：
- DOI 搜索：`https://domain.com/search?q="DOI"`
- 标题搜索：`https://domain.com/search?q=encodeURIComponent(title)`

## 扩展性

### 添加新网站
在 `QuickSearch.tsx` 的 `searchSites` 数组中添加新的搜索网站：

```typescript
{
  name: 'Site Name',
  nameZh: '中文名称',
  icon: <IconComponent className="w-5 h-5" />,
  url: (query, type) => `https://example.com/search?q=${encodeURIComponent(query)}`,
  color: 'text-blue-600',
  bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
  description: '网站描述',
  category: 'general' | 'database' | 'repository' | 'chinese'
}
```

### 自定义搜索逻辑
可以为特定网站实现特殊的搜索逻辑：
```typescript
url: (query, type) => {
  if (type === 'doi') {
    return `https://site.com/doi/${query}`
  } else {
    return `https://site.com/search?title=${encodeURIComponent(query)}`
  }
}
```

## 部署说明

此功能已集成到现有的论文详情页面中，无需额外的部署步骤。确保以下文件已正确放置：
- `src/components/papers/QuickSearch.tsx`
- `src/components/papers/SearchPreferences.tsx`
- `src/app/papers/[id]/page.tsx`（已更新引用）

## 浏览器兼容性

- 现代浏览器（Chrome 60+、Firefox 60+、Safari 12+、Edge 79+）
- 支持 ES6+ 和 localStorage
- 响应式设计兼容移动设备

## 注意事项

1. **第三方网站访问：** 某些学术网站可能需要机构授权或订阅
2. **网络限制：** 在某些网络环境下，部分网站可能无法访问
3. **DOI 格式：** 确保论文 DOI 格式正确，以获得最佳搜索效果
4. **浏览器弹窗：** 确保浏览器允许弹出新窗口

## 后续优化建议

1. **缓存优化：** 添加搜索结果缓存机制
2. **批量搜索：** 支持同时在多个网站搜索
3. **搜索历史：** 记录和管理搜索历史
4. **网站状态检测：** 检测网站可用性并显示状态
5. **个性化推荐：** 基于用户行为推荐相关论文