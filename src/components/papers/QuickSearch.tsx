'use client'

import React, { useState, useEffect } from 'react'
import { 
  ExternalLink, 
  Search, 
  BookOpen, 
  Database, 
  Users, 
  Brain,
  Link as LinkIcon,
  Stethoscope,
  FileText,
  GraduationCap,
  Globe,
  ChevronDown,
  ChevronUp,
  Settings,
  Microscope,
  Zap,
  BookMarked,
  Library,
  FlaskConical
} from 'lucide-react'
import SearchPreferences from './SearchPreferences'

interface SearchSite {
  name: string
  nameZh: string
  icon: React.ReactNode
  url: (query: string, type: 'doi' | 'title') => string
  color: string
  bgColor: string
  description: string
  category: 'general' | 'database' | 'repository' | 'chinese'
}

const searchSites: SearchSite[] = [
  {
    name: 'Google Scholar',
    nameZh: '谷歌学术',
    icon: <GraduationCap className="w-5 h-5" />,
    url: (query, type) => type === 'doi' 
      ? `https://scholar.google.com/scholar?q="${query}"` 
      : `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    description: '最全面的学术文献搜索引擎',
    category: 'general'
  },
  {
    name: 'Sci-Hub',
    nameZh: 'Sci-Hub',
    icon: <BookOpen className="w-5 h-5" />,
    url: (query, type) => type === 'doi' 
      ? `https://sci-hub.ru/${query}` 
      : `https://sci-hub.ru/${encodeURIComponent(query)}`,
    color: 'text-red-600',
    bgColor: 'bg-red-50 hover:bg-red-100 border-red-200',
    description: '免费获取论文全文',
    category: 'repository'
  },
  {
    name: 'Semantic Scholar',
    nameZh: 'Semantic Scholar',
    icon: <Brain className="w-5 h-5" />,
    url: (query, type) => type === 'doi' 
      ? `https://www.semanticscholar.org/search?q=${query}` 
      : `https://www.semanticscholar.org/search?q=${encodeURIComponent(query)}`,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
    description: 'AI 驱动的学术搜索和分析',
    category: 'general'
  },
  {
    name: 'Web of Science',
    nameZh: 'Web of Science',
    icon: <FlaskConical className="w-5 h-5" />,
    url: (query, type) => `https://webofscience.clarivate.cn/wos/alldb/basic-search?query=${encodeURIComponent(query)}`,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
    description: '权威的学术数据库和引用分析',
    category: 'database'
  },
  {
    name: 'ResearchGate',
    nameZh: 'ResearchGate',
    icon: <Users className="w-5 h-5" />,
    url: (query, type) => `https://www.researchgate.net/search?q=${encodeURIComponent(query)}`,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 hover:bg-teal-100 border-teal-200',
    description: '学术社交网络和论文分享平台',
    category: 'general'
  },
  {
    name: 'PubMed',
    nameZh: 'PubMed',
    icon: <Stethoscope className="w-5 h-5" />,
    url: (query, type) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`,
    color: 'text-green-600',
    bgColor: 'bg-green-50 hover:bg-green-100 border-green-200',
    description: '生物医学和生命科学文献数据库',
    category: 'database'
  },
  {
    name: '百度学术',
    nameZh: '百度学术',
    icon: <Search className="w-5 h-5" />,
    url: (query, type) => `https://xueshu.baidu.com/s?wd=${encodeURIComponent(query)}`,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    description: '百度学术搜索引擎',
    category: 'chinese'
  },
  {
    name: 'arXiv',
    nameZh: 'arXiv',
    icon: <FileText className="w-5 h-5" />,
    url: (query, type) => `https://arxiv.org/search/?query=${encodeURIComponent(query)}&searchtype=all`,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    description: '物理、数学、计算机科学预印本论文库',
    category: 'repository'
  },
  {
    name: 'CrossRef',
    nameZh: 'CrossRef',
    icon: <LinkIcon className="w-5 h-5" />,
    url: (query, type) => type === 'doi' 
      ? `https://search.crossref.org/?q=${query}` 
      : `https://search.crossref.org/?q=${encodeURIComponent(query)}`,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
    description: 'DOI 注册和引用链接服务',
    category: 'database'
  },
  {
    name: 'Scholar Mirror',
    nameZh: '学术镜像',
    icon: <Globe className="w-5 h-5" />,
    url: (query, type) => type === 'doi' 
      ? `https://scholar.google.com.hk/scholar?q="${query}"` 
      : `https://scholar.google.com.hk/scholar?q=${encodeURIComponent(query)}`,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200',
    description: 'Google Scholar 镜像站点',
    category: 'chinese'
  },
  {
    name: 'IEEE Xplore',
    nameZh: 'IEEE Xplore',
    icon: <Zap className="w-5 h-5" />,
    url: (query, type) => `https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=${encodeURIComponent(query)}`,
    color: 'text-blue-800',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    description: 'IEEE 电子电气工程师协会数据库',
    category: 'database'
  },
  {
    name: 'SpringerLink',
    nameZh: 'SpringerLink',
    icon: <BookMarked className="w-5 h-5" />,
    url: (query, type) => `https://link.springer.com/search?query=${encodeURIComponent(query)}`,
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
    description: 'Springer 出版社学术资源',
    category: 'database'
  },
  {
    name: '中国知网',
    nameZh: '中国知网',
    icon: <Library className="w-5 h-5" />,
    url: (query, type) => `https://kns.cnki.net/kns8/defaultresult/index?kw=${encodeURIComponent(query)}`,
    color: 'text-red-700',
    bgColor: 'bg-red-50 hover:bg-red-100 border-red-200',
    description: '中国最大的学术数据库',
    category: 'chinese'
  },
  {
    name: '万方数据',
    nameZh: '万方数据',
    icon: <Database className="w-5 h-5" />,
    url: (query, type) => `https://www.wanfangdata.com.cn/search/searchList.do?searchWord=${encodeURIComponent(query)}`,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
    description: '万方数据知识服务平台',
    category: 'chinese'
  },
  {
    name: 'bioRxiv',
    nameZh: 'bioRxiv',
    icon: <Microscope className="w-5 h-5" />,
    url: (query, type) => `https://www.biorxiv.org/search/${encodeURIComponent(query)}`,
    color: 'text-green-700',
    bgColor: 'bg-green-50 hover:bg-green-100 border-green-200',
    description: '生物学预印本论文服务器',
    category: 'repository'
  }
]

