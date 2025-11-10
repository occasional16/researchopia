'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getPapers, updatePaper, deletePaper } from '@/lib/database'
import { fetchPaperByDOI } from '@/lib/crossref'
import { Edit, Trash2, RefreshCw, Search, Save, X } from 'lucide-react'
import type { Paper } from '@/lib/supabase'

interface EditingPaper extends Paper {
  isEditing?: boolean
}

export default function AdminPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [papers, setPapers] = useState<EditingPaper[]>([])
  const [loadingPapers, setLoadingPapers] = useState(true)
  const [editingPaper, setEditingPaper] = useState<string | null>(null)
  const [refreshingDOI, setRefreshingDOI] = useState<string | null>(null)

  useEffect(() => {
    // 等待认证和profile加载完成
    if (loading || (user && !profile)) return

    if (!user) {
      router.push('/')
      return
    }

    if (profile?.role !== 'admin') {
      router.push('/')
      return
    }

    loadPapers()
  }, [user, profile, loading, router])

  const loadPapers = async () => {
    try {
      setLoadingPapers(true)
      const data = await getPapers(100, 0) // 加载更多论文供管理
      setPapers(data.map(p => ({ ...p, isEditing: false })))
    } catch (error) {
      console.error('Error loading papers:', error)
    } finally {
      setLoadingPapers(false)
    }
  }

  const handleRefreshFromDOI = async (paper: Paper) => {
    if (!paper.doi) return
    
    try {
      setRefreshingDOI(paper.id)
      const paperInfo = await fetchPaperByDOI(paper.doi)
      
      if (paperInfo) {
        const updatedPaper = {
          ...paper,
          title: paperInfo.title,
          authors: paperInfo.authors,
          abstract: paperInfo.abstract,
          journal: paperInfo.journal,
          publication_date: paperInfo.publication_date,
          keywords: paperInfo.keywords || paper.keywords
        }
        
        await updatePaper(paper.id, updatedPaper)
        setPapers(prev => prev.map(p => 
          p.id === paper.id ? { ...updatedPaper, isEditing: false } : p
        ))
      }
    } catch (error) {
      console.error('Error refreshing paper from DOI:', error)
      alert('从DOI更新论文信息失败，请检查DOI是否正确')
    } finally {
      setRefreshingDOI(null)
    }
  }

  const handleEdit = (paperId: string) => {
    setEditingPaper(paperId)
    setPapers(prev => prev.map(p => 
      p.id === paperId ? { ...p, isEditing: true } : { ...p, isEditing: false }
    ))
  }

  const handleSave = async (paper: EditingPaper) => {
    try {
      await updatePaper(paper.id, paper)
      setPapers(prev => prev.map(p => 
        p.id === paper.id ? { ...paper, isEditing: false } : p
      ))
      setEditingPaper(null)
    } catch (error) {
      console.error('Error updating paper:', error)
      alert('更新论文信息失败')
    }
  }

  const handleCancel = (paperId: string) => {
    setEditingPaper(null)
    loadPapers() // 重新加载以恢复原始数据
  }

  const handleDelete = async (paperId: string) => {
    if (!confirm('确定要删除这篇论文吗？此操作不可撤销。')) return
    
    try {
      await deletePaper(paperId)
      setPapers(prev => prev.filter(p => p.id !== paperId))
    } catch (error) {
      console.error('Error deleting paper:', error)
      alert('删除论文失败')
    }
  }

  const handleFieldChange = (paperId: string, field: keyof Paper, value: any) => {
    setPapers(prev => prev.map(p => 
      p.id === paperId ? { ...p, [field]: value } : p
    ))
  }

  if (loading || loadingPapers) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-6 w-1/3"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user || profile?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">访问被拒绝</h1>
          <p className="text-gray-600">您需要管理员权限才能访问此页面。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">管理员控制台</h1>
        <p className="text-gray-600">管理论文条目，纠错和维护数据质量</p>
      </div>

      {/* 快捷导航 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <a 
          href="/admin/visit-stats" 
          className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 text-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all"
        >
          <div className="flex items-center gap-3">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold">访问统计</h3>
              <p className="text-sm opacity-90">查看每日访问数据</p>
            </div>
          </div>
        </a>
        
        <a 
          href="/admin/plugin-version" 
          className="bg-gradient-to-r from-orange-600 to-pink-600 dark:from-orange-700 dark:to-pink-700 text-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all"
        >
          <div className="flex items-center gap-3">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold">版本控制</h3>
              <p className="text-sm opacity-90">管理Zotero插件版本</p>
            </div>
          </div>
        </a>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">论文管理</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">当前页面功能</p>
        </div>
        
        <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">更多功能</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">敬请期待...</p>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">论文总数</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{papers.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">编辑中</h3>
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {papers.filter(p => p.isEditing).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">管理功能</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">DOI更新、手动编辑、删除</p>
        </div>
      </div>

      {/* 论文列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">论文管理</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            点击"从DOI更新"可重新获取最新信息，点击"编辑"可手动修改论文信息
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {papers.map((paper) => (
            <div key={paper.id} className="p-6">
              {paper.isEditing ? (
                <EditPaperForm 
                  paper={paper}
                  onSave={() => handleSave(paper)}
                  onCancel={() => handleCancel(paper.id)}
                  onChange={(field, value) => handleFieldChange(paper.id, field, value)}
                />
              ) : (
                <PaperDisplay 
                  paper={paper}
                  onEdit={() => handleEdit(paper.id)}
                  onRefresh={() => handleRefreshFromDOI(paper)}
                  onDelete={() => handleDelete(paper.id)}
                  isRefreshing={refreshingDOI === paper.id}
                />
              )}
            </div>
          ))}
        </div>

        {papers.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无论文数据</p>
            <p className="text-sm mt-2">用户添加论文后将在此显示</p>
          </div>
        )}
      </div>
    </div>
  )
}

// 论文显示组件
function PaperDisplay({ 
  paper, 
  onEdit, 
  onRefresh, 
  onDelete, 
  isRefreshing 
}: {
  paper: Paper
  onEdit: () => void
  onRefresh: () => void
  onDelete: () => void
  isRefreshing: boolean
}) {
  return (
    <div>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{paper.title}</h3>
          <p className="text-sm text-gray-600 mb-2">
            作者: {paper.authors.join(', ')}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            期刊: {paper.journal} | 发表日期: {paper.publication_date}
          </p>
          {paper.doi && (
            <p className="text-sm text-gray-500">DOI: {paper.doi}</p>
          )}
        </div>
        
        <div className="flex space-x-2 ml-4">
          {paper.doi && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>从DOI更新</span>
            </button>
          )}
          <button
            onClick={onEdit}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100"
          >
            <Edit className="w-4 h-4" />
            <span>编辑</span>
          </button>
          <button
            onClick={onDelete}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-50 text-red-700 rounded-md hover:bg-red-100"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除</span>
          </button>
        </div>
      </div>
      
      {paper.abstract && (
        <p className="text-sm text-gray-600 line-clamp-3">{paper.abstract}</p>
      )}
    </div>
  )
}

// 论文编辑表单组件
function EditPaperForm({ 
  paper, 
  onSave, 
  onCancel, 
  onChange 
}: {
  paper: EditingPaper
  onSave: () => void
  onCancel: () => void
  onChange: (field: keyof Paper, value: any) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">编辑论文信息</h3>
        <div className="flex space-x-2">
          <button
            onClick={onSave}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-50 text-green-700 rounded-md hover:bg-green-100"
          >
            <Save className="w-4 h-4" />
            <span>保存</span>
          </button>
          <button
            onClick={onCancel}
            className="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
            <span>取消</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
          <input
            type="text"
            value={paper.title}
            onChange={(e) => onChange('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
          <input
            type="text"
            value={paper.doi}
            onChange={(e) => onChange('doi', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">期刊</label>
          <input
            type="text"
            value={paper.journal}
            onChange={(e) => onChange('journal', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">发表日期</label>
          <input
            type="date"
            value={paper.publication_date}
            onChange={(e) => onChange('publication_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">作者 (每行一个)</label>
        <textarea
          value={paper.authors.join('\n')}
          onChange={(e) => onChange('authors', e.target.value.split('\n').filter(a => a.trim()))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">摘要</label>
        <textarea
          value={paper.abstract}
          onChange={(e) => onChange('abstract', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">关键词 (逗号分隔)</label>
        <input
          type="text"
          value={paper.keywords.join(', ')}
          onChange={(e) => onChange('keywords', e.target.value.split(',').map(k => k.trim()).filter(k => k))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}
