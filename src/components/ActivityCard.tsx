'use client'

import Link from 'next/link'
import { 
  BookOpen, FileText, MessageCircle, Star, Heart, UserPlus, User 
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface Activity {
  id: string
  user_id: string
  activity_type: string
  paper_id?: string
  annotation_id?: string
  comment_id?: string
  rating_id?: string
  target_user_id?: string
  content_preview?: string
  visibility: string
  created_at: string
  metadata?: any
  user: {
    id: string
    username: string
    real_name?: string
    avatar_url?: string
    institution?: string
    position?: string
  }
  paper?: {
    id: string
    title: string
    doi?: string
    publication_year?: number
    authors?: string[]
  }
  target_user?: {
    id: string
    username: string
    real_name?: string
    avatar_url?: string
  }
}

interface ActivityCardProps {
  activity: Activity
}

export default function ActivityCard({ activity }: ActivityCardProps) {
  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case 'paper_added':
        return <BookOpen className="w-5 h-5 text-blue-600" />
      case 'annotation_added':
        return <FileText className="w-5 h-5 text-purple-600" />
      case 'comment_added':
        return <MessageCircle className="w-5 h-5 text-green-600" />
      case 'rating_added':
        return <Star className="w-5 h-5 text-yellow-600" />
      case 'paper_favorited':
        return <Heart className="w-5 h-5 text-red-600" />
      case 'user_followed':
        return <UserPlus className="w-5 h-5 text-indigo-600" />
      default:
        return <User className="w-5 h-5 text-gray-600" />
    }
  }

  const getActivityText = () => {
    switch (activity.activity_type) {
      case 'paper_added':
        return '添加了论文'
      case 'annotation_added':
        return '添加了标注'
      case 'comment_added':
        return '发表了评论'
      case 'rating_added':
        return '评分了论文'
      case 'paper_favorited':
        return '收藏了论文'
      case 'user_followed':
        return '关注了'
      default:
        return '进行了操作'
    }
  }

  const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
    addSuffix: true,
    locale: zhCN
  })

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 border border-gray-100">
      <div className="flex gap-4">
        {/* 用户头像 */}
        <Link href={`/profile/${activity.user.username}`} className="flex-shrink-0">
          {activity.user.avatar_url ? (
            <img
              src={activity.user.avatar_url}
              alt={activity.user.username}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {activity.user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </Link>

        {/* 动态内容 */}
        <div className="flex-1 min-w-0">
          {/* 用户信息和动态类型 */}
          <div className="flex items-center gap-2 mb-2">
            <Link 
              href={`/profile/${activity.user.username}`}
              className="font-semibold text-gray-900 hover:text-blue-600"
            >
              {activity.user.real_name || activity.user.username}
            </Link>
            <span className="text-gray-500 text-sm">{getActivityText()}</span>
            {getActivityIcon()}
          </div>

          {/* 机构信息 */}
          {activity.user.institution && (
            <div className="text-sm text-gray-600 mb-2">
              {activity.user.position && `${activity.user.position} · `}
              {activity.user.institution}
            </div>
          )}

          {/* 动态详情 */}
          {activity.activity_type === 'user_followed' && activity.target_user && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <Link 
                href={`/profile/${activity.target_user.username}`}
                className="flex items-center gap-2 hover:text-blue-600"
              >
                {activity.target_user.avatar_url ? (
                  <img
                    src={activity.target_user.avatar_url}
                    alt={activity.target_user.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {activity.target_user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="font-medium">
                  {activity.target_user.real_name || activity.target_user.username}
                </span>
              </Link>
            </div>
          )}

          {activity.paper && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <Link 
                href={`/papers/${activity.paper.id}`}
                className="block hover:text-blue-600"
              >
                <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">
                  {activity.paper.title}
                </h4>
                {activity.paper.authors && activity.paper.authors.length > 0 && (
                  <p className="text-sm text-gray-600 mb-1">
                    {activity.paper.authors.slice(0, 3).join(', ')}
                    {activity.paper.authors.length > 3 && ' et al.'}
                  </p>
                )}
                {activity.paper.publication_year && (
                  <p className="text-sm text-gray-500">
                    {activity.paper.publication_year}
                  </p>
                )}
              </Link>
            </div>
          )}

          {/* 内容预览 */}
          {activity.content_preview && !activity.paper && (
            <div className="mt-2 text-gray-700 text-sm">
              {activity.content_preview}
            </div>
          )}

          {/* 时间 */}
          <div className="mt-2 text-xs text-gray-500">
            {timeAgo}
          </div>
        </div>
      </div>
    </div>
  )
}

