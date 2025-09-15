/**
 * API 连接测试工具
 * 用于验证 API 端点的可用性和响应格式
 */

console.log('🔧 开始 API 连接测试...')

async function testApiEndpoint(url, description) {
  console.log(`\n📡 测试: ${description}`)
  console.log(`📍 URL: ${url}`)
  
  try {
    const startTime = performance.now()
    const response = await fetch(url)
    const endTime = performance.now()
    const responseTime = Math.round(endTime - startTime)
    
    console.log(`⏱️ 响应时间: ${responseTime}ms`)
    console.log(`📊 状态码: ${response.status} ${response.statusText}`)
    
    if (response.ok) {
      const text = await response.text()
      
      if (!text) {
        console.log('⚠️ 响应内容为空')
        return false
      }
      
      try {
        const data = JSON.parse(text)
        console.log('✅ JSON 解析成功')
        console.log('📋 响应数据结构:')
        console.log('   success:', data.success)
        if (data.data) {
          console.log('   data keys:', Object.keys(data.data))
          if (Array.isArray(data.data)) {
            console.log('   data length:', data.data.length)
          }
        }
        return true
      } catch (jsonError) {
        console.log('❌ JSON 解析失败:', jsonError.message)
        console.log('📄 原始响应内容 (前200字符):', text.substring(0, 200))
        return false
      }
    } else {
      console.log(`❌ HTTP 错误: ${response.status} ${response.statusText}`)
      return false
    }
    
  } catch (error) {
    console.log(`❌ 网络错误: ${error.message}`)
    return false
  }
}

async function runApiTests() {
  console.log('🌐 研学港 Researchopia - API 连接测试\n')
  
  const tests = [
    {
      url: '/api/site/statistics',
      description: '网站统计 API'
    },
    {
      url: '/api/papers/recent-comments?limit=5',
      description: '最新评论 API (限制5条)'
    },
    {
      url: '/api/papers/recent-comments',
      description: '最新评论 API (默认)'
    }
  ]
  
  const results = []
  
  for (const test of tests) {
    const success = await testApiEndpoint(test.url, test.description)
    results.push({ ...test, success })
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('\n📋 测试总结:')
  console.log('━'.repeat(50))
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ 通过' : '❌ 失败'
    console.log(`${index + 1}. ${result.description}: ${status}`)
  })
  
  const successCount = results.filter(r => r.success).length
  const totalCount = results.length
  
  console.log('━'.repeat(50))
  console.log(`📊 总体结果: ${successCount}/${totalCount} 通过`)
  
  if (successCount === totalCount) {
    console.log('🎉 所有 API 测试通过！系统运行正常。')
  } else {
    console.log('⚠️ 部分 API 测试失败，请检查服务器状态。')
  }
  
  return results
}

// 导出测试函数到全局作用域
if (typeof window !== 'undefined') {
  window.runApiTests = runApiTests
  
  // 页面加载后自动运行测试
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(runApiTests, 2000)
    })
  } else {
    setTimeout(runApiTests, 2000)
  }
}

export default runApiTests