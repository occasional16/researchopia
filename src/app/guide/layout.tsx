'use client'

import { ReactNode, useEffect } from 'react'

export default function GuideRootLayout({
  children,
}: {
  children: ReactNode
}) {
  // 确保深色模式从 localStorage 同步
  useEffect(() => {
    const darkStored = localStorage.getItem('rp-dark-mode')
    if (darkStored === '1' && !document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  return (
    <div className="w-full -mx-4 sm:-mx-6 lg:-mx-8 -my-8 bg-gray-50 dark:bg-gray-900 transition-colors">
      {children}
    </div>
  )
}
