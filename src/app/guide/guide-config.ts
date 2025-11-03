export interface GuideItem {
  title: string;
  slug: string;
  description: string;
  icon?: string;
}

export interface GuideCategory {
  title: string;
  slug: string;
  description: string;
  icon: string;
  items: GuideItem[];
}

export const guideConfig: GuideCategory[] = [
  {
    title: '快速开始',
    slug: 'getting-started',
    description: '快速了解并开始使用 Researchopia',
    icon: '🚀',
    items: [
      {
        title: '账号注册和登录',
        slug: 'account',
        description: '创建账号并登录到 Researchopia',
      },
      {
        title: '平台概览',
        slug: 'overview',
        description: '了解 Researchopia 的核心功能和特性',
      },
    ],
  },
  {
    title: '网站使用',
    slug: 'website',
    description: '学习如何使用 Researchopia 网站功能',
    icon: '🌐',
    items: [
      {
        title: '搜索和浏览论文',
        slug: 'search',
        description: '使用强大的搜索功能查找学术论文',
      },
      {
        title: '查看论文详情',
        slug: 'paper-details',
        description: '深入了解论文信息和社区标注',
      },
      {
        title: '管理个人资料',
        slug: 'profile',
        description: '编辑和管理您的个人信息',
      },
      {
        title: '社交互动',
        slug: 'social',
        description: '关注研究者、点赞和评论标注',
      },
    ],
  },
  {
    title: 'Zotero 插件',
    slug: 'zotero-plugin',
    description: '将 Researchopia 集成到 Zotero 中',
    icon: '📚',
    items: [
      {
        title: '安装和配置',
        slug: 'installation',
        description: '安装 Zotero 插件并完成初始配置',
      },
      {
        title: '查看社区标注',
        slug: 'view-annotations',
        description: '在 Zotero 中查看和互动社区标注',
      },
      {
        title: '共读会话',
        slug: 'reading-sessions',
        description: '创建和加入实时协作阅读会话',
      },
      {
        title: '同步个人标注',
        slug: 'sync-annotations',
        description: '自动同步您的标注到云端',
      },
    ],
  },
  {
    title: '浏览器扩展',
    slug: 'browser-extension',
    description: '在任何网页上快速访问论文信息',
    icon: '🔌',
    items: [
      {
        title: '安装扩展',
        slug: 'installation',
        description: '在浏览器中安装 Researchopia 扩展',
      },
      {
        title: 'DOI 自动识别',
        slug: 'doi-detection',
        description: '自动识别学术网页上的 DOI',
      },
      {
        title: '快速访问论文',
        slug: 'quick-access',
        description: '使用悬浮图标和侧边栏访问论文',
      },
      {
        title: '自定义设置',
        slug: 'settings',
        description: '配置扩展的行为和外观',
      },
    ],
  },
  {
    title: '最佳实践',
    slug: 'best-practices',
    description: '学习高效使用 Researchopia 的技巧',
    icon: '💡',
    items: [
      {
        title: '高效阅读技巧',
        slug: 'reading-tips',
        description: '分层阅读法和标注策略',
      },
      {
        title: '标注分享策略',
        slug: 'annotation-sharing',
        description: '撰写高质量标注和礼仪规范',
      },
      {
        title: '隐私和安全',
        slug: 'privacy-security',
        description: '了解数据隐私和账号安全',
      },
      {
        title: '常见问题 FAQ',
        slug: 'faq',
        description: '查找常见问题的解答',
      },
    ],
  },
];

// 获取所有指南页面路径（用于生成静态页面）
export function getAllGuidePaths() {
  const paths: { category: string; slug: string }[] = [];
  guideConfig.forEach((category) => {
    category.items.forEach((item) => {
      paths.push({
        category: category.slug,
        slug: item.slug,
      });
    });
  });
  return paths;
}

// 根据分类和slug查找指南项
export function findGuideItem(categorySlug: string, itemSlug: string) {
  const category = guideConfig.find((cat) => cat.slug === categorySlug);
  if (!category) return null;
  const item = category.items.find((i) => i.slug === itemSlug);
  if (!item) return null;
  return { category, item };
}

// 获取指南项的前一个和后一个（用于导航）
export function getAdjacentGuides(categorySlug: string, itemSlug: string) {
  const paths = getAllGuidePaths();
  const currentIndex = paths.findIndex(
    (p) => p.category === categorySlug && p.slug === itemSlug
  );
  
  return {
    prev: currentIndex > 0 ? paths[currentIndex - 1] : null,
    next: currentIndex < paths.length - 1 ? paths[currentIndex + 1] : null,
  };
}
