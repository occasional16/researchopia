'use client'

import { useState } from 'react'
import { Search, ExternalLink, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { isValidDOI } from '@/lib/crossref'
import { searchOrCreatePaperByDOI } from '@/lib/database'

export default function DOISearch() {
  const router = useRouter()
  const [doi, setDoi] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [paperPreview, setPaperPreview] = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!doi.trim()) {
      setError('请输入DOI')
      return
    }

    const cleanDOI = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    
    if (!isValidDOI(cleanDOI)) {
      setError('DOI格式不正确，请输入有效的DOI（如：10.1000/example.2023.001）')
      return
    }

    setLoading(true)
    setError('')

    try {
      const papers = await searchOrCreatePaperByDOI(cleanDOI)
      if (papers && papers.length > 0) {
        const paper = papers[0]
        setPaperPreview(paper)
        setSuccess(`成功找到论文: ${paper.title}`)

        // Auto redirect after 2 seconds, or user can click
        setTimeout(() => {
          router.push(`/papers/${paper.id}`)
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || '搜索失败，请检查DOI是否正确')
      setPaperPreview(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDoiChange = (value: string) => {
    setDoi(value)
    setError('')
    setSuccess('')
    setPaperPreview(null)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Plus className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">通过DOI添加论文</h3>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        输入DOI号，系统将自动从学术数据库获取论文信息
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {paperPreview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-blue-900 mb-2">找到论文:</h4>
          <h5 className="font-medium text-gray-900 mb-1">{paperPreview.title}</h5>
          <p className="text-sm text-gray-600 mb-2">
            作者: {paperPreview.authors?.join(', ') || '未知'}
          </p>
          {paperPreview.journal && (
            <p className="text-sm text-gray-600 mb-2">
              期刊: {paperPreview.journal}
            </p>
          )}
          <div className="flex space-x-2 mt-3">
            <button
              onClick={() => router.push(`/papers/${paperPreview.id}`)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              立即查看
            </button>
            <span className="text-xs text-gray-500 self-center">2秒后自动跳转...</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="doi" className="block text-sm font-medium text-gray-700 mb-2">
            DOI号
          </label>
          <div className="relative">
            <input
              id="doi"
              type="text"
              value={doi}
              onChange={(e) => handleDoiChange(e.target.value)}
              placeholder="10.1000/example.2023.001 或 https://doi.org/10.1000/example.2023.001"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            支持完整DOI链接或DOI号码
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !doi.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '搜索中...' : '搜索并添加论文'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">快速测试</h4>
        <p className="text-xs text-gray-600 mb-3">
          点击下面的示例DOI来测试搜索功能：
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleDoiChange('10.1038/nature17946')}
            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
          >
            10.1038/nature17946
          </button>
          <button
            onClick={() => handleDoiChange('10.1126/science.aaf2654')}
            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
          >
            10.1126/science.aaf2654
          </button>
          <button
            onClick={() => handleDoiChange('10.1038/s41586-019-1666-5')}
            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
          >
            10.1038/s41586-019-1666-5
          </button>
        </div>

        <h4 className="text-sm font-medium text-gray-900 mb-2">什么是DOI？</h4>
        <p className="text-xs text-gray-600 mb-2">
          DOI（Digital Object Identifier）是学术论文的唯一标识符，通常格式为 10.xxxx/xxxxxx
        </p>
        <div className="flex items-center space-x-1 text-xs text-blue-600">
          <ExternalLink className="w-3 h-3" />
          <a
            href="https://www.doi.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            了解更多关于DOI
          </a>
        </div>
      </div>
    </div>
  )
}
