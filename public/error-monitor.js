/**
 * 运行时错误监控和诊断工具
 * 用于捕获和分析 "Cannot read properties of undefined" 类型错误
 */

console.log('🔍 启动运行时错误监控...')

// 捕获全局未处理的错误
window.addEventListener('error', (event) => {
  console.error('🚨 全局错误捕获:', {
    message: event.error?.message || event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
    timestamp: new Date().toISOString()
  })
  
  // 特别关注 "call" 相关错误
  if (event.error?.message?.includes('call') || event.message?.includes('call')) {
    console.error('🎯 检测到 "call" 相关错误:', {
      originalError: event.error,
      context: 'Global error handler',
      userAgent: navigator.userAgent,
      url: window.location.href
    })
  }
})

// 捕获未处理的Promise拒绝
window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 未处理的Promise拒绝:', {
    reason: event.reason,
    promise: event.promise,
    timestamp: new Date().toISOString()
  })
  
  if (event.reason?.message?.includes('call')) {
    console.error('🎯 Promise中检测到 "call" 相关错误:', {
      reason: event.reason,
      stack: event.reason?.stack
    })
  }
})

// React错误边界监控
function createErrorBoundaryMonitor() {
  const originalConsoleError = console.error
  
  console.error = function(...args) {
    // 检查React错误边界相关的错误
    const message = args.join(' ')
    if (message.includes('call') || message.includes('undefined')) {
      console.warn('🎯 React相关错误检测:', {
        args,
        stack: new Error().stack,
        timestamp: new Date().toISOString()
      })
    }
    
    return originalConsoleError.apply(console, args)
  }
}

// 函数调用监控
function monitorFunctionCalls() {
  // 监控常见的可能出问题的方法
  const methodsToMonitor = ['fetch', 'addEventListener', 'querySelector']
  
  methodsToMonitor.forEach(methodName => {
    if (window[methodName]) {
      const original = window[methodName]
      window[methodName] = function(...args) {
        try {
          return original.apply(this, args)
        } catch (error) {
          console.error(`🎯 ${methodName} 调用错误:`, {
            method: methodName,
            args,
            error: error.message,
            stack: error.stack
          })
          throw error
        }
      }
    }
  })
}

// 组件渲染监控
function monitorReactComponents() {
  // 检测React组件渲染错误
  if (typeof window.React !== 'undefined') {
    const originalCreateElement = window.React.createElement
    
    window.React.createElement = function(type, props, ...children) {
      try {
        return originalCreateElement.call(this, type, props, ...children)
      } catch (error) {
        console.error('🎯 React.createElement 错误:', {
          type,
          props,
          error: error.message,
          stack: error.stack
        })
        throw error
      }
    }
  }
}

// 网络请求监控
function monitorNetworkRequests() {
  const originalFetch = window.fetch
  
  window.fetch = function(...args) {
    const url = args[0]
    console.log(`📡 发起网络请求: ${url}`)
    
    return originalFetch.apply(this, args)
      .then(response => {
        console.log(`✅ 网络请求成功: ${url} (${response.status})`)
        return response
      })
      .catch(error => {
        console.error(`❌ 网络请求失败: ${url}`, error)
        throw error
      })
  }
}

// 初始化所有监控
function initializeErrorMonitoring() {
  console.log('🛡️ 初始化错误监控系统...')
  
  try {
    createErrorBoundaryMonitor()
    console.log('✅ 错误边界监控已启用')
  } catch (e) {
    console.warn('⚠️ 错误边界监控启动失败:', e)
  }
  
  try {
    monitorFunctionCalls()
    console.log('✅ 函数调用监控已启用')
  } catch (e) {
    console.warn('⚠️ 函数调用监控启动失败:', e)
  }
  
  try {
    monitorReactComponents()
    console.log('✅ React组件监控已启用')
  } catch (e) {
    console.warn('⚠️ React组件监控启动失败:', e)
  }
  
  try {
    monitorNetworkRequests()
    console.log('✅ 网络请求监控已启用')
  } catch (e) {
    console.warn('⚠️ 网络请求监控启动失败:', e)
  }
  
  console.log('🎯 错误监控系统就绪，正在监听 "call" 相关错误...')
}

// 导出诊断函数
function runDiagnostics() {
  console.log('🔧 运行系统诊断...')
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    reactVersion: window.React?.version || 'Not detected',
    nextVersion: window.__NEXT_DATA__?.buildId || 'Not detected',
    hasErrors: false,
    recommendations: []
  }
  
  // 检查常见问题
  if (typeof window.fetch === 'undefined') {
    diagnostics.hasErrors = true
    diagnostics.recommendations.push('fetch API不可用，考虑使用polyfill')
  }
  
  if (typeof window.Promise === 'undefined') {
    diagnostics.hasErrors = true
    diagnostics.recommendations.push('Promise不可用，考虑使用polyfill')
  }
  
  console.log('📋 诊断结果:', diagnostics)
  return diagnostics
}

// 自动启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeErrorMonitoring)
} else {
  initializeErrorMonitoring()
}

// 导出到全局作用域
window.runDiagnostics = runDiagnostics
window.initializeErrorMonitoring = initializeErrorMonitoring

console.log('🚀 错误监控工具已加载，使用 runDiagnostics() 进行系统诊断')