'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'

/**
 * 生产环境信息组件
 * 可选择性显示系统状态，但不会让用户误以为是开发版本
 */
export default function SystemInfo() {
  const [showInfo, setShowInfo] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // 只在用户主动点击时显示详细信息
  if (dismissed) return null

  return (
    <>
      {/* 可选的系统信息触发器 - 放在页脚或不显眼位置 */}
      {!showInfo && (
        <button
          onClick={() => setShowInfo(true)}
          className="fixed bottom-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full shadow-sm transition-colors opacity-50 hover:opacity-100"
          title="系统信息"
        >
          <Info className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {/* 系统信息模态框 */}
      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">系统信息</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">认证系统：</span>
                <span className="text-green-600 font-medium">本地认证</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">数据存储：</span>
                <span className="text-blue-600 font-medium">浏览器本地存储</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">状态同步：</span>
                <span className="text-orange-600 font-medium">单用户模式</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 <strong>提示：</strong>当前系统为独立模式，数据仅存储在您的浏览器中。
                这确保了数据隐私和快速响应。
              </p>
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowInfo(false)
                  setDismissed(true)
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                不再显示
              </button>
              <button
                onClick={() => setShowInfo(false)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                了解
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
