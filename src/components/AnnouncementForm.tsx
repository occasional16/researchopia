'use client'

import { useState, useMemo } from 'react'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import dynamic from 'next/dynamic'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import 'easymde/dist/easymde.min.css'

// 动态导入SimpleMDE以避免SSR问题
const SimpleMDE = dynamic(() => import('react-simplemde-editor'), { ssr: false })

interface AnnouncementFormProps {
  editingAnnouncement?: any
  onSuccess: () => void
  onCancel: () => void
}

export default function AnnouncementForm({ editingAnnouncement, onSuccess, onCancel }: AnnouncementFormProps) {
  const authenticatedFetch = useAuthenticatedFetch()
  const [title, setTitle] = useState(editingAnnouncement?.title || '')
  const [content, setContent] = useState(editingAnnouncement?.content || '')
  const [type, setType] = useState<'info' | 'warning' | 'success' | 'error'>(editingAnnouncement?.type || 'info')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const isEditing = !!editingAnnouncement

  // SimpleMDE配置
  const editorOptions = useMemo(() => ({
    spellChecker: false,
    placeholder: '支持Markdown格式...\n\n常用语法:\n# 标题\n**粗体** *斜体*\n- 列表项\n[链接](url)\n![图片](url)\n\n调整字号:\n<span style="font-size: 20px">大字</span>\n<span style="font-size: 12px">小字</span>',
    maxHeight: '300px',
    status: false,
    toolbar: ['bold', 'italic', 'heading', '|', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', '|', 'preview', 'guide'] as any,
  }), [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const url = isEditing ? '/api/announcements' : '/api/announcements'
      const method = isEditing ? 'PUT' : 'POST'
      const body = isEditing
        ? {
            id: editingAnnouncement.id,
            title: title.trim(),
            content: content.trim(),
            type,
            is_active: true
          }
        : {
            title: title.trim(),
            content: content.trim(),
            type,
            is_active: true
          }

      const response = await authenticatedFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        onSuccess()
      } else {
        throw new Error(result.message || '发布失败')
      }
    } catch (err) {
      console.error('Error creating announcement:', err)
      setError(err instanceof Error ? err.message : '发布公告时出现错误')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTypeIcon = (announcementType: string) => {
    switch (announcementType) {
      case 'info':
        return <Info className="h-4 w-4" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />
      case 'success':
        return <CheckCircle className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getTypeColor = (announcementType: string) => {
    switch (announcementType) {
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="announcement-title" className="block text-sm font-medium text-gray-700 mb-2">
          公告标题
        </label>
        <input
          type="text"
          id="announcement-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="输入公告标题..."
          maxLength={100}
          required
        />
        <p className="mt-1 text-sm text-gray-500">{title.length}/100</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="announcement-content" className="block text-sm font-medium text-gray-700">
            公告内容 (支持Markdown)
          </label>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showPreview ? '编辑' : '预览'}
          </button>
        </div>
        
        {showPreview ? (
          <div className="w-full min-h-[300px] px-4 py-3 border border-gray-300 rounded-md bg-gray-50 prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || '*没有内容*'}
            </ReactMarkdown>
          </div>
        ) : (
          <SimpleMDE
            value={content}
            onChange={setContent}
            options={editorOptions}
          />
        )}
        
        <p className="mt-1 text-sm text-gray-500">{content.length}/5000 字符</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          公告类型
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(['info', 'warning', 'success', 'error'] as const).map((announcementType) => (
            <label
              key={announcementType}
              className={`relative flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                type === announcementType ? getTypeColor(announcementType) : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="type"
                value={announcementType}
                checked={type === announcementType}
                onChange={(e) => setType(e.target.value as any)}
                className="sr-only"
              />
              <div className="flex items-center">
                {getTypeIcon(announcementType)}
                <span className="ml-2 text-sm font-medium capitalize">
                  {announcementType === 'info' ? '信息' :
                   announcementType === 'warning' ? '警告' :
                   announcementType === 'success' ? '成功' :
                   announcementType === 'error' ? '错误' : announcementType}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={isSubmitting}
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || !content.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (isEditing ? '更新中...' : '发布中...') : (isEditing ? '更新公告' : '发布公告')}
        </button>
      </div>
    </form>
  )
}
