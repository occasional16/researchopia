'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, X } from 'lucide-react'
/**
 * 配置状态组件 - 显示系统状态
 */
export default function ConfigWarning() {
  const [showStatus, setShowStatus] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const wasDismissed = localStorage.getItem('config-status-dismissed') === 'true'
    
    // 显示Supabase连接成功提示
    setShowStatus(!wasDismissed)
  }, [])

  const handleDismiss = () => {
    setShowStatus(false)
    setDismissed(true)
    localStorage.setItem('config-status-dismissed', 'true')
  }

  if (!showStatus) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-green-50 border-b border-green-200 p-3 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              �?已连接到在线数据�?- 数据将实时同�?            </p>
            <p className="text-xs text-green-700 mt-1">
              论文、评分、评论等数据现在在所有用户间同步
            </p>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="text-green-600 hover:text-green-800 transition-colors"
          title="关闭提示"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
