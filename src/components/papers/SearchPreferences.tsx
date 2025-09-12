'use client'

import { useState, useEffect } from 'react'
import { Settings, X } from 'lucide-react'

interface SearchSite {
  name: string
  nameZh: string
  description: string
  category: 'general' | 'database' | 'repository' | 'chinese'
}

interface SearchPreferencesProps {
  sites: SearchSite[]
  selectedSites: string[]
  onSitesChange: (sites: string[]) => void
  onClose: () => void
}

const categoryNames = {
  general: '通用搜索',
  database: '学术数据库',
  repository: '论文仓库',
  chinese: '中文平台'
}

export default function SearchPreferences({ sites, selectedSites, onSitesChange, onClose }: SearchPreferencesProps) {
  const [localSelectedSites, setLocalSelectedSites] = useState(selectedSites)
  
  const handleSiteToggle = (siteName: string) => {
    setLocalSelectedSites(prev => {
      if (prev.includes(siteName)) {
        return prev.filter(name => name !== siteName)
      } else {
        return [...prev, siteName]
      }
    })
  }
  
  const handleSave = () => {
    onSitesChange(localSelectedSites)
    onClose()
  }
  
  const handleSelectAll = () => {
    setLocalSelectedSites(sites.map(site => site.name))
  }
  
  const handleSelectNone = () => {
    setLocalSelectedSites([])
  }
  
  const handleSelectByCategory = (category: string) => {
    const categorySites = sites.filter(site => site.category === category).map(site => site.name)
    const newSelection = [...new Set([...localSelectedSites, ...categorySites])]
    setLocalSelectedSites(newSelection)
  }
  
  const sitesByCategory = sites.reduce((acc, site) => {
    if (!acc[site.category]) {
      acc[site.category] = []
    }
    acc[site.category].push(site)
    return acc
  }, {} as Record<string, SearchSite[]>)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">搜索偏好设置</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            选择您希望在快捷搜索中显示的学术网站
          </p>
          
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-md hover:bg-blue-200 transition-colors"
            >
              全选
            </button>
            <button
              onClick={handleSelectNone}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
            >
              全不选
            </button>
            {Object.keys(categoryNames).map(category => (
              <button
                key={category}
                onClick={() => handleSelectByCategory(category)}
                className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-md hover:bg-green-200 transition-colors"
              >
                选择{categoryNames[category as keyof typeof categoryNames]}
              </button>
            ))}
          </div>
          
          <div className="space-y-6">
            {Object.entries(sitesByCategory).map(([category, categorySites]) => (
              <div key={category}>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <span>{categoryNames[category as keyof typeof categoryNames]}</span>
                  <span className="text-sm text-gray-500">({categorySites.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categorySites.map((site) => (
                    <label
                      key={site.name}
                      className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        localSelectedSites.includes(site.name)
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={localSelectedSites.includes(site.name)}
                        onChange={() => handleSiteToggle(site.name)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 mb-1">
                          {site.nameZh}
                        </div>
                        <div className="text-xs text-gray-600">
                          {site.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            已选择 {localSelectedSites.length} / {sites.length} 个网站
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}