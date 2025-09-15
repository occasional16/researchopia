/**
 * 调试脚本：测试 API 端点的连接和响应
 */

async function testApiEndpoint(baseUrl) {
  const endpoint = '/api/papers/paginated'
  
  console.log('🔍 开始测试 API 端点...')
  console.log(`📍 测试地址: ${baseUrl}${endpoint}`)
  
  try {
    console.log('\n1. 测试基本连接...')
    const response = await fetch(`${baseUrl}${endpoint}?page=1&limit=5`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })
    
    console.log(`📊 响应状态: ${response.status} ${response.statusText}`)
    console.log(`📋 响应头:`)
    for (const [key, value] of response.headers.entries()) {
      console.log(`   ${key}: ${value}`)
    }
    
    if (!response.ok) {
      console.error(`❌ HTTP 错误: ${response.status}`)
      const errorText = await response.text()
      console.error('错误内容:', errorText)
      return
    }
    
    console.log('\n2. 解析响应数据...')
    const data = await response.json()
    console.log('✅ 成功获取数据:', {
      dataCount: data.data ? data.data.length : 0,
      pagination: data.pagination,
      firstItem: data.data && data.data[0] ? {
        id: data.data[0].id,
        title: data.data[0].title?.substring(0, 50) + '...'
      } : 'none'
    })
    
    console.log('\n3. 测试搜索功能...')
    const searchResponse = await fetch(`${baseUrl}${endpoint}?page=1&limit=3&search=test`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })
    console.log(`🔍 搜索响应状态: ${searchResponse.status}`)
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      console.log('✅ 搜索功能正常，结果数:', searchData.data.length)
    }
    
    console.log('\n✅ API 端点测试完成')
    
  } catch (error) {
    console.error('\n❌ API 测试失败:')
    console.error('错误类型:', error.name)
    console.error('错误消息:', error.message)
    
    if (error.cause) {
      console.error('错误原因:', error.cause)
    }
    
    // 检查常见的网络错误
    if (error.message.includes('Failed to fetch')) {
      console.error('\n🔧 可能的原因:')
      console.error('- Next.js 开发服务器未启动')
      console.error('- 端口 3000 被占用或不可访问')
      console.error('- 网络连接问题')
      console.error('- CORS 配置问题')
    }
  }
}

async function testDatabaseConnection(baseUrl) {
  console.log('\n🗄️ 测试数据库连接...')
  
  try {
    const response = await fetch(`${baseUrl}/api/health-check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ 健康检查通过:', data)
    } else {
      console.log('❌ 健康检查失败:', response.status, response.statusText)
    }
  } catch (error) {
    console.log('❌ 健康检查 API 不可用:', error.message)
  }
}

async function testBrowserEnvironment() {
  console.log('\n🌐 测试浏览器环境...')
  
  // 检查是否在浏览器环境中运行
  if (typeof window !== 'undefined') {
    console.log('✅ 运行在浏览器环境中')
    console.log('当前 URL:', window.location.href)
    console.log('User Agent:', navigator.userAgent.substring(0, 100) + '...')
  } else {
    console.log('ℹ️ 运行在 Node.js 环境中')
  }
  
  // 测试 fetch 是否可用
  if (typeof fetch !== 'undefined') {
    console.log('✅ fetch API 可用')
  } else {
    console.log('❌ fetch API 不可用')
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始综合 API 调试...\n')
  const baseUrls = ['http://localhost:3000', 'http://localhost:3001']

  await testBrowserEnvironment()

  let succeeded = false
  for (const baseUrl of baseUrls) {
    console.log(`\n🌐 尝试服务地址: ${baseUrl}`)
    try {
      await testDatabaseConnection(baseUrl)
      await testApiEndpoint(baseUrl)
      succeeded = true
      console.log(`\n✅ 在 ${baseUrl} 调试成功`)
      break
    } catch (e) {
      console.warn(`\n⚠ 在 ${baseUrl} 调试失败:`, e?.message || e)
    }
  }

  if (!succeeded) {
    console.error('\n❌ 所有候选地址均调试失败。请确认 Next.js 开发服务器是否已启动，并注意端口占用提示。')
  }
  
  console.log('\n🏁 调试完成')
}

// 如果在 Node.js 环境中运行
if (typeof window === 'undefined') {
  // 安装全局 fetch（Node.js 18+ 内置）
  if (typeof fetch === 'undefined') {
    const { fetch } = require('undici')
    global.fetch = fetch
  }
  
  runAllTests().catch(error => {
    console.error('调试脚本执行失败:', error)
    process.exit(1)
  })
} else {
  // 在浏览器中，将函数暴露给全局作用域
  window.debugApi = runAllTests
  console.log('🔧 调试函数已准备就绪，请在控制台运行: debugApi()')
}