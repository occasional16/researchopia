'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Bell, User, Heart, MessageCircle, AtSign, 
  AlertCircle, Check, CheckCheck 
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface Notification {
  id: string
  type: string
  content: string
  is_read: boolean
  created_at: string
  target_type?: string
  target_id?: string
  actor?: {
    id: string
    username: string
    avatar_url?: string
    real_name?: string
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const { user, getAccessToken, loading: authLoading } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  useEffect(() => {
    // 等待认证加载完成
    if (authLoading) return

    if (!user) {
      router.push('/')
      return
    }
    loadNotifications()
  }, [user, authLoading, activeFilter])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const accessToken = await getAccessToken()
      if (!accessToken) return

      let url = '/api/notifications?limit=50'
      if (activeFilter !== 'all') {
        if (activeFilter === 'unread') {
          url += '&is_read=false'
        } else {
          url += `&type=${activeFilter}`
        }
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationIds?: string[]) => {
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return

      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notification_ids: notificationIds
        })
      })

      if (response.ok) {
        loadNotifications()
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_follower':
        return <User className="w-5 h-5 text-blue-600" />
      case 'annotation_liked':
        return <Heart className="w-5 h-5 text-red-600" />
      case 'annotation_commented':
      case 'comment_replied':
      case 'paper_commented':
        return <MessageCircle className="w-5 h-5 text-green-600" />
      case 'mention':
        return <AtSign className="w-5 h-5 text-purple-600" />
      case 'system':
        return <AlertCircle className="w-5 h-5 text-gray-600" />
      default:
        return <Bell className="w-5 h-5 text-gray-600" />
    }
  }

  const getNotificationLink = (notification: Notification) => {
    if (notification.target_type === 'paper' && notification.target_id) {
      return `/papers/${notification.target_id}`
    }
    if (notification.target_type === 'annotation' && notification.target_id) {
      return `/annotations/${notification.target_id}`
    }
    if (notification.actor) {
      return `/profile/${notification.actor.username}`
    }
    return null
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString()
  }

  const filters = [
    { id: 'all', name: '全部' },
    { id: 'unread', name: '未读' },
    { id: 'new_follower', name: '关注' },
    { id: 'annotation_liked', name: '点赞' },
    { id: 'annotation_commented', name: '评论' },
    { id: 'system', name: '系统' }
  ]

  // 显示加载状态
  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 头部 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">通知中心</h1>
            {unreadCount > 0 && (
              <span className="px-3 py-1 bg-red-500 dark:bg-red-600 text-white text-sm font-semibold rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAsRead()}
              className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              全部标为已读
            </button>
          )}
        </div>

        {/* 过滤器 */}
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === filter.id
                  ? 'bg-blue-600 dark:bg-blue-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {filter.name}
            </button>
          ))}
        </div>
      </div>

      {/* 通知列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">加载中...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">暂无通知</p>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {notifications.map((notification) => {
              const link = getNotificationLink(notification)
              const NotificationContent = (
                <div
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead([notification.id])
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* 图标 */}
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {notification.actor && (
                            <Link
                              href={`/profile/${notification.actor.username}`}
                              className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {notification.actor.real_name || notification.actor.username}
                            </Link>
                          )}
                          <span className="text-gray-700 dark:text-gray-200 ml-1">{notification.content}</span>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              )

              return link ? (
                <Link key={notification.id} href={link}>
                  {NotificationContent}
                </Link>
              ) : (
                <div key={notification.id}>{NotificationContent}</div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

