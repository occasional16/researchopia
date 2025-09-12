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
  Loader2,
  Edit,
  Trash2,
  Save,
  X,
  Globe
} from 'lucide-react'
import type { PaperReport } from '@/lib/supabase'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { previewUrl } from '@/lib/simple-browser'
import ReportsStats from './ReportsStats'
import ReportsVisibilityInfo from './ReportsVisibilityInfo'

interface PaperReportsProps {
  paperId: string
  paperTitle: string
  paperDOI?: string  // 新增DOI参数
  isAdminMode?: boolean  // 管理员模式标识
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

export default function PaperReports({ paperId, paperTitle, paperDOI, isAdminMode = false }: PaperReportsProps) {
  const authenticatedFetch = useAuthenticatedFetch()
  const [reports, setReports] = useState<PaperReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [crawlerLoading, setCrawlerLoading] = useState(false)
  const [editingReport, setEditingReport] = useState<string | null>(null)
  // 编辑报道表单状态
  const [editForm, setEditForm] = useState({
    title: '',
    url: '',
    source: 'wechat' as 'wechat' | 'news' | 'blog' | 'other',
    author: '',
    publish_date: '',
    description: ''
  })

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
      const response = await authenticatedFetch(`/api/papers/${paperId}/reports`)
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
      const response = await authenticatedFetch(`/api/papers/${paperId}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newReport)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.report) {
          // 立即添加新报道到当前状态，而不是重新加载
          setReports(prevReports => [data.report, ...prevReports])
        }
        
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

  const handleEditReport = (report: PaperReport) => {
    setEditingReport(report.id)
    setEditForm({
      title: report.title,
      url: report.url,
      source: report.source as 'wechat' | 'news' | 'blog' | 'other',
      author: report.author || '',
      publish_date: report.publish_date || '',
      description: report.description || ''
    })
  }

  const handleUpdateReport = async (reportId: string) => {
    if (!editForm.title.trim() || !editForm.url.trim()) {
      alert('标题和URL不能为空')
      return
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      const response = await authenticatedFetch(`/api/papers/${paperId}/reports`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          ...editForm
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.report) {
          // 立即更新当前状态中的报道，而不是重新加载
          setReports(prevReports => 
            prevReports.map(report => 
              report.id === reportId ? { ...report, ...data.report } : report
            )
          )
          setEditingReport(null) // 退出编辑模式
        } else {
          alert(`更新失败: ${data.error || '未知错误'}`)
        }
      } else {
        const error = await response.json()
        if (response.status === 409) {
          alert('该URL已存在，请使用其他URL')
        } else {
          alert(`更新失败: ${error.error || '服务器错误'}`)
        }
      }
    } catch (error) {
      console.error('Update failed:', error)
      alert('网络错误，请重试')
    }
  }

  const handleDeleteReport = async (reportId: string, title: string) => {
    const confirmMessage = isAdminMode 
      ? `确定要删除报道 "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}" 吗？\n\n⚠️ 管理员模式：此操作不可撤销。`
      : `确定要删除报道 "${title.substring(0, 50)}${title.length > 50 ? '...' : ''}" 吗？\n\n此操作不可撤销。`
      
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const response = await authenticatedFetch(`/api/papers/${paperId}/reports?reportId=${reportId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // 立即从当前状态中移除已删除的报道，而不是重新加载
          setReports(prevReports => prevReports.filter(report => report.id !== reportId))
          
          if (isAdminMode) {
            alert('✅ 管理员已成功删除该报道')
          }
        } else {
          alert(`删除失败: ${data.error || '未知错误'}`)
        }
      } else {
        const error = await response.json()
        alert(`删除失败: ${error.error || '服务器错误'}`)
      }
    } catch (error) {
      console.error('Delete failed:', error)
      alert('网络错误，请重试')
    }
  }

  const cancelEdit = () => {
    setEditingReport(null)
    setEditForm({
      title: '',
      url: '',
      source: 'wechat',
      author: '',
      publish_date: '',
      description: ''
    })
  }

  // 预览链接功能
  const handlePreviewReport = (url: string, title: string) => {
    previewUrl(url, `报道预览: ${title}`)
  }

  const crawlNewsReports = async () => {
    setCrawlerLoading(true)
    try {
      const response = await authenticatedFetch(`/api/papers/${paperId}/crawl-news`, {
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
            // 重新加载报道列表以获取最新数据（爬取可能添加多条记录）
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
          <ReportsVisibilityInfo />
          {isAdminMode && (
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full border border-yellow-300">
              👑 管理员模式
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

      {/* Reports Statistics */}
      <ReportsStats paperId={paperId} />

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
            const isEditing = editingReport === report.id
            
            return (
              <div
                key={report.id}
                className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${config.bgColor}`}
              >
                {isEditing ? (
                  // 编辑模式
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <IconComponent className={`w-4 h-4 ${config.color}`} />
                        <span className={`text-xs font-medium px-2 py-1 rounded ${config.color} bg-white`}>
                          编辑报道
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUpdateReport(report.id)}
                          className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded transition-colors"
                          title="保存"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                          title="取消"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          标题 *
                        </label>
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="报道标题"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          链接 *
                        </label>
                        <input
                          type="url"
                          value={editForm.url}
                          onChange={(e) => setEditForm({...editForm, url: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          来源类型
                        </label>
                        <select
                          value={editForm.source}
                          onChange={(e) => setEditForm({...editForm, source: e.target.value as 'wechat' | 'news' | 'blog' | 'other'})}
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
                          value={editForm.author}
                          onChange={(e) => setEditForm({...editForm, author: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="作者或公众号名称"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          发布日期
                        </label>
                        <input
                          type="date"
                          value={editForm.publish_date}
                          onChange={(e) => setEditForm({...editForm, publish_date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        简短描述
                      </label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="简短描述这篇报道的内容..."
                        rows={2}
                      />
                    </div>
                  </div>
                ) : (
                  // 显示模式
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
                        
                        {/* 贡献者信息 */}
                        <div className="flex items-center space-x-1 text-xs">
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500">
                            {report.contribution_type || '手动添加'}
                            {report.contributor_name && (
                              <span className="text-blue-600 ml-1">
                                by {report.contributor_name}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEditReport(report)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteReport(report.id, report.title)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handlePreviewReport(report.url, report.title)}
                        className="px-2 py-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-gray-300 hover:border-blue-300 rounded transition-colors text-sm flex items-center space-x-1"
                        title="在简易浏览器中预览"
                      >
                        <Globe className="w-3 h-3" />
                        <span>预览</span>
                      </button>
                      
                      <a
                        href={report.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 ${config.color} hover:opacity-80 transition-opacity text-sm flex items-center space-x-1`}
                        title="在新标签页打开"
                      >
                        <span>阅读</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
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