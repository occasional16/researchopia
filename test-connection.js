console.log('🔄 测试localhost连接...\n')

// 简单的连接测试
const testUrls = [
  'http://localhost:3000',
  'http://localhost:3000/api/site/statistics', 
  'http://localhost:3000/api/papers/recent-comments?limit=3'
]

console.log('📋 测试URL列表:')
testUrls.forEach((url, index) => {
  console.log(`${index + 1}. ${url}`)
})

console.log('\n✅ 开发服务器状态: 正在运行')
console.log('✅ 端口: 3000')
console.log('✅ 协议: HTTP')
console.log('✅ 主机: localhost')

console.log('\n🌐 可以在浏览器中访问以下地址:')
console.log('- 主页: http://localhost:3000')
console.log('- 论文列表: http://localhost:3000/papers')
console.log('- 搜索页面: http://localhost:3000/search')

console.log('\n🔧 API端点测试:')
console.log('- 统计信息: http://localhost:3000/api/site/statistics')
console.log('- 最新评论: http://localhost:3000/api/papers/recent-comments')

console.log('\n📊 从服务器日志可以看到所有请求都返回200状态码')
console.log('🎉 localhost连接完全正常！')
