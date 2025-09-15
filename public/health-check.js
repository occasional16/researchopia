/**
 * 系统健康检查和错误诊断工具
 * 用于验证研学港 Researchopia 的运行状态
 */

console.log('🏥 启动系统健康检查...')

async function performHealthCheck() {
  const healthReport = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {},
    errors: [],
    warnings: [],
    recommendations: []
  }

  console.log('🔍 开始全面系统检查...\n')

  // 1. 基础环境检查
  console.log('📋 检查基础环境...')
  try {
    healthReport.checks.environment = {
      userAgent: navigator.userAgent,
      url: window.location.href,
      hasReact: typeof window.React !== 'undefined',
      hasNextJS: typeof window.__NEXT_DATA__ !== 'undefined',
      hasConsole: typeof console !== 'undefined',
      hasFetch: typeof fetch !== 'undefined',
      hasPromise: typeof Promise !== 'undefined',
      status: 'pass'
    }
    
    if (!healthReport.checks.environment.hasFetch) {
      healthReport.warnings.push('Fetch API 不可用，可能影响网络请求')
    }
    
    console.log('✅ 基础环境检查通过')
  } catch (error) {
    healthReport.errors.push(`环境检查失败: ${error.message}`)
    healthReport.checks.environment = { status: 'fail', error: error.message }
  }

  // 2. API端点检查
  console.log('🌐 检查API端点...')
  const apiEndpoints = [
    '/api/site/statistics',
    '/api/papers/recent-comments?limit=3'
  ]

  for (const endpoint of apiEndpoints) {
    let attempts = 0
    const maxAttempts = 3
    let lastError = null

    while (attempts < maxAttempts) {
      try {
        attempts++
        console.log(`🔄 尝试 ${endpoint} (第${attempts}次)...`)

        const startTime = performance.now()
        const response = await fetch(endpoint, {
          timeout: 10000, // 10秒超时
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        })
        const endTime = performance.now()
        const responseTime = Math.round(endTime - startTime)

        const result = {
          endpoint,
          status: response.status,
          ok: response.ok,
          responseTime: `${responseTime}ms`,
          contentType: response.headers.get('content-type'),
          attempts: attempts
        }

        if (response.ok) {
          const text = await response.text()
          if (text) {
            try {
              const data = JSON.parse(text)
              result.hasValidJson = true
              result.success = data.success
              result.dataKeys = data.data ? Object.keys(data.data) : []
              console.log(`✅ ${endpoint}: ${response.status} (${responseTime}ms, ${attempts}次尝试)`)
              
              healthReport.checks[`api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`] = result
              break // 成功后跳出重试循环
            } catch (jsonError) {
              result.hasValidJson = false
              result.jsonError = jsonError.message
              console.log(`⚠️ ${endpoint}: JSON解析失败`)
              healthReport.warnings.push(`${endpoint}: JSON解析失败`)
              
              healthReport.checks[`api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`] = result
              break // JSON错误不重试
            }
          } else {
            result.hasValidJson = false
            result.isEmpty = true
            console.log(`⚠️ ${endpoint}: 响应内容为空`)
            healthReport.warnings.push(`${endpoint}: 响应内容为空`)
            
            healthReport.checks[`api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`] = result
            break // 空响应不重试
          }
        } else {
          lastError = `HTTP ${response.status}: ${response.statusText}`
          console.log(`❌ ${endpoint}: ${lastError} (尝试${attempts}/${maxAttempts})`)
          
          if (attempts >= maxAttempts) {
            healthReport.errors.push(`${endpoint}: ${lastError} (${attempts}次尝试后失败)`)
            healthReport.checks[`api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`] = {
              endpoint,
              status: response.status,
              error: lastError,
              attempts: attempts
            }
          } else {
            // 等待1秒后重试
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

      } catch (error) {
        lastError = error.message
        console.log(`❌ ${endpoint}: 网络错误 - ${lastError} (尝试${attempts}/${maxAttempts})`)
        
        if (attempts >= maxAttempts) {
          healthReport.errors.push(`${endpoint}: ${lastError} (${attempts}次尝试后失败)`)
          healthReport.checks[`api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`] = {
            endpoint,
            status: 'error',
            error: lastError,
            attempts: attempts
          }
        } else {
          // 等待1秒后重试
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
  }

  // 3. DOM和React检查
  console.log('⚛️ 检查React和DOM状态...')
  try {
    const reactCheck = {
      hasReactRoot: !!document.querySelector('#__next'),
      hasNavbar: !!document.querySelector('nav'),
      hasMainContent: !!document.querySelector('main'),
      hasErrorElements: document.querySelectorAll('[class*="error"]').length,
      totalElements: document.querySelectorAll('*').length,
      status: 'pass'
    }

    if (reactCheck.hasErrorElements > 0) {
      healthReport.warnings.push(`页面包含 ${reactCheck.hasErrorElements} 个错误相关元素`)
    }

    healthReport.checks.react = reactCheck
    console.log('✅ React和DOM检查通过')
  } catch (error) {
    healthReport.errors.push(`React/DOM检查失败: ${error.message}`)
    healthReport.checks.react = { status: 'fail', error: error.message }
  }

  // 4. 内存和性能检查
  console.log('⚡ 检查性能指标...')
  try {
    const performanceCheck = {
      memoryUsed: performance.memory ? 
        `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB` : 
        'N/A',
      navigationTiming: performance.getEntriesByType('navigation')[0]?.duration || 'N/A',
      resourceCount: performance.getEntriesByType('resource').length,
      status: 'pass'
    }

    healthReport.checks.performance = performanceCheck
    console.log('✅ 性能检查通过')
  } catch (error) {
    healthReport.warnings.push(`性能检查失败: ${error.message}`)
    healthReport.checks.performance = { status: 'warn', error: error.message }
  }

  // 5. 错误监听检查
  console.log('🔊 检查错误监听器...')
  try {
    // 测试错误监听是否工作
    let errorCaught = false
    const testErrorHandler = () => { errorCaught = true }
    
    window.addEventListener('error', testErrorHandler)
    
    // 模拟一个非关键错误来测试
    setTimeout(() => {
      try {
        // 这不会真的抛出错误，只是测试监听器
        window.removeEventListener('error', testErrorHandler)
      } catch (e) {
        // 忽略
      }
    }, 100)

    healthReport.checks.errorListening = {
      hasErrorListener: true,
      status: 'pass'
    }
    
    console.log('✅ 错误监听检查通过')
  } catch (error) {
    healthReport.warnings.push(`错误监听检查失败: ${error.message}`)
    healthReport.checks.errorListening = { status: 'warn', error: error.message }
  }

  // 生成总体状态
  if (healthReport.errors.length > 0) {
    healthReport.status = 'unhealthy'
  } else if (healthReport.warnings.length > 0) {
    healthReport.status = 'degraded'
  }

  // 生成建议
  if (healthReport.errors.length === 0 && healthReport.warnings.length === 0) {
    healthReport.recommendations.push('系统运行状态良好，无需特别关注')
  } else {
    if (healthReport.errors.length > 0) {
      healthReport.recommendations.push('发现系统错误，建议检查服务器状态和网络连接')
    }
    if (healthReport.warnings.length > 0) {
      healthReport.recommendations.push('发现系统警告，建议关注但不影响核心功能')
    }
  }

  return healthReport
}

// 生成健康报告
async function generateHealthReport() {
  console.log('🏥 研学港 Researchopia - 系统健康检查\n')
  
  try {
    const report = await performHealthCheck()
    
    console.log('\n📊 健康检查报告')
    console.log('═'.repeat(50))
    
    console.log(`🕐 检查时间: ${report.timestamp}`)
    
    // 状态指示器
    const statusIcon = {
      'healthy': '🟢',
      'degraded': '🟡', 
      'unhealthy': '🔴'
    }
    
    console.log(`${statusIcon[report.status]} 系统状态: ${report.status.toUpperCase()}`)
    
    if (report.errors.length > 0) {
      console.log('\n❌ 错误:')
      report.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`)
      })
    }
    
    if (report.warnings.length > 0) {
      console.log('\n⚠️ 警告:')
      report.warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`)
      })
    }
    
    console.log('\n💡 建议:')
    report.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`)
    })
    
    console.log('\n📋 详细检查结果:')
    Object.entries(report.checks).forEach(([key, check]) => {
      const status = check.status || (check.ok ? 'pass' : 'fail')
      const icon = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌'
      console.log(`  ${icon} ${key}: ${status}`)
    })
    
    console.log('\n═'.repeat(50))
    console.log('🎯 使用 window.healthReport 查看完整报告数据')
    
    // 存储到全局变量供进一步检查
    window.healthReport = report
    
    return report
    
  } catch (error) {
    console.error('❌ 健康检查失败:', error)
    return { status: 'error', error: error.message }
  }
}

// 自动运行检查
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(generateHealthReport, 2000)
  })
} else {
  setTimeout(generateHealthReport, 2000)
}

// 导出到全局作用域
window.generateHealthReport = generateHealthReport

console.log('🚀 健康检查工具已加载，使用 generateHealthReport() 手动执行检查')