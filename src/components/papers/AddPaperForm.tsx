'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { createPaper } from '@/lib/database'

export default function AddPaperForm() {
  const router = useRouter()
  const { user } = useAuth()
  
  const [formData, setFormData] = useState({
    title: '',
    authors: [''],
    doi: '',
    abstract: '',
    keywords: [''],
    publication_date: '',
    journal: '',
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleArrayChange = (field: 'authors' | 'keywords', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }))
  }

  const addArrayItem = (field: 'authors' | 'keywords') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }))
  }

  const removeArrayItem = (field: 'authors' | 'keywords', index: number) => {
    if (formData[field].length > 1) {
      setFormData(prev => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index)
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      // Show auth modal instead of error
      const event = new CustomEvent('showAuthModal', { detail: { mode: 'login' } })
      window.dispatchEvent(event)
      return
    }

    setLoading(true)
    setError('')

    try {
      // Filter out empty strings from arrays
      const cleanedData = {
        ...formData,
        authors: formData.authors.filter(author => author.trim() !== ''),
        keywords: formData.keywords.filter(keyword => keyword.trim() !== ''),
        created_by: user.id,
      }

      if (cleanedData.authors.length === 0) {
        setError('至少需要一个作者')
        setLoading(false)
        return
      }

      if (!user?.id) {
        setError('需要登录才能创建论文')
        setLoading(false)
        return
      }

      const paper = await createPaper(cleanedData, user.id)
      router.push(`/papers/${paper.id}`)
    } catch (err: any) {
      setError(err.message || '创建论文时出错')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">添加新论文</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            论文标题 *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="请输入论文标题"
          />
        </div>

        {/* Authors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            作者 *
          </label>
          {formData.authors.map((author, index) => (
            <div key={index} className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                value={author}
                onChange={(e) => handleArrayChange('authors', index, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`作者 ${index + 1}`}
              />
              {formData.authors.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeArrayItem('authors', index)}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addArrayItem('authors')}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
          >
            <Plus size={16} />
            <span>添加作者</span>
          </button>
        </div>

        {/* DOI */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            DOI
          </label>
          <input
            type="text"
            value={formData.doi}
            onChange={(e) => handleInputChange('doi', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="10.1000/example.2023.001"
          />
        </div>

        {/* Journal */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            期刊/会议
          </label>
          <input
            type="text"
            value={formData.journal}
            onChange={(e) => handleInputChange('journal', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="期刊或会议名称"
          />
        </div>

        {/* Publication Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            发表日期
          </label>
          <input
            type="date"
            value={formData.publication_date}
            onChange={(e) => handleInputChange('publication_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            关键词
          </label>
          {formData.keywords.map((keyword, index) => (
            <div key={index} className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => handleArrayChange('keywords', index, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`关键词 ${index + 1}`}
              />
              {formData.keywords.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeArrayItem('keywords', index)}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addArrayItem('keywords')}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
          >
            <Plus size={16} />
            <span>添加关键词</span>
          </button>
        </div>

        {/* Abstract */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            摘要
          </label>
          <textarea
            value={formData.abstract}
            onChange={(e) => handleInputChange('abstract', e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="请输入论文摘要"
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '创建中...' : '创建论文'}
          </button>
        </div>
      </form>
    </div>
  )
}
