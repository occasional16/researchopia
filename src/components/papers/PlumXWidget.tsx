'use client'

import { useEffect, useRef } from 'react'

interface PlumXWidgetProps {
  doi?: string
  /** PlumX小部件类型 */
  widgetType?: 'summary' | 'details'
  /** 显示选项 */
  hideWhenEmpty?: boolean
  hidePrint?: boolean
  hideUsage?: boolean
  hideCaptures?: boolean  
  hideSocialMedia?: boolean
  hideCitations?: boolean
  hideMentions?: boolean
  /** 样式选项 */
  width?: string | number
  height?: string | number
}

/**
 * PlumX Widget 组件
 * 集成 PlumX Analytics 服务来显示学术论文的影响力指标
 * 
 * PlumX 提供以下指标类型:
 * - Usage: 下载、浏览、视频播放等
 * - Captures: 收藏、书签、代码库、数据集等  
 * - Mentions: 新闻、博客、维基百科、政策文件等
 * - Social Media: Twitter、Facebook等社交媒体提及
 * - Citations: 学术引用
 */
export default function PlumXWidget({
  doi,
  widgetType = 'summary',
  hideWhenEmpty = true,
  hidePrint = false,
  hideUsage = false,
  hideCaptures = false,
  hideSocialMedia = false,
  hideCitations = false,
  hideMentions = false,
  width = '100%',
  height = 'auto'
}: PlumXWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!doi || !containerRef.current) return
    
    // 清空容器
    containerRef.current.innerHTML = ''
    
    // 动态加载PlumX脚本
    const loadPlumXScript = () => {
      return new Promise<void>((resolve, reject) => {
        // 检查脚本是否已加载
        if (document.querySelector('script[src*="plu.mx"]') || window.__plumX) {
          resolve()
          return
        }
        
        const script = document.createElement('script')
        // 使用官方的PlumX脚本URL
        script.src = 'https://d39af2mgp1pqhg.cloudfront.net/widget-popup.js'
        script.async = true
        script.crossOrigin = 'anonymous'
        
        // 设置超时处理
        const timeout = setTimeout(() => {
          script.remove()
          console.warn('PlumX script loading timeout, falling back to placeholder')
          resolve() // 不reject，而是resolve以显示占位符
        }, 10000) // 10秒超时
        
        script.onload = () => {
          clearTimeout(timeout)
          console.log('PlumX script loaded successfully')
          resolve()
        }
        
        script.onerror = (error) => {
          clearTimeout(timeout)
          script.remove()
          console.warn('PlumX script failed to load, will show placeholder:', error)
          resolve() // 不reject，而是resolve以显示占位符
        }
        
        document.head.appendChild(script)
      })
    }
    
    // 创建PlumX Widget
    const createWidget = async () => {
      try {
        await loadPlumXScript()
        
        if (!containerRef.current) return
        
        // 等待一小段时间确保脚本完全加载
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // 检查PlumX是否真的可用
        if (!window.__plumX) {
          console.warn('PlumX not available, showing fallback')
          showFallbackContent()
          return
        }
        
        // 创建PlumX元素
        const plumxElement = document.createElement('a')
        plumxElement.className = 'plumx-plum-print-popup'
        plumxElement.href = `https://plu.mx/ssrn/a/?doi=${doi}`
        plumxElement.setAttribute('data-site', 'plum')
        plumxElement.setAttribute('data-hide-when-empty', hideWhenEmpty.toString())
        
        // 设置隐藏选项
        const hideOptions = []
        if (hidePrint) hideOptions.push('print')
        if (hideUsage) hideOptions.push('usage')
        if (hideCaptures) hideOptions.push('captures')
        if (hideSocialMedia) hideOptions.push('socialMedia')
        if (hideCitations) hideOptions.push('citations')
        if (hideMentions) hideOptions.push('mentions')
        
        if (hideOptions.length > 0) {
          plumxElement.setAttribute('data-hide', hideOptions.join(','))
        }
        
        // 根据widgetType设置不同的显示模式
        if (widgetType === 'details') {
          plumxElement.setAttribute('data-popup', 'right')
          plumxElement.setAttribute('data-size', 'large')
        }
        
        containerRef.current.appendChild(plumxElement)
        
        // 触发PlumX初始化
        try {
          if (window.__plumX && window.__plumX.widgets) {
            window.__plumX.widgets.discover()
          }
        } catch (initError) {
          console.warn('PlumX initialization failed:', initError)
          showFallbackContent()
        }
        
      } catch (error) {
        console.warn('PlumX widget creation failed:', error)
        showFallbackContent()
      }
    }
    
    // 显示回退内容
    const showFallbackContent = () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="text-sm text-gray-500 bg-gray-50 p-3 rounded border border-dashed">
            <div class="flex items-center space-x-2">
              <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
              </svg>
              <span>PlumX数据暂时无法加载</span>
            </div>
            ${doi ? `<p class="mt-1 text-xs text-gray-400">DOI: ${doi}</p>` : ''}
            <div class="mt-2 text-xs text-gray-400">
              <a href="https://plu.mx/ssrn/a/?doi=${doi}" target="_blank" class="text-blue-500 hover:text-blue-600">
                → 在PlumX官网查看指标数据
              </a>
            </div>
          </div>
        `
      }
    }
    
    createWidget()
  }, [doi, widgetType, hideWhenEmpty, hidePrint, hideUsage, hideCaptures, hideSocialMedia, hideCitations, hideMentions])
  
  if (!doi) {
    return (
      <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border border-dashed">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
          </svg>
          <span>需要DOI来显示PlumX数据</span>
        </div>
      </div>
    )
  }
  
  return (
    <div 
      ref={containerRef}
      className="plumx-widget-container"
      style={{ 
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        minHeight: '40px'
      }}
    />
  )
}

// 扩展Window接口以支持PlumX
declare global {
  interface Window {
    __plumX?: {
      widgets: {
        discover: () => void
      }
    }
  }
}