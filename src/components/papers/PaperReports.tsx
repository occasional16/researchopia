'use client'

import { useState, useEffect } from 'react'
import { 
  Newspaper, 
  ExternalLink, 
  Calendar, 
  User, 
  Plus,
  MessageSquare,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2
} from 'lucide-react'
import { PaperReport } from '@/lib/supabase'

interface PaperReportsProps {
  paperId: string
  paperTitle: string
  paperDOI?: string  // 新增DOI参数
}

const sourceConfig = {
  wechat: {
    icon: MessageSquare,
    label: '微信公众号',
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200'
  },
  news: {
    icon: Newspaper,
    label: '新闻媒体',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200'
  },
  blog: {
    icon: FileText,
    label: '博客文章',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200'
  },
  other: {
    icon: ExternalLink,
    label: '其他来源',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 border-gray-200'
  }
}

export default function PaperReports({ paperId, paperTitle, paperDOI }: PaperReportsProps) {
  const [reports, setReports] = useState<PaperReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [crawlerLoading, setCrawlerLoading] = useState(false)

  // 新增报道表单状态
  const [newReport, setNewReport] = useState({
    title: '',
    url: '',
    source: 'wechat' as const,
    author: '',
    publish_date: '',
    description: ''
  })

  useEffect(() => {
    loadReports()
  }, [paperId])

  const loadReports = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/papers/${paperId}/reports`)
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newReport.title.trim() || !newReport.url.trim()) return

    try {
      const response = await fetch(`/api/papers/${paperId}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newReport)
      })

      if (response.ok) {
        await loadReports()
        setNewReport({
          title: '',
          url: '',
          source: 'wechat',
          author: '',
          publish_date: '',
          description: ''
        })
        setShowAddForm(false)
      }
    } catch (error) {
      console.error('Failed to add report:', error)
    }
  }

  const crawlNewsReports = async () => {
    setCrawlerLoading(true)
    try {
      const response = await fetch(`/api/papers/${paperId}/crawl-news`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: paperTitle,
          doi: paperDOI
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('🕷️ 爬虫搜索结果:', data)
        
        if (data.success) {
          if (data.added > 0) {
            alert(`🎉 爬取成功！\n找到 ${data.found} 条相关报道\n新增 ${data.added} 条到数据库`)
            // 刷新报道列表
            await loadReports()
          } else if (data.found > 0) {
            alert(`📰 找到 ${data.found} 条相关报道，但都已存在于数据库中`)
          } else {
            alert('😔 未找到相关新闻报道\n您可以尝试手动添加或稍后再试')
          }
        } else {
          alert(`❌ 搜索失败: ${data.error || '未知错误'}`)
        }
      } else {
        const error = await response.json()
        alert(`❌ 搜索失败: ${error.error || '服务器错误'}`)
      }
    } catch (error) {
      console.error('爬虫搜索失败:', error)
      alert('❌ 网络错误，请检查网络连接后重试')
    } finally {
      setCrawlerLoading(false)
    }
  }

  const filteredReports = selectedSource === 'all' 
    ? reports 
    : reports.filter(report => report.source === selectedSource)

  const visibleReports = isExpanded ? filteredReports : filteredReports.slice(0, 3)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Newspaper className="w-5 h-5 text-orange-600" />
          <h2 className="text-xl font-semibold text-gray-900">论文相关报道</h2>
          {reports.length > 0 && (
            <span className="bg-orange-100 text-orange-800 text-sm px-2 py-1 rounded-full">
              {reports.length}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={crawlNewsReports}
            disabled={crawlerLoading}
            className="flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md text-sm transition-colors disabled:opacity-50"
          >
            {crawlerLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>{crawlerLoading ? '爬取中...' : '智能爬取报道'}</span>
          </button>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>手动添加</span>
          </button>
        </div>
      </div>

      {/* Source Filter */}
      {reports.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedSource('all')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedSource === 'all' 
                ? 'bg-gray-900 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部 ({reports.length})
          </button>
          
          {Object.entries(sourceConfig).map(([key, config]) => {
            const count = reports.filter(r => r.source === key).length
            if (count === 0) return null
            
            return (
              <button
                key={key}
                onClick={() => setSelectedSource(key)}
                className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedSource === key 
                    ? `${config.bgColor} ${config.color} border` 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <config.icon className="w-3 h-3" />
                <span>{config.label} ({count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Add Report Form */}
      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">添加相关报道</h3>
          <form onSubmit={handleAddReport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  报道标题*
                </label>
                <input
                  type="text"
                  value={newReport.title}
                  onChange={(e) => setNewReport({...newReport, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入报道标题"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  文章链接*
                </label>
                <input
                  type="url"
                  value={newReport.url}
                  onChange={(e) => setNewReport({...newReport, url: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  来源类型
                </label>
                <select
                  value={newReport.source}
                  onChange={(e) => setNewReport({...newReport, source: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(sourceConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  作者/来源
                </label>
                <input
                  type="text"
                  value={newReport.author}
                  onChange={(e) => setNewReport({...newReport, author: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="作者或公众号名称"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                简短描述
              </label>
              <textarea
                value={newReport.description}
                onChange={(e) => setNewReport({...newReport, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="简短描述这篇报道的内容..."
                rows={2}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                添加报道
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reports List */}
      {visibleReports.length > 0 ? (
        <div className="space-y-4">
          {visibleReports.map((report) => {
            const config = sourceConfig[report.source]
            const IconComponent = config.icon
            
            return (
              <div
                key={report.id}
                className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${config.bgColor}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <IconComponent className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-xs font-medium px-2 py-1 rounded ${config.color} bg-white`}>
                        {config.label}
                      </span>
                      {report.view_count > 0 && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Eye className="w-3 h-3" />
                          <span>{report.view_count}</span>
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                      {report.title}
                    </h3>
                    
                    {report.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {report.description}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      {report.author && (
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{report.author}</span>
                        </div>
                      )}
                      
                      {report.publish_date && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(report.publish_date).toLocaleDateString('zh-CN')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <a
                    href={report.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`ml-4 px-3 py-1.5 ${config.color} hover:opacity-80 transition-opacity text-sm flex items-center space-x-1`}
                  >
                    <span>阅读</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">暂无相关报道</p>
          <p className="text-sm text-gray-400">
            您可以手动添加相关报道，或尝试搜索微信公众号文章
          </p>
        </div>
      )}

      {/* Expand/Collapse Button */}
      {filteredReports.length > 3 && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <span>
              {isExpanded 
                ? `收起 (共${filteredReports.length}条)` 
                : `展开更多 (${filteredReports.length - 3}条)`
              }
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}