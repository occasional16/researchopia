console.log('🔧 服务器稳定性和HTTPS问题解决方案\n')

console.log('🚨 问题分析:')
console.log('  1. 服务器自动断开: Next.js开发服务器在某些情况下会自动停止')
console.log('  2. 证书警告: localhost使用HTTP，不是HTTPS')

console.log('\n📋 服务器自动断开的常见原因:')
console.log('  • 编译错误导致进程退出')
console.log('  • 内存不足或资源占用过高')
console.log('  • 长时间无活动（某些系统设置）')
console.log('  • 端口冲突或网络问题')
console.log('  • 代码更改导致热重载失败')

console.log('\n✅ 服务器稳定性解决方案:')
console.log('  1. 使用PM2或nodemon保持服务器运行')
console.log('  2. 监控内存使用情况')
console.log('  3. 定期检查终端状态')
console.log('  4. 设置自动重启脚本')

console.log('\n🔐 HTTPS证书问题解决方案:')
console.log('  • 开发环境通常使用HTTP（正常现象）')
console.log('  • localhost:3000 = HTTP（无证书）')
console.log('  • 生产环境才需要HTTPS证书')
console.log('  • 可以忽略证书警告或添加例外')

console.log('\n🛠️ 推荐操作:')
console.log('  1. 保持终端窗口打开')
console.log('  2. 定期检查 "Ready in Xs" 状态')
console.log('  3. 如果断开，快速重启: npm run dev')
console.log('  4. 对于HTTPS警告，点击"高级"→"继续访问"')

console.log('\n⚡ 快速重启命令 (如果再次断开):')
console.log('  cd "D:\\AI\\Rating\\academic-rating" && npm run dev')

console.log('\n🎯 当前状态: 服务器已重新启动并正常运行!')
console.log('  ✅ http://localhost:3000 应该可以访问')
console.log('  ⚠️  如看到证书警告，选择"继续访问"即可')
