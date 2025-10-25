'use client'

import Link from 'next/link'
import { User } from 'lucide-react'
import UserHoverCard from './UserHoverCard'

interface UserAvatarProps {
  username: string
  avatarUrl?: string | null
  realName?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showHoverCard?: boolean
  clickable?: boolean
  className?: string
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16'
}

const iconSizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8'
}

export default function UserAvatar({
  username,
  avatarUrl,
  realName,
  size = 'md',
  showHoverCard = true,
  clickable = true,
  className = ''
}: UserAvatarProps) {
  const avatarElement = (
    <div className={`relative ${clickable ? 'cursor-pointer' : ''} ${className}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={realName || username}
          className={`${sizeClasses[size]} rounded-full object-cover ${clickable ? 'hover:ring-2 hover:ring-blue-300 transition-all' : ''}`}
          title={realName || username}
        />
      ) : (
        <div 
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center ${clickable ? 'hover:ring-2 hover:ring-blue-300 transition-all' : ''}`}
          title={realName || username}
        >
          <User className={`${iconSizeClasses[size]} text-white`} />
        </div>
      )}
    </div>
  )

  if (!clickable && !showHoverCard) {
    return avatarElement
  }

  if (!showHoverCard && clickable) {
    return (
      <Link href={`/profile/${username}`}>
        {avatarElement}
      </Link>
    )
  }

  return (
    <UserHoverCard username={username}>
      {clickable ? (
        <Link href={`/profile/${username}`}>
          {avatarElement}
        </Link>
      ) : (
        avatarElement
      )}
    </UserHoverCard>
  )
}
