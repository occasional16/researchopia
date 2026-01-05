// Static MDX imports for Cloudflare Workers compatibility
// All guide MDX files must be imported here for production builds
// Note: fs module is NOT available in Cloudflare Workers, so frontmatter is defined inline

// Getting Started
import GettingStartedAccount from './getting-started/account.mdx'
import GettingStartedOverview from './getting-started/overview.mdx'

// Website
import WebsiteSearch from './website/search.mdx'
import WebsitePaperDetails from './website/paper-details.mdx'
import WebsiteProfile from './website/profile.mdx'
import WebsiteSocial from './website/social.mdx'

// Zotero Plugin
import ZoteroInstallation from './zotero-plugin/installation.mdx'
import ZoteroSyncAnnotations from './zotero-plugin/sync-annotations.mdx'
import ZoteroViewAnnotations from './zotero-plugin/view-annotations.mdx'
import ZoteroReadingSessions from './zotero-plugin/reading-sessions.mdx'

// Browser Extension
import ExtensionInstallation from './browser-extension/installation.mdx'
import ExtensionQuickAccess from './browser-extension/quick-access.mdx'
import ExtensionDoiDetection from './browser-extension/doi-detection.mdx'
import ExtensionSettings from './browser-extension/settings.mdx'

// Best Practices
import BestPracticesAnnotationSharing from './best-practices/annotation-sharing.mdx'
import BestPracticesReadingTips from './best-practices/reading-tips.mdx'
import BestPracticesPrivacySecurity from './best-practices/privacy-security.mdx'
import BestPracticesFaq from './best-practices/faq.mdx'

// Type definitions
type MDXComponent = React.ComponentType<Record<string, unknown>>

interface GuideEntry {
  component: MDXComponent
  frontmatter: {
    title: string
    description: string
  }
}

// Static content map with frontmatter (no fs needed)
export const mdxContentMap: Record<string, Record<string, GuideEntry>> = {
  'getting-started': {
    'account': {
      component: GettingStartedAccount,
      frontmatter: { title: '账号注册和登录', description: '创建账号并登录到 Researchopia' }
    },
    'overview': {
      component: GettingStartedOverview,
      frontmatter: { title: '平台概览', description: '快速了解 Researchopia 的核心功能' }
    },
  },
  'website': {
    'search': {
      component: WebsiteSearch,
      frontmatter: { title: '搜索论文', description: '使用智能搜索查找学术论文' }
    },
    'paper-details': {
      component: WebsitePaperDetails,
      frontmatter: { title: '论文详情页', description: '了解论文详情页的功能和信息' }
    },
    'profile': {
      component: WebsiteProfile,
      frontmatter: { title: '个人主页', description: '管理您的个人资料和活动' }
    },
    'social': {
      component: WebsiteSocial,
      frontmatter: { title: '社交功能', description: '关注用户和查看动态' }
    },
  },
  'zotero-plugin': {
    'installation': {
      component: ZoteroInstallation,
      frontmatter: { title: 'Zotero 插件安装', description: '下载并安装 Researchopia Zotero 插件' }
    },
    'sync-annotations': {
      component: ZoteroSyncAnnotations,
      frontmatter: { title: '同步标注', description: '将 Zotero 标注同步到 Researchopia' }
    },
    'view-annotations': {
      component: ZoteroViewAnnotations,
      frontmatter: { title: '查看标注', description: '在 Zotero 中查看共享标注' }
    },
    'reading-sessions': {
      component: ZoteroReadingSessions,
      frontmatter: { title: '阅读会话', description: '创建和加入实时阅读会话' }
    },
  },
  'browser-extension': {
    'installation': {
      component: ExtensionInstallation,
      frontmatter: { title: '扩展安装', description: '安装 Researchopia 浏览器扩展' }
    },
    'quick-access': {
      component: ExtensionQuickAccess,
      frontmatter: { title: '快捷访问', description: '使用扩展快速访问 Researchopia 功能' }
    },
    'doi-detection': {
      component: ExtensionDoiDetection,
      frontmatter: { title: 'DOI 检测', description: '自动检测网页中的论文 DOI' }
    },
    'settings': {
      component: ExtensionSettings,
      frontmatter: { title: '扩展设置', description: '配置浏览器扩展选项' }
    },
  },
  'best-practices': {
    'annotation-sharing': {
      component: BestPracticesAnnotationSharing,
      frontmatter: { title: '标注分享技巧', description: '如何有效分享和使用标注' }
    },
    'reading-tips': {
      component: BestPracticesReadingTips,
      frontmatter: { title: '阅读技巧', description: '提高学术阅读效率的建议' }
    },
    'privacy-security': {
      component: BestPracticesPrivacySecurity,
      frontmatter: { title: '隐私和安全', description: '了解数据保护和安全设置' }
    },
    'faq': {
      component: BestPracticesFaq,
      frontmatter: { title: '常见问题', description: '常见问题解答' }
    },
  },
}

// Helper function to get MDX component
export function getMDXContent(category: string, slug: string): MDXComponent | null {
  const categoryMap = mdxContentMap[category]
  if (!categoryMap) return null
  return categoryMap[slug]?.component || null
}

// Helper function to get frontmatter
export function getMDXFrontmatter(category: string, slug: string): { title: string; description: string } | null {
  const categoryMap = mdxContentMap[category]
  if (!categoryMap) return null
  return categoryMap[slug]?.frontmatter || null
}
