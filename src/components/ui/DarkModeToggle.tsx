"use client"

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  // 仅在客户端挂载后执行
  useEffect(() => {
    setMounted(true)
    const darkStored = localStorage.getItem('rp-dark-mode')
    const initial = darkStored === '1'
    setIsDark(initial)
    if (initial) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    
    if (next) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    
    try { 
      localStorage.setItem('rp-dark-mode', next ? '1' : '0')
    } catch (e) {
      // Silently fail if localStorage is unavailable
    }
  }

  // 避免 hydration 不匹配
  if (!mounted) {
    return <div className="w-9 h-9" /> // 占位符
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? '切换为浅色模式' : '切换为深色模式'}
      className="p-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
