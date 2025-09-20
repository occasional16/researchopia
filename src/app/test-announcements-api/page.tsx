'use client'

import { useState, useEffect } from 'react'

interface Announcement {
  id: string
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  created_at: string
  updated_at: string
  is_active: boolean
  created_by: string
}

export default function TestAnnouncementsAPI() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState<'info' | 'warning' | 'success' | 'error'>('info')

  // 加载公告
  const loadAnnouncements = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/announcements?active=true')
      const result = await response.json()
      if (result.success) {
        setAnnouncements(result.data)
      } else {
        setError('加载失败: ' + result.message)
      }
    } catch (err) {
      setError('网络错误: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  // 创建公告
  const createAnnouncement = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      setError('标题和内容不能为空')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          type: newType,
          is_active: true
        }),
      })

      const result = await response.json()
      if (result.success) {
        setNewTitle('')
        setNewContent('')
        setNewType('info')
        await loadAnnouncements()
      } else {
        setError('创建失败: ' + result.message)
      }
    } catch (err) {
      setError('网络错误: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  // 删除公告
  const deleteAnnouncement = async (id: string) => {
    if (!confirm('确定要删除这个公告吗？')) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()
      if (result.success) {
        await loadAnnouncements()
      } else {
        setError('删除失败: ' + result.message)
      }
    } catch (err) {
      setError('网络错误: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">公告API测试页面</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            清除错误
          </button>
        </div>
      )}

      {/* 创建公告表单 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">创建新公告</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              标题
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入公告标题..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              内容
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入公告内容..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              类型
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="info">信息</option>
              <option value="warning">警告</option>
              <option value="success">成功</option>
              <option value="error">错误</option>
            </select>
          </div>
          <button
            onClick={createAnnouncement}
            disabled={loading || !newTitle.trim() || !newContent.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '创建中...' : '创建公告'}
          </button>
        </div>
      </div>

      {/* 公告列表 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">公告列表</h2>
          <button
            onClick={loadAnnouncements}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>

        {loading && announcements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无公告</div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`border rounded-lg p-4 ${
                  announcement.type === 'info' ? 'border-blue-200 bg-blue-50' :
                  announcement.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                  announcement.type === 'success' ? 'border-green-200 bg-green-50' :
                  announcement.type === 'error' ? 'border-red-200 bg-red-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {announcement.title}
                    </h3>
                    <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <div className="text-sm text-gray-500">
                      <span>ID: {announcement.id}</span>
                      <span className="ml-4">类型: {announcement.type}</span>
                      <span className="ml-4">创建时间: {new Date(announcement.created_at).toLocaleString('zh-CN')}</span>
                      <span className="ml-4">创建者: {announcement.created_by}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteAnnouncement(announcement.id)}
                    disabled={loading}
                    className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
