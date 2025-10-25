'use client'

import Link from 'next/link'
import UserHoverCard from './UserHoverCard'

interface UserLinkProps {
  username: string
  displayName?: string
  showHoverCard?: boolean
  className?: string
  isAnonymous?: boolean
}

export default function UserLink({
  username,
  displayName,
  showHoverCard = true,
  className = '',
  isAnonymous = false
}: UserLinkProps) {
  // 匿名用户不显示hover卡片和链接
  if (isAnonymous) {
    return (
      <span className={`text-gray-500 ${className}`}>
        匿名用户
      </span>
    )
  }

  const linkElement = (
    <Link
      href={`/profile/${username}`}
      className={`font-medium text-gray-900 hover:text-blue-600 transition-colors ${className}`}
    >
      {displayName || username}
    </Link>
  )

  if (!showHoverCard) {
    return linkElement
  }

  return (
    <UserHoverCard username={username}>
      {linkElement}
    </UserHoverCard>
  )
}
