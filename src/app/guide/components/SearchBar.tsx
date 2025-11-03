'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import Link from 'next/link'
import Fuse from 'fuse.js'
import { guideConfig } from '../guide-config'

interface SearchResult {
  category: string
  categoryTitle: string
  slug: string
  title: string
  description: string
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const searchRef = useRef<HTMLDivElement>(null)

  // 构建搜索索引
  const searchIndex = guideConfig.flatMap((category) =>
    category.items.map((item) => ({
      category: category.slug,
      categoryTitle: category.title,
      slug: item.slug,
      title: item.title,
      description: item.description,
    }))
  )

  // 配置 Fuse.js
  const fuse = new Fuse(searchIndex, {
    keys: ['title', 'description', 'categoryTitle'],
    threshold: 0.3,
    includeScore: true,
  })

  // 处理搜索
  useEffect(() => {
    if (query.trim().length > 0) {
      const searchResults = fuse.search(query)
      setResults(searchResults.map((r) => r.item))
      setIsOpen(true)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [query])

  // 点击外部关闭搜索
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 键盘快捷键 (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('guide-search')?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      {/* 搜索输入框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
        <input
          id="guide-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索指南... (Ctrl+K)"
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setIsOpen(false)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 搜索结果下拉 */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          <div className="p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2">
              找到 {results.length} 个结果
            </p>
            {results.map((result) => (
              <Link
                key={`${result.category}-${result.slug}`}
                href={`/guide/${result.category}/${result.slug}`}
                onClick={() => {
                  setQuery('')
                  setIsOpen(false)
                }}
                className="block px-3 py-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {result.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {result.categoryTitle}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">
                      {result.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 无结果提示 */}
      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            未找到匹配的指南页面
          </p>
        </div>
      )}
    </div>
  )
}
