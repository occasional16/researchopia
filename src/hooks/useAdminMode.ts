'use client'

import { useState, useEffect } from 'react'

export function useAdminMode() {
  const [isAdminMode, setIsAdminMode] = useState(false)
  
  useEffect(() => {
    // 在开发环境中，从localStorage读取管理员模式状态
    if (typeof window !== 'undefined') {
      const savedAdminMode = localStorage.getItem('admin_mode') === 'true'
      setIsAdminMode(savedAdminMode)
    }
  }, [])
  
  const toggleAdminMode = () => {
    const newMode = !isAdminMode
    setIsAdminMode(newMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_mode', newMode.toString())
    }
  }
  
  return {
    isAdminMode,
    toggleAdminMode
  }
}