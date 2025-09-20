'use client'

import { useState, useEffect } from 'react'

export default function TestAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/announcements?active=true')
      const data = await response.json()
      
      if (data.success) {
        setAnnouncements(data.data)
      } else {
        setError(data.message)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createTestAnnouncement = async () => {
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: '测试公告',
          content: '这是一个测试公告，用于验证公告系统是否正常工作。',
          type: 'info',
          is_active: true
        }),
      })

      const data = await response.json()
      if (data.success) {
        alert('公告创建成功！')
        fetchAnnouncements()
      } else {
        alert('创建失败: ' + data.message)
      }
    } catch (err) {
      alert('创建失败: ' + err.message)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">公告系统测试</h1>
      
      <div className="mb-6">
        <button
          onClick={createTestAnnouncement}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          创建测试公告
        </button>
        <button
          onClick={fetchAnnouncements}
          className="ml-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          刷新公告
        </button>
      </div>

      {loading && <p>加载中...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          错误: {error}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">当前公告 ({announcements.length})</h2>
        
        {announcements.length === 0 && !loading && (
          <p className="text-gray-500">暂无公告</p>
        )}
        
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className={`p-4 rounded-lg border-l-4 ${
              announcement.type === 'info' ? 'bg-blue-50 border-blue-400' :
              announcement.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
              announcement.type === 'success' ? 'bg-green-50 border-green-400' :
              announcement.type === 'error' ? 'bg-red-50 border-red-400' :
              'bg-gray-50 border-gray-400'
            }`}
          >
            <div className="flex items-center mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                announcement.type === 'info' ? 'bg-blue-100 text-blue-800' :
                announcement.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                announcement.type === 'success' ? 'bg-green-100 text-green-800' :
                announcement.type === 'error' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                📢 {announcement.type}
              </span>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">
                {announcement.title}
              </h3>
            </div>
            <p className="text-gray-700 mb-2">{announcement.content}</p>
            <div className="text-sm text-gray-500">
              发布时间: {new Date(announcement.created_at).toLocaleString('zh-CN')}
              {announcement.created_by && (
                <span className="ml-4">发布者: {announcement.created_by}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
