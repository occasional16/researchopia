'use client'

import { useState } from 'react'
import { Search, Filter, Plus, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import PaperList from '@/components/papers/PaperList'

export default function PapersPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'rating' | 'comments' | 'recent_comments'>('recent_comments')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const encodedQuery = encodeURIComponent(searchQuery.trim())
      window.location.href = `/search?q=${encodedQuery}`
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                <BookOpen className="mr-3 text-blue-600 dark:text-blue-400" />
                所有论文
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                浏览学术论文数据库，或前往搜索页面添加新论文
              </p>
            </div>
            <Link
              href="/search"
              className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              搜索/添加论文
            </Link>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索论文标题、作者、期刊或DOI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-16 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="absolute right-2 top-1 px-3 py-1 bg-blue-600 dark:bg-blue-700 text-white text-sm rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                搜索
              </button>
            </form>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => {
                  const newSortBy = e.target.value as any
                  console.log('排序改变为:', newSortBy)
                  setSortBy(newSortBy)
                }}
                className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="recent_comments">最新评论</option>
                <option value="rating">评分最高</option>
                <option value="comments">评论最多</option>
              </select>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              使用无限滚动浏览所有论文，或者使用上方搜索框进行精确查找
            </div>
          </div>
        </div>

        {/* Papers List with Infinite Scroll */}
        <PaperList showInfiniteScroll={true} sortBy={sortBy} />
      </div>
    </div>
  )
}
