/**
 * VS Code Simple Browser 工具函数
 * 提供在VS Code环境中使用Simple Browser的功能
 */

interface SimpleUrlOptions {
  title?: string
  viewColumn?: number
  preserveFocus?: boolean
}

/**
 * 在VS Code Simple Browser中打开URL
 * 如果不在VS Code环境中，则回退到普通浏览器打开
 * @param url 要打开的URL
 * @param options 可选参数
 */
export function openInSimpleBrowser(url: string, options: SimpleUrlOptions = {}) {
  const { title = 'Preview', viewColumn = 2, preserveFocus = false } = options

  // 检查是否在VS Code环境中
  if (typeof window !== 'undefined') {
    try {
      // 尝试获取VS Code API
      const vscode = (window as any).acquireVsCodeApi?.()
      
      if (vscode) {
        // 发送命令到VS Code
        vscode.postMessage({
          command: 'vscode.open',
          uri: url,
          options: {
            viewColumn,
            preserveFocus
          }
        })
        console.log(`Opening ${url} in VS Code Simple Browser`)
        return true
      }
    } catch (error) {
      console.log('VS Code API not available:', error)
    }

    // 尝试使用VS Code命令API（如果在webview环境中）
    try {
      if ((window as any).vscode?.postMessage) {
        (window as any).vscode.postMessage({
          type: 'openUrl',
          url,
          title
        })
        return true
      }
    } catch (error) {
      console.log('VS Code webview API not available:', error)
    }
  }

  // 回退：在新标签页打开
  console.log(`Falling back to new tab for ${url}`)
  window.open(url, '_blank', 'noopener,noreferrer')
  return false
}

/**
 * 检查当前是否在VS Code环境中
 */
export function isInVSCode(): boolean {
  if (typeof window === 'undefined') return false
  
  return !!(
    (window as any).acquireVsCodeApi ||
    (window as any).vscode ||
    navigator.userAgent.includes('VSCode')
  )
}

/**
 * 预览URL（优先使用Simple Browser）
 * @param url 要预览的URL
 * @param title 预览窗口标题
 */
export function previewUrl(url: string, title?: string) {
  if (!url) {
    console.warn('previewUrl: URL is required')
    return
  }

  // 确保URL是有效的
  try {
    new URL(url)
  } catch (error) {
    console.warn('previewUrl: Invalid URL:', url)
    return
  }

  return openInSimpleBrowser(url, { title })
}