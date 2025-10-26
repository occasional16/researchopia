'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PaperList from '@/components/papers/PaperList'
import { SmartSearch } from '@/components/search/SmartSearch'
import { PaperListSkeleton, EmptyState } from '@/components/ui/LoadingStates'

function SearchContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const error = searchParams.get('error') || ''
  
  const [activeSearch, setActiveSearch] = useState(query)
  const [errorMessage, setErrorMessage] = useState(error)

  useEffect(() => {
    setActiveSearch(query)
    setErrorMessage(error)
  }, [query, error])

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      const encodedQuery = encodeURIComponent(searchQuery.trim())
      window.history.pushState({}, '', `/search?q=${encodedQuery}`)
      setActiveSearch(searchQuery.trim())
      setErrorMessage('') // 清除错误消息
    }
  }

  const handlePaperAdded = (paper: any) => {
    // 论文添加成功后的回调
    console.log('Paper added:', paper)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          智能论文搜索
        </h1>
        
        {/* Smart Search Component */}
        <SmartSearch 
          onSearch={handleSearch}
          onPaperAdded={handlePaperAdded}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">无法获取论文信息</h3>
              <p className="mt-2 text-sm text-red-700 whitespace-pre-wrap">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage('')}
              className="ml-auto flex-shrink-0 text-red-400 hover:text-red-500"
            >
              <span className="sr-only">关闭</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Search Results Header */}
      {activeSearch && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            搜索结果: "{activeSearch}"
          </h2>
        </div>
      )}

      {/* Search Results using PaperList with infinite scroll */}
      {activeSearch ? (
        <PaperList 
          searchTerm={activeSearch}
          showInfiniteScroll={true}
        />
      ) : (
        /* Welcome State - No search query */
        <EmptyState
          title="开始智能搜索"
          description="输入论文标题、作者、关键词，或直接粘贴DOI号来查找或添加论文"
          action={
            <div className="space-y-4 text-sm text-gray-600 max-w-2xl mx-auto">
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">🔍 智能搜索</h3>
                  <ul className="space-y-1 text-left">
                    <li>• 关键词搜索现有论文</li>
                    <li>• 作者姓名查找</li>
                    <li>• 期刊名称筛选</li>
                    <li>• 标题内容匹配</li>
                  </ul>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">📄 自动添加</h3>
                  <ul className="space-y-1 text-left">
                    <li>• 输入DOI自动抓取</li>
                    <li>• 检查是否已存在</li>
                    <li>• 从CrossRef获取信息</li>
                    <li>• 一键添加到数据库</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">示例DOI格式：</h4>
                <div className="font-mono text-sm text-blue-800 space-y-1">
                  <div>10.1038/nature12373</div>
                  <div>https://doi.org/10.1126/science.1234567</div>
                  <div>10.1016/j.cell.2023.01.001</div>
                </div>
              </div>
            </div>
          }
        />
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            智能论文搜索
          </h1>
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="w-full pl-12 pr-32 py-4 border border-gray-300 rounded-lg bg-gray-50 animate-pulse h-14"></div>
            </div>
          </div>
        </div>
        <PaperListSkeleton count={3} />
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}
