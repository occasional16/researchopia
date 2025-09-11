console.log('🔧 服务器连接诊断工具启动...\n')

async function checkServerStatus() {
  console.log('📊 服务器状态检查:')
  
  try {
    // 检查主页
    const homeResponse = await fetch('http://localhost:3000', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    })
    console.log(`  ✅ 主页: ${homeResponse.status} ${homeResponse.statusText}`)
  } catch (error) {
    console.log(`  ❌ 主页: 连接失败 - ${error.message}`)
  }

  try {
    // 检查统计API
    const statsResponse = await fetch('http://localhost:3000/api/site/statistics', {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    })
    console.log(`  ✅ 统计API: ${statsResponse.status} ${statsResponse.statusText}`)
  } catch (error) {
    console.log(`  ❌ 统计API: 连接失败 - ${error.message}`)
  }

  try {
    // 检查评论API
    const commentsResponse = await fetch('http://localhost:3000/api/papers/recent-comments', {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    })
    console.log(`  ✅ 评论API: ${commentsResponse.status} ${commentsResponse.statusText}`)
  } catch (error) {
    console.log(`  ❌ 评论API: 连接失败 - ${error.message}`)
  }
}

console.log('🌐 常见连接问题解决方案:')
console.log('  1. 服务器未启动：npm run dev')
console.log('  2. 端口被占用：netstat -ano | findstr :3000')
console.log('  3. 防火墙阻止：检查Windows防火墙设置')
console.log('  4. 浏览器缓存：Ctrl+F5 硬刷新')
console.log('  5. 服务器崩溃：检查终端错误信息')

console.log('\n🔍 快速诊断步骤:')
console.log('  1. 检查终端是否显示 "Ready in Xs"')
console.log('  2. 确认地址: http://localhost:3000')
console.log('  3. 尝试不同浏览器或无痕模式')
console.log('  4. 重启服务器: Ctrl+C → npm run dev')

console.log('\n⚡ 正在检查当前服务器状态...')
checkServerStatus().then(() => {
  console.log('\n✅ 诊断完成!')
}).catch(error => {
  console.log('\n❌ 诊断失败:', error.message)
})
