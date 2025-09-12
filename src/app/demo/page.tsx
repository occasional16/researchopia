'use client'

import { useState } from 'react'
import { initializeSampleData, clearMockData, resetToSampleData } from '@/lib/mockData'
import PaperReports from '@/components/papers/PaperReports'
import PlumXWidget from '@/components/papers/PlumXWidget'

export default function DemoPage() {
  const [showReports, setShowReports] = useState(true) // 默认显示报道管理
  const [isAdminMode, setIsAdminMode] = useState(false)
  
  const handleInitData = () => {
    initializeSampleData()
    alert('示例数据已初始化！')
    // 刷新页面以加载数据
    window.location.reload()
  }

  const handleClearData = () => {
    clearMockData()
    alert('所有数据已清除！')
    window.location.reload()
  }

  const handleResetData = () => {
    resetToSampleData()
    alert('已重置为示例数据！')
    window.location.reload()
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          🧪 功能演示页面
        </h1>
        <p className="text-gray-600 mb-6">
          测试编辑删除功能和PlumX集成
        </p>
        
        {/* 数据管理按钮 */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <button
            onClick={handleInitData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            初始化示例数据
          </button>
          <button
            onClick={handleResetData}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            重置数据
          </button>
          <button
            onClick={handleClearData}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            清除所有数据
          </button>
          
          {/* 管理员模式切换 */}
          <div className="flex items-center space-x-2 ml-4 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <input
              type="checkbox"
              id="adminMode"
              checked={isAdminMode}
              onChange={(e) => setIsAdminMode(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="adminMode" className="text-sm font-medium text-yellow-800">
              👑 管理员模式
            </label>
            {isAdminMode && (
              <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">
                可删除所有报道
              </span>
            )}
          </div>
        </div>

        <div className="border-t pt-6">
          <button
            onClick={() => setShowReports(!showReports)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 mb-4"
          >
            {showReports ? '隐藏' : '显示'} 报道管理演示
          </button>
        </div>
      </div>

      {/* PlumX Widget 演示 */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          📊 PlumX Widget 演示
        </h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              示例论文 1: 深度学习与气候变化预测
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              DOI: 10.1038/s41586-023-12345-6
            </p>
            <PlumXWidget 
              doi="10.1038/s41586-023-12345-6"
              widgetType="summary"
              hideWhenEmpty={true}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              示例论文 2: 量子计算在药物发现中的应用
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              DOI: 10.1126/science.2023.11223
            </p>
            <PlumXWidget 
              doi="10.1126/science.2023.11223"
              widgetType="details"
              hideWhenEmpty={true}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              无DOI示例 (显示占位符)
            </h3>
            <PlumXWidget 
              widgetType="summary"
              hideWhenEmpty={false}
            />
          </div>
        </div>
      </div>

      {/* Paper Reports 演示 */}
      {showReports && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📰 报道管理功能演示
          </h2>
          
          <PaperReports 
            paperId="1"
            paperTitle="Deep Learning for Climate Change Prediction: A Comprehensive Review"
            paperDOI="10.1038/s41586-023-12345-6"
            isAdminMode={isAdminMode}
          />
        </div>
      )}
      
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-800 mb-2">🎯 可见性设计说明:</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div className="mb-3">
            <strong className="text-green-600">✅ 全局共享模式（当前采用）:</strong>
            <ul className="ml-4 mt-1 space-y-1">
              <li>• <strong>所有用户可查看</strong>: 智能爬取和手动添加的报道对所有用户可见</li>
              <li>• <strong>权限控制</strong>: 只能编辑/删除自己添加的报道条目</li>
              <li>• <strong>贡献认证</strong>: 显示每条报道的贡献者和添加方式</li>
              <li>• <strong>协作优势</strong>: 避免重复工作，让学术信息更完整</li>
            </ul>
          </div>
        </div>
        
        <h3 className="text-sm font-medium text-gray-800 mb-2">使用说明:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>初始化示例数据</strong>: 加载3篇示例论文到本地存储</li>
          <li>• <strong>👑 管理员模式</strong>: 开启后可编辑删除任何用户的报道</li>
          <li>• <strong>PlumX Widget</strong>: 显示学术影响力指标 (需要真实DOI才能显示数据)</li>
          <li>• <strong>报道管理</strong>: 测试编辑、删除、智能爬取功能</li>
          <li>• <strong>编辑功能</strong>: 点击报道条目右侧的编辑按钮</li>
          <li>• <strong>删除功能</strong>: 点击垃圾桶图标删除报道 (普通用户只能删除自己的)</li>
          <li>• <strong>智能爬取</strong>: 从5个科技新闻源自动搜索相关报道</li>
          <li>• <strong>统计面板</strong>: 显示社区贡献统计和最佳贡献者</li>
        </ul>
      </div>
    </div>
  )
}