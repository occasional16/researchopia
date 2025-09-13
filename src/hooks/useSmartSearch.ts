import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// DOI格式检测
const DOI_PATTERN = /^10\.\d{4,}\/[^\s]+$/
const DOI_URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:dx\.)?doi\.org\/(10\.\d{4,}\/[^\s]+)/
const ARXIV_PATTERN = /(?:arxiv:|https?:\/\/arxiv\.org\/abs\/)(\d{4}\.\d{4,5})/

export type SearchInputType = 'doi' | 'arxiv' | 'general'
export type SearchStatus = 'idle' | 'checking' | 'adding' | 'redirecting' | 'error'

export interface UseSmartSearchReturn {
  searchStatus: SearchStatus
  processingMessage: string
  error: string | null
  detectInputType: (input: string) => SearchInputType
  extractDOI: (input: string) => string | null
  handleSearch: (query: string) => Promise<void>
  clearError: () => void
}

export function useSmartSearch(): UseSmartSearchReturn {
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle')
  const [processingMessage, setProcessingMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const detectInputType = (input: string): SearchInputType => {
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

  const handleDOISearch = async (doi: string): Promise<void> => {
    setSearchStatus('checking')
    setProcessingMessage('🔍 检查论文是否已存在...')
    setError(null)

    try {
      // 首先检查论文是否已存在
      const checkResponse = await fetch(`/api/papers/check-doi?doi=${encodeURIComponent(doi)}`)
      
      if (!checkResponse.ok) {
        throw new Error('检查DOI时发生网络错误')
      }
      
      const checkResult = await checkResponse.json()

      if (checkResult.exists) {
        setSearchStatus('redirecting')
        setProcessingMessage('✅ 找到论文，正在跳转...')
        
        // 短暂延迟以显示成功消息
        setTimeout(() => {
          window.location.href = `/papers/${checkResult.paper.id}`
        }, 800)
        return
      }

      // 论文不存在，从CrossRef抓取
      setSearchStatus('adding')
      setProcessingMessage('📚 论文不存在，正在从学术数据库获取信息...')
      
      const addResponse = await fetch('/api/papers/add-from-doi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          doi,
          userId: user?.id
        }),
      })

      if (!addResponse.ok) {
        const errorData = await addResponse.json()
        throw new Error(errorData.error || '无法获取论文信息')
      }

      const result = await addResponse.json()
      
      setSearchStatus('redirecting')
      setProcessingMessage('✅ 论文添加成功！正在跳转...')
      
      // 跳转到新添加的论文
      setTimeout(() => {
        window.location.href = `/papers/${result.paper.id}`
      }, 1000)

    } catch (err: any) {
      setSearchStatus('error')
      setError(err.message || '处理DOI时出错')
      setProcessingMessage('')
    }
  }

  const handleSearch = async (query: string): Promise<void> => {
    if (!query.trim()) return

    const inputType = detectInputType(query)
    
    if (inputType === 'doi') {
      const doi = extractDOI(query)
      if (doi) {
        await handleDOISearch(doi)
        return
      }
    }
    
    if (inputType === 'arxiv') {
      setError('ArXiv支持即将推出')
      return
    }
    
    // 普通搜索，跳转到搜索页面
    const encodedQuery = encodeURIComponent(query.trim())
    window.location.href = `/search?q=${encodedQuery}`
  }

  const clearError = () => {
    setError(null)
    setSearchStatus('idle')
    setProcessingMessage('')
  }

  return {
    searchStatus,
    processingMessage,
    error,
    detectInputType,
    extractDOI,
    handleSearch,
    clearError
  }
}