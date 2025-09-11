'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PaperList from '@/components/papers/PaperList'
import { SmartSearch } from '@/components/search/SmartSearch'
import { PaperListSkeleton, EmptyState } from '@/components/ui/LoadingStates'

function SearchContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  
  const [activeSearch, setActiveSearch] = useState(query)

  useEffect(() => {
    setActiveSearch(query)
  }, [query])

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      const encodedQuery = encodeURIComponent(searchQuery.trim())
      window.history.pushState({}, '', `/search?q=${encodedQuery}`)
      setActiveSearch(searchQuery.trim())
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
