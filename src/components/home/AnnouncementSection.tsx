'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import AnnouncementForm from '@/components/AnnouncementForm'

// Date formatting utility to avoid hydration errors
function formatDate(dateString: string): string {
  if (typeof window === 'undefined') return dateString
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

interface Announcement {
  id: string
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error' | string
  created_at: string
  created_by?: string
}

interface AnnouncementSectionProps {
  announcements: Announcement[]
  isAdmin: boolean
  onDelete: (id: string) => void
  onRefresh: () => Promise<void>
}

// Helper function to get type-based styles
function getTypeStyles(type: string) {
  switch (type) {
    case 'info':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-400 dark:border-blue-600',
        badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
        gradient: 'from-blue-50 dark:from-blue-900/20'
      }
    case 'warning':
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-400 dark:border-yellow-600',
        badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200',
        gradient: 'from-yellow-50 dark:from-yellow-900/20'
      }
    case 'success':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-400 dark:border-green-600',
        badge: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
        gradient: 'from-green-50 dark:from-green-900/20'
      }
    case 'error':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-400 dark:border-red-600',
        badge: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
        gradient: 'from-red-50 dark:from-red-900/20'
      }
    default:
      return {
        bg: 'bg-gray-50 dark:bg-gray-800',
        border: 'border-gray-400 dark:border-gray-600',
        badge: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
        gradient: 'from-gray-50 dark:from-gray-800'
      }
  }
}

export default function AnnouncementSection({
  announcements,
  isAdmin,
  onDelete,
  onRefresh
}: AnnouncementSectionProps) {
  const [expandedAnnouncement, setExpandedAnnouncement] = useState(false)
  const [showAnnouncementHistory, setShowAnnouncementHistory] = useState(false)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)

  const currentAnnouncement = announcements[0]

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setShowAnnouncementForm(true)
    setShowAnnouncementHistory(false)
  }

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('确定要删除这条公告吗？')) return
    onDelete(id)
  }

  return (
    <>
      {/* Current Announcement - 只展示最新一条 */}
      {currentAnnouncement && (
        <div
          className={`rounded-lg shadow-md border-l-4 transition-colors ${getTypeStyles(currentAnnouncement.type).bg} ${getTypeStyles(currentAnnouncement.type).border} ${expandedAnnouncement ? 'p-3' : 'px-3 py-2'}`}
        >
          <div>
            <div>
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center flex-1 min-w-0 cursor-pointer"
                  onClick={() => setExpandedAnnouncement(!expandedAnnouncement)}
                >
                  <div className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getTypeStyles(currentAnnouncement.type).badge}`}>
                    📢
                  </div>
                  <h3 className="ml-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {currentAnnouncement.title}
                  </h3>
                  {/* 折叠状态下显示发布时间和发布者 */}
                  {!expandedAnnouncement && (
                    <div className="ml-2 flex items-center text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                      <span>{formatDate(currentAnnouncement.created_at)}</span>
                      {currentAnnouncement.created_by && (
                        <span className="ml-1.5">· {currentAnnouncement.created_by}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* 展开/收起按钮 */}
                  <button
                    onClick={() => setExpandedAnnouncement(!expandedAnnouncement)}
                    className="text-[10px] text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
                  >
                    {expandedAnnouncement ? '▲' : '▼'}
                  </button>
                  {/* 查看历史按钮 */}
                  {announcements.length > 1 && (
                    <button
                      onClick={() => setShowAnnouncementHistory(!showAnnouncementHistory)}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                    >
                      历史({announcements.length - 1})
                    </button>
                  )}
                </div>
              </div>
              
              {/* 展开状态下显示内容 */}
              {expandedAnnouncement && (
                <>
                  <div className="mt-2 text-gray-700 dark:text-gray-300 markdown-content markdown-content-compact text-sm leading-relaxed">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        a: ({ node, href, ...props }) => {
                          // Anchor links (starting with #) should not open in new tab
                          if (href?.startsWith('#')) {
                            return <a href={href} {...props} className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()} />
                          }
                          // External links open in new tab
                          return <a href={href} {...props} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} />
                        }
                      }}
                    >
                      {currentAnnouncement.content}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      发布时间: {formatDate(currentAnnouncement.created_at)}
                      {currentAnnouncement.created_by && (
                        <span className="ml-3">发布者: {currentAnnouncement.created_by}</span>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex space-x-1.5">
                        <button
                          onClick={() => handleEditAnnouncement(currentAnnouncement)}
                          className="px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        >
                          ✏️ 编辑
                        </button>
                        <button
                          onClick={() => handleDeleteAnnouncement(currentAnnouncement.id)}
                          className="px-2 py-0.5 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        >
                          🗑️ 删除
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Announcement History Modal */}
      {showAnnouncementHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">📜 公告历史记录</h2>
              <button
                onClick={() => setShowAnnouncementHistory(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {announcements.map((announcement, index) => {
                  const styles = getTypeStyles(announcement.type)
                  return (
                    <div
                      key={announcement.id}
                      className={`rounded-lg border-l-4 p-3 ${styles.bg} ${styles.border}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
                              {index === 0 ? '📢 最新' : `#${index + 1}`}
                            </div>
                            <h3 className="ml-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {announcement.title}
                            </h3>
                          </div>
                          <div className="mt-1.5 text-gray-700 dark:text-gray-300 markdown-content markdown-content-compact text-sm">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                a: ({ node, ...props }) => (
                                  <a {...props} target="_blank" rel="noopener noreferrer" />
                                )
                              }}
                            >
                              {announcement.content}
                            </ReactMarkdown>
                          </div>
                          <div className="mt-2 flex justify-between items-center">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(announcement.created_at)}
                              {announcement.created_by && (
                                <span className="ml-3">发布者: {announcement.created_by}</span>
                              )}
                            </div>
                            {isAdmin && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => handleEditAnnouncement(announcement)}
                                  className="px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() => handleDeleteAnnouncement(announcement.id)}
                                  className="px-2 py-0.5 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                >
                                  删除
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <button
                onClick={() => setShowAnnouncementHistory(false)}
                className="w-full px-3 py-1.5 bg-gray-600 dark:bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Announcement Management */}
      {isAdmin && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 transition-colors">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                管理员 - 公告管理
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingAnnouncement(null)
                    setShowAnnouncementForm(!showAnnouncementForm)
                    setShowAnnouncementHistory(false)
                  }}
                  className="inline-flex items-center px-4 py-2 bg-green-600 dark:bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                >
                  {showAnnouncementForm ? '❌ 取消' : '➕ 新建公告'}
                </button>
                <button
                  onClick={() => {
                    setShowAnnouncementHistory(!showAnnouncementHistory)
                    setShowAnnouncementForm(false)
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  📜 历史管理 ({announcements.length})
                </button>
              </div>
            </div>
          </div>

          {showAnnouncementForm && (
            <div className="px-6 py-4">
              <AnnouncementForm
                editingAnnouncement={editingAnnouncement}
                onSuccess={async () => {
                  setShowAnnouncementForm(false)
                  setEditingAnnouncement(null)
                  await onRefresh()
                  alert(editingAnnouncement ? '公告已更新' : '公告已发布')
                }}
                onCancel={() => {
                  setShowAnnouncementForm(false)
                  setEditingAnnouncement(null)
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}
