import { useState } from 'react'
import { Search, Plus, ExternalLink, BookOpen } from 'lucide-react'
import { LoadingSpinner, ErrorMessage } from '@/components/ui/LoadingStates'
import { useAuth } from '@/contexts/AuthContext'

interface SmartSearchProps {
  onSearch: (query: string) => void
  onPaperAdded?: (paper: any) => void
  className?: string
}

// DOI 格式检测正则表达式
const DOI_PATTERN = /^10\.\d{4,}\/[^\s]+$/
const DOI_URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:dx\.)?doi\.org\/(10\.\d{4,}\/[^\s]+)/
const ARXIV_PATTERN = /(?:arxiv:|https?:\/\/arxiv\.org\/abs\/)(\d{4}\.\d{4,5})/

export function SmartSearch({ onSearch, onPaperAdded, className = '' }: SmartSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  // 检测输入类型
  const detectInputType = (input: string): 'doi' | 'arxiv' | 'general' => {
    const cleanInput = input.trim()
    
    if (DOI_PATTERN.test(cleanInput)) {
      return 'doi'
    }
    
    const doiMatch = cleanInput.match(DOI_URL_PATTERN)
    if (doiMatch) {
      return 'doi'
    }
    
    if (ARXIV_PATTERN.test(cleanInput)) {
      return 'arxiv'
    }
    
    return 'general'
  }

  // 提取DOI
  const extractDOI = (input: string): string | null => {
    const cleanInput = input.trim()
    
    if (DOI_PATTERN.test(cleanInput)) {
      return cleanInput
    }
    
    const doiMatch = cleanInput.match(DOI_URL_PATTERN)
    if (doiMatch) {
      return doiMatch[1]
    }
    
    return null
  }

  // 提取ArXiv ID
  const extractArxivId = (input: string): string | null => {
    const match = input.match(ARXIV_PATTERN)
    return match ? match[1] : null
  }

  // 处理DOI搜索/添加
  const handleDOISearch = async (doi: string) => {
    setIsProcessing(true)
    setProcessingMessage('检查论文是否已存在...')
    setError(null)

    try {
      // 首先检查论文是否已存在
      const checkResponse = await fetch(`/api/papers/check-doi?doi=${encodeURIComponent(doi)}`)
      const checkResult = await checkResponse.json()

      if (checkResult.exists) {
        setProcessingMessage('')
        setIsProcessing(false)
        // 论文已存在，跳转到论文详情页
        window.location.href = `/papers/${checkResult.paper.id}`
        return
      }

      // 论文不存在，从CrossRef抓取
      setProcessingMessage('从学术数据库获取论文信息...')
      
      const addResponse = await fetch('/api/papers/add-from-doi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          doi,
          userId: user?.id // 可以为空，后端会处理
        }),
      })

      if (!addResponse.ok) {
        const errorData = await addResponse.json()
        throw new Error(errorData.error || '无法获取论文信息')
      }

      const newPaper = await addResponse.json()
      setProcessingMessage('论文添加成功！')
      
      // 通知父组件
      if (onPaperAdded) {
        onPaperAdded(newPaper)
      }

      // 跳转到新添加的论文
      setTimeout(() => {
        window.location.href = `/papers/${newPaper.paper.id}`
      }, 1000)

    } catch (err: any) {
      setError(err.message || '处理DOI时出错')
      setProcessingMessage('')
    } finally {
      setIsProcessing(false)
    }
  }

  // 处理ArXiv搜索
  const handleArxivSearch = async (arxivId: string) => {
    setIsProcessing(true)
    setProcessingMessage('从ArXiv获取论文信息...')
    setError(null)

    try {
      // 注意：这里需要实现ArXiv API集成
      setError('ArXiv支持即将推出')
    } catch (err: any) {
      setError(err.message || '处理ArXiv ID时出错')
    } finally {
      setIsProcessing(false)
      setProcessingMessage('')
    }
  }

  // 处理搜索提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!searchQuery.trim()) {
      return
    }

    const inputType = detectInputType(searchQuery)
    
    if (inputType === 'doi') {
      const doi = extractDOI(searchQuery)
      if (doi) {
        await handleDOISearch(doi)
        return
      }
    }
    
    if (inputType === 'arxiv') {
      const arxivId = extractArxivId(searchQuery)
      if (arxivId) {
        await handleArxivSearch(arxivId)
        return
      }
    }
    
    // 普通搜索
    onSearch(searchQuery.trim())
  }

  // 获取搜索提示
  const getSearchHint = (): string => {
    const inputType = detectInputType(searchQuery)
    
    switch (inputType) {
      case 'doi':
        return '检测到DOI格式 - 将自动查找或添加论文'
      case 'arxiv':
        return '检测到ArXiv格式 - 将从ArXiv获取论文信息'
      default:
        return '支持搜索论文标题、作者、关键词，或直接输入DOI/ArXiv ID'
    }
  }

  // 获取按钮文本
  const getButtonText = (): string => {
    const inputType = detectInputType(searchQuery)
    
    switch (inputType) {
      case 'doi':
        return '查找/添加论文'
      case 'arxiv':
        return '从ArXiv获取'
      default:
        return '搜索'
    }
  }

  return (
    <div className={className}>
      {/* 主搜索表单 */}
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索论文标题、作者、关键词，或输入DOI、ArXiv ID..."
            className="w-full pl-12 pr-32 py-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            disabled={isProcessing}
          />
          
          {/* 搜索按钮 */}
          <button
            type="submit"
            disabled={!searchQuery.trim() || isProcessing}
            className="absolute right-2 top-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <LoadingSpinner size="sm" text="" />
            ) : (
              <>
                {detectInputType(searchQuery) === 'doi' && <Plus className="w-4 h-4" />}
                {detectInputType(searchQuery) === 'arxiv' && <ExternalLink className="w-4 h-4" />}
                {detectInputType(searchQuery) === 'general' && <Search className="w-4 h-4" />}
                {getButtonText()}
              </>
            )}
          </button>
        </div>

        {/* 搜索提示 */}
        <p className="text-sm text-gray-600 mt-2 text-center">
          {getSearchHint()}
        </p>
      </form>

      {/* 处理状态 */}
      {isProcessing && processingMessage && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 text-blue-600">
            <LoadingSpinner size="sm" text="" />
            <span>{processingMessage}</span>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-4">
          <ErrorMessage 
            message={error}
            onRetry={() => setError(null)}
          />
        </div>
      )}

      {/* 功能说明 */}
      <div className="mt-8 max-w-4xl mx-auto">
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
            <BookOpen className="w-5 h-5 mr-2" />
            智能搜索功能
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-2">支持的输入格式：</h4>
              <ul className="space-y-1">
                <li>• DOI号（如：10.1038/nature12373）</li>
                <li>• DOI链接（如：https://doi.org/10.1038/nature12373）</li>
                <li>• ArXiv ID（如：1234.5678）</li>
                <li>• 普通关键词搜索</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">自动功能：</h4>
              <ul className="space-y-1">
                <li>• 检测已存在论文并跳转</li>
                <li>• 自动从CrossRef获取论文信息</li>
                <li>• 智能识别输入类型</li>
                <li>• 一键添加到数据库</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
