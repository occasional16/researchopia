'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'zh' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, fallback?: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// 翻译文本配置
const translations = {
  zh: {
    // 网站标题和描述
    'site.title': '研学港 | Researchopia',
    'site.subtitle': '研学并进，智慧共享',
    'site.description': '新一代学术评价与研学社区平台',
    
    // 导航栏
    'nav.home': '首页',
    'nav.papers': '论文',
    'nav.search': '搜索',
    'nav.login': '登录',
    'nav.register': '注册',
    'nav.logout': '退出登录',
    'nav.profile': '个人中心',
    'nav.admin': '管理员控制台',
    'nav.account': '账户管理',
    'nav.settings': '设置',
    'nav.guide': '用户指南',
    
    // 主页
    'home.hero.title': '发现学术智慧的新境界',
    'home.hero.subtitle': '在研学港，让每一篇论文都闪耀智慧的光芒',
    'home.search.placeholder': '输入论文标题、DOI、作者或关键词...',
    'home.search.button': '智能搜索',
    'home.search.tip.keyword': '支持关键词搜索，或直接输入DOI自动添加论文',
    'home.search.tip.default': '输入论文标题、作者、DOI或关键词开始智能搜索',
    
    // 统计数据
    'stats.papers': '学术论文',
    'stats.users': '注册用户',
    'stats.visits': '总访问量',
    'stats.todayVisits': '今日访问',
    
    // 论文相关
    'papers.recent': '最新评论',
    'papers.viewAll': '查看所有论文',
    'papers.allPapers': '所有论文',
    'papers.noComments': '暂无评论',
    'papers.loading': '加载中...',
    
    // 用户认证
    'auth.welcome': '欢迎来到研学港！',
    'auth.welcomeDesc': '注册加入我们的学术社区，发表评论、收藏论文，与全球研究者交流学术见解。',
    'auth.joinNow': '立即注册，开始研学之旅',
    
    // 错误和状态
    'error.retry': '重试',
    'error.refresh': '刷新页面',
    'loading': '加载中...',
    
    // 用户档案
    'profile.overview': '账户概览',
    'profile.account': '账户管理',
    'profile.papers': '论文管理',
    'profile.ratings': '我的评分',
    'profile.comments': '我的评论',
    'profile.favorites': '收藏夹',
    
    // 按钮和操作
    'button.search': '搜索',
    'button.submit': '提交',
    'button.cancel': '取消',
    'button.save': '保存',
    'button.delete': '删除',
    'button.edit': '编辑',
    'button.view': '查看',
    'button.back': '返回',
    'button.next': '下一步',
    'button.previous': '上一步',
    
    // 时间和日期
    'time.today': '今天',
    'time.yesterday': '昨天',
    'time.thisWeek': '本周',
    'time.thisMonth': '本月',
    
    // 通用词汇
    'common.title': '标题',
    'common.author': '作者',
    'common.date': '日期',
    'common.category': '分类',
    'common.tags': '标签',
    'common.rating': '评分',
    'common.comment': '评论',
    'common.comments': '评论',
    'common.share': '分享',
    'common.download': '下载',
    'common.upload': '上传',
    'common.filter': '筛选',
    'common.sort': '排序',
    'common.results': '结果',

    // 用户指南
    'guide.title': '研学港用户指南',
    'guide.subtitle': '详细的使用指南，助您轻松上手研学港的所有功能',
    'guide.website.title': '网站使用',
    'guide.website.desc': '学习如何使用研学港网站的各项功能，包括论文搜索、评分和社区交流。',
    'guide.website.feature1': '智能论文搜索',
    'guide.website.feature2': '多维度评价体系',
    'guide.website.feature3': '个性化推荐',
    'guide.website.feature4': '学者档案管理',
    'guide.extension.title': '浏览器扩展',
    'guide.extension.desc': '安装和使用研学港浏览器扩展，在任意学术网页上快速访问论文评价。',
    'guide.extension.feature1': '自动DOI检测',
    'guide.extension.feature2': '悬浮拖拽图标',
    'guide.extension.feature3': '集成侧边栏',
    'guide.extension.feature4': '一键搜索',
    'guide.zotero.title': 'Zotero插件',
    'guide.zotero.desc': '将研学港功能集成到Zotero文献管理器中，无缝管理您的学术资源。',
    'guide.zotero.feature1': '条目面板集成',
    'guide.zotero.feature2': '自动评价同步',
    'guide.zotero.feature3': '灵活配置选项',
    'guide.zotero.feature4': '多平台支持',
    'guide.complete.title': '完整用户指南',
    'guide.complete.openNewTab': '在新窗口中打开',
    'guide.quickLinks.title': '快速链接',
    'guide.github': 'GitHub',
  },
  
  en: {
    // 网站标题和描述
    'site.title': 'Researchopia',
    'site.subtitle': 'Where Research Meets Community',
    'site.description': 'Next-generation academic evaluation and research community platform',
    
    // 导航栏
    'nav.home': 'Home',
    'nav.papers': 'Papers',
    'nav.search': 'Search',
    'nav.login': 'Login',
    'nav.register': 'Register',
    'nav.logout': 'Logout',
    'nav.profile': 'Profile',
    'nav.admin': 'Admin Console',
    'nav.account': 'Account',
    'nav.settings': 'Settings',
    'nav.guide': 'User Guide',
    
    // 主页
    'home.hero.title': 'Discover New Horizons in Academic Wisdom',
    'home.hero.subtitle': 'At Researchopia, let every paper shine with the light of wisdom',
    'home.search.placeholder': 'Enter paper title, DOI, author or keywords...',
    'home.search.button': 'Smart Search',
    'home.search.tip.keyword': 'Supports keyword search, or directly enter DOI to auto-add papers',
    'home.search.tip.default': 'Enter paper title, author, DOI or keywords to start smart search',
    
    // 统计数据
    'stats.papers': 'Academic Papers',
    'stats.users': 'Registered Users',
    'stats.visits': 'Total Visits',
    'stats.todayVisits': 'Today\'s Visits',
    
    // 论文相关
    'papers.recent': 'Recent Comments',
    'papers.viewAll': 'View All Papers',
    'papers.allPapers': 'All Papers',
    'papers.noComments': 'No comments yet',
    'papers.loading': 'Loading...',
    
    // 用户认证
    'auth.welcome': 'Welcome to Researchopia!',
    'auth.welcomeDesc': 'Register to join our academic community, post comments, bookmark papers, and exchange academic insights with global researchers.',
    'auth.joinNow': 'Join Now, Start Your Research Journey',
    
    // 错误和状态
    'error.retry': 'Retry',
    'error.refresh': 'Refresh Page',
    'loading': 'Loading...',
    
    // 用户档案
    'profile.overview': 'Overview',
    'profile.account': 'Account Management',
    'profile.papers': 'Paper Management',
    'profile.ratings': 'My Ratings',
    'profile.comments': 'My Comments',
    'profile.favorites': 'Favorites',
    
    // 按钮和操作
    'button.search': 'Search',
    'button.submit': 'Submit',
    'button.cancel': 'Cancel',
    'button.save': 'Save',
    'button.delete': 'Delete',
    'button.edit': 'Edit',
    'button.view': 'View',
    'button.back': 'Back',
    'button.next': 'Next',
    'button.previous': 'Previous',
    
    // 时间和日期
    'time.today': 'Today',
    'time.yesterday': 'Yesterday',
    'time.thisWeek': 'This Week',
    'time.thisMonth': 'This Month',
    
    // 通用词汇
    'common.title': 'Title',
    'common.author': 'Author',
    'common.date': 'Date',
    'common.category': 'Category',
    'common.tags': 'Tags',
    'common.rating': 'Rating',
    'common.comment': 'Comment',
    'common.comments': 'Comments',
    'common.share': 'Share',
    'common.download': 'Download',
    'common.upload': 'Upload',
    'common.filter': 'Filter',
    'common.sort': 'Sort',
    'common.results': 'Results',

    // 用户指南
    'guide.title': 'Researchopia User Guide',
    'guide.subtitle': 'Comprehensive guide to help you get started with all Researchopia features',
    'guide.website.title': 'Website Usage',
    'guide.website.desc': 'Learn how to use various features of the Researchopia website, including paper search, rating, and community interaction.',
    'guide.website.feature1': 'Smart Paper Search',
    'guide.website.feature2': 'Multi-dimensional Evaluation',
    'guide.website.feature3': 'Personalized Recommendations',
    'guide.website.feature4': 'Scholar Profile Management',
    'guide.extension.title': 'Browser Extension',
    'guide.extension.desc': 'Install and use the Researchopia browser extension to quickly access paper evaluations on any academic webpage.',
    'guide.extension.feature1': 'Automatic DOI Detection',
    'guide.extension.feature2': 'Floating Draggable Icon',
    'guide.extension.feature3': 'Integrated Sidebar',
    'guide.extension.feature4': 'One-click Search',
    'guide.zotero.title': 'Zotero Plugin',
    'guide.zotero.desc': 'Integrate Researchopia functionality into the Zotero reference manager for seamless academic resource management.',
    'guide.zotero.feature1': 'Item Panel Integration',
    'guide.zotero.feature2': 'Automatic Rating Sync',
    'guide.zotero.feature3': 'Flexible Configuration',
    'guide.zotero.feature4': 'Multi-platform Support',
    'guide.complete.title': 'Complete User Guide',
    'guide.complete.openNewTab': 'Open in New Tab',
    'guide.quickLinks.title': 'Quick Links',
    'guide.github': 'GitHub',
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh')
  
  // 从localStorage读取语言设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('language') as Language
      if (savedLang && (savedLang === 'zh' || savedLang === 'en')) {
        setLanguageState(savedLang)
      } else {
        // 检测浏览器语言
        const browserLang = navigator.language.toLowerCase()
        if (browserLang.startsWith('zh')) {
          setLanguageState('zh')
        } else {
          setLanguageState('en')
        }
      }
    }
  }, [])
  
  // 保存语言设置到localStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang)
      // 更新HTML lang属性
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    }
  }
  
  // 翻译函数
  const t = (key: string, fallback?: string): string => {
    const translation = translations[language]?.[key as keyof typeof translations[typeof language]]
    if (translation) {
      return translation as string
    }
    
    // 如果没找到翻译，尝试另一种语言作为后备
    const otherLang = language === 'zh' ? 'en' : 'zh'
    const otherTranslation = translations[otherLang]?.[key as keyof typeof translations[typeof otherLang]]
    if (otherTranslation) {
      return otherTranslation as string
    }
    
    // 最终后备：返回fallback或key
    return fallback || key
  }
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}