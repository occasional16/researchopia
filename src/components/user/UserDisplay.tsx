'use client'

import UserAvatar from './UserAvatar'
import UserLink from './UserLink'
import UserHoverCard from './UserHoverCard'

interface UserDisplayProps {
  username: string
  avatarUrl?: string | null
  realName?: string
  showAvatar?: boolean
  avatarSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showHoverCard?: boolean
  isAnonymous?: boolean
  className?: string
}

export default function UserDisplay({
  username,
  avatarUrl,
  realName,
  showAvatar = true,
  avatarSize = 'sm',
  showHoverCard = true,
  isAnonymous = false,
  className = ''
}: UserDisplayProps) {
  // 匿名用户特殊处理
  if (isAnonymous) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showAvatar && (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        <span className="text-gray-500">匿名用户</span>
      </div>
    )
  }

  // 非匿名用户 - 整个区域使用一个hover card
  return (
    <UserHoverCard username={username}>
      <div className={`flex items-center gap-2 ${className}`}>
        {showAvatar && (
          <UserAvatar
            username={username}
            avatarUrl={avatarUrl}
            realName={realName}
            size={avatarSize}
            showHoverCard={false}
            clickable={true}
          />
        )}
        <UserLink
          username={username}
          displayName={realName}
          showHoverCard={false}
          isAnonymous={false}
        />
      </div>
    </UserHoverCard>
  )
}
