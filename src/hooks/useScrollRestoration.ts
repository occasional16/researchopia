import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * 页面刷新时保持滚动位置
 * 在需要保持滚动位置的页面中使用此hook
 */
export function useScrollRestoration() {
  const pathname = usePathname()

  useEffect(() => {
    // 保存当前滚动位置
    const saveScrollPosition = () => {
      const scrollPosition = {
        x: window.scrollX,
        y: window.scrollY,
        path: pathname
      }
      sessionStorage.setItem('scrollPosition', JSON.stringify(scrollPosition))
    }

    // 恢复滚动位置
    const restoreScrollPosition = () => {
      try {
        const saved = sessionStorage.getItem('scrollPosition')
        if (saved) {
          const { x, y, path } = JSON.parse(saved)
          
          // 只在同一页面恢复位置
          if (path === pathname && y > 0) {
            // 多次尝试恢复,直到成功或超时
            let attempts = 0
            const maxAttempts = 15 // 最多尝试15次 (减少到1.5秒)
            
            const tryScroll = () => {
              attempts++
              window.scrollTo({
                top: y,
                left: x,
                behavior: 'auto'
              })
              
              // 检查是否成功
              setTimeout(() => {
                const currentScroll = window.scrollY
                if (Math.abs(currentScroll - y) > 10 && attempts < maxAttempts) {
                  // 未成功,继续尝试
                  setTimeout(tryScroll, 100)
                } else {
                  // 成功或达到最大尝试次数,清除保存的位置
                  sessionStorage.removeItem('scrollPosition')
                }
              }, 50)
            }
            
            // 首次延迟500ms,等页面基本渲染完成
            setTimeout(tryScroll, 500)
          }
        }
      } catch (error) {
        console.error('[ScrollRestoration] Failed to restore scroll position:', error)
      }
    }

    // 恢复滚动位置
    restoreScrollPosition()

    // 监听beforeunload事件，保存滚动位置
    window.addEventListener('beforeunload', saveScrollPosition)

    // 也监听visibilitychange，在页面隐藏时保存
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 也监听滚动事件，定期保存（防抖处理）
    let scrollTimeout: NodeJS.Timeout
    const handleScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(saveScrollPosition, 200)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('beforeunload', saveScrollPosition)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [pathname])
}