interface QuickSearchProps {
  paper: {
    title: string
    doi?: string | null
    authors: string[]
  }
}

export default function QuickSearch({ paper }: QuickSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchStats, setSearchStats] = useState<{[key: string]: number}>({})
  const [showPreferences, setShowPreferences] = useState(false)
  const [selectedSites, setSelectedSites] = useState<string[]>([])

  // Load preferences from localStorage on component mount
  useEffect(() => {
    const savedPreferences = localStorage.getItem('quick-search-preferences')
    if (savedPreferences) {
      try {
        const preferences = JSON.parse(savedPreferences)
        setSelectedSites(preferences.selectedSites || searchSites.slice(0, 8).map(s => s.name))
      } catch (error) {
        // If parsing fails, use default selection
        setSelectedSites(searchSites.slice(0, 8).map(s => s.name))
      }
    } else {
      // Default to first 8 sites
      setSelectedSites(searchSites.slice(0, 8).map(s => s.name))
    }

    // Load search stats
    const savedStats = localStorage.getItem('quick-search-stats')
    if (savedStats) {
      try {
        setSearchStats(JSON.parse(savedStats))
      } catch (error) {
        setSearchStats({})
      }
    }
  }, [])

  // Save preferences when selectedSites changes
  useEffect(() => {
    if (selectedSites.length > 0) {
      localStorage.setItem('quick-search-preferences', JSON.stringify({
        selectedSites,
        lastUpdated: new Date().toISOString()
      }))
    }
  }, [selectedSites])

  // Save stats when searchStats changes
  useEffect(() => {
    localStorage.setItem('quick-search-stats', JSON.stringify(searchStats))
  }, [searchStats])

  const handleSearch = (site: SearchSite, e: React.MouseEvent) => {
    e.preventDefault()
    
    // 优先使用 DOI，如果没有则使用标题
    const query = paper.doi || paper.title
    const queryType = paper.doi ? 'doi' : 'title'
    
    const url = site.url(query, queryType)
    
    // 统计点击次数
    setSearchStats(prev => ({
      ...prev,
      [site.name]: (prev[site.name] || 0) + 1
    }))
    
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handlePreferencesChange = (newSelectedSites: string[]) => {
    setSelectedSites(newSelectedSites)
  }

  const filteredSites = searchSites.filter(site => selectedSites.includes(site.name))
  const displaySites = isExpanded ? filteredSites : filteredSites.slice(0, 6)

  if (selectedSites.length === 0) {
    return null // Don't render if no sites are selected
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center space-x-2">
              <Search className="w-5 h-5 text-blue-600" />
              <span>快捷搜索</span>
            </h2>
            <p className="text-sm text-gray-600">
              {paper.doi 
                ? (
                    <span>
                      基于 DOI 
                      <code className="mx-1 px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                        {paper.doi}
                      </code>
                      在其他学术平台搜索此论文
                    </span>
                  )
                : '基于论文标题在其他学术平台搜索此论文'
              }
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPreferences(true)}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="设置搜索偏好"
            >
              <Settings className="w-4 h-4" />
              <span>设置</span>
            </button>
            
            {filteredSites.length > 6 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span>{isExpanded ? '收起' : '展开全部'}</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displaySites.map((site) => (
            <button
              key={site.name}
              onClick={(e) => handleSearch(site, e)}
              className={`${site.bgColor} ${site.color} p-4 rounded-lg border transition-all duration-200 hover:shadow-md flex items-start space-x-3 group text-left`}
              title={site.description}
            >
              <div className="flex-shrink-0 mt-0.5">
                {site.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm mb-1 group-hover:underline">
                  {site.nameZh}
                </div>
                <div className="text-xs opacity-75 line-clamp-2">
                  {site.description}
                </div>
                {searchStats[site.name] && (
                  <div className="text-xs mt-1 opacity-60">
                    已使用 {searchStats[site.name]} 次
                  </div>
                )}
              </div>
              <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
        
        {!isExpanded && filteredSites.length > 6 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsExpanded(true)}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              查看更多搜索选项 ({filteredSites.length - 6} 个)
            </button>
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-200 rounded-full"></div>
                <span>通用搜索</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-purple-200 rounded-full"></div>
                <span>专业数据库</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-orange-200 rounded-full"></div>
                <span>论文仓库</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-200 rounded-full"></div>
                <span>中文平台</span>
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 点击按钮将在新标签页中打开对应网站的搜索结果 • 显示 {filteredSites.length}/{searchSites.length} 个网站
          </p>
        </div>
      </div>

      {showPreferences && (
        <SearchPreferences
          sites={searchSites}
          selectedSites={selectedSites}
          onSitesChange={handlePreferencesChange}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </>
  )
}