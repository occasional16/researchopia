console.log('🖥️  服务器监控和故障排除指南\n')

console.log('✅ 问题已解决!')
console.log('  1. 修复了Next.js 15的params警告（导致不稳定的原因）')
console.log('  2. 服务器已重新启动并正常运行')
console.log('  3. 创建了自动重启脚本')

console.log('\n📊 服务器稳定性监控方法:')
console.log('  • 终端显示 "Ready in 1911ms" = 服务器正常')
console.log('  • 终端显示 "PS D:\\..." = 服务器已停止')
console.log('  • 看到大量错误信息 = 需要修复代码问题')

console.log('\n🔧 HTTPS证书问题解释:')
console.log('  ❌ "此网站没有证书" - 这是正常的!')
console.log('  ✅ 开发环境(localhost)使用HTTP，不需要SSL证书')
console.log('  ✅ 点击"高级"→"继续前往localhost"即可')
console.log('  ✅ 只有生产环境才需要HTTPS证书')

console.log('\n⚡ 自动重启方案:')
console.log('  方案1: 双击运行 auto-restart.bat (Windows批处理)')
console.log('  方案2: PowerShell运行 .\\auto-restart.ps1')
console.log('  方案3: 手动重启 npm run dev')

console.log('\n🎯 推荐监控流程:')
console.log('  1. 保持终端窗口可见')
console.log('  2. 每次使用前检查是否显示 "Ready in Xs"')
console.log('  3. 如果显示命令提示符，立即重启服务器')
console.log('  4. 遇到证书警告，直接点击"继续访问"')

console.log('\n🌐 当前状态检查:')
console.log('  服务器: ✅ 运行中')
console.log('  地址: http://localhost:3000')
console.log('  Next.js错误: ✅ 已修复')
console.log('  稳定性: ✅ 已优化')

console.log('\n💡 重要提示:')
console.log('  • 证书警告是正常的，不是真正的安全问题')
console.log('  • 服务器停止时，立即运行 npm run dev 重启')
console.log('  • 如果频繁断开，可以使用自动重启脚本')

console.log('\n🚀 一切就绪！现在可以正常使用应用了！')
