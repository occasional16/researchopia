'use client'

import { useState } from 'react'
import { Share2, Check, Link2, Twitter, Facebook, Linkedin } from 'lucide-react'

interface ShareButtonProps {
  url: string
  title?: string
  className?: string
  variant?: 'button' | 'icon' | 'full'
}

/**
 * Share button with multiple options:
 * - Native Web Share API (mobile)
 * - Copy link to clipboard
 * - Social media links (optional)
 */
export default function ShareButton({ 
  url, 
  title, 
  className = '',
  variant = 'button'
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const handleShare = async () => {
    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ url, title })
        return
      } catch (e) {
        // User cancelled or not supported
      }
    }
    
    // On desktop, show dropdown or copy directly
    if (variant === 'icon') {
      await copyToClipboard()
    } else {
      setShowDropdown(!showDropdown)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        setShowDropdown(false)
      }, 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  // Social share URLs
  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title || '')}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleShare}
        className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
        title={copied ? '已复制链接' : '分享'}
      >
        {copied ? (
          <Check size={18} className="text-green-500" />
        ) : (
          <Share2 size={18} className="text-gray-500 hover:text-blue-500" />
        )}
      </button>
    )
  }

  if (variant === 'full') {
    return (
      <div className="relative">
        <button
          onClick={handleShare}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${className}`}
        >
          <Share2 size={16} />
          <span>分享</span>
        </button>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-1 z-50">
            <button
              onClick={copyToClipboard}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Link2 size={16} />}
              {copied ? '已复制' : '复制链接'}
            </button>
            <a
              href={shareUrls.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Twitter size={16} />
              分享到 Twitter
            </a>
            <a
              href={shareUrls.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Linkedin size={16} />
              分享到 LinkedIn
            </a>
          </div>
        )}
      </div>
    )
  }

  // Default button variant
  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
      >
        {copied ? (
          <Check size={14} className="text-green-500" />
        ) : (
          <Share2 size={14} className="text-gray-500" />
        )}
        <span>{copied ? '已复制' : '分享'}</span>
      </button>

      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-1 z-50">
          <button
            onClick={copyToClipboard}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Link2 size={14} />
            复制链接
          </button>
          <a
            href={shareUrls.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Twitter size={14} />
            Twitter
          </a>
        </div>
      )}
    </div>
  )
}
