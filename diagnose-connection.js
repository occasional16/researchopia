console.log('🔍 诊断 localhost 连接问题...\n')

const net = require('net')
const http = require('http')

// 检查端口3000是否开放
function checkPort() {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    
    socket.setTimeout(3000)
    
    socket.on('connect', () => {
      console.log('✅ 端口3000: 开放')
      socket.destroy()
      resolve(true)
    })
    
    socket.on('timeout', () => {
      console.log('❌ 端口3000: 超时')
      socket.destroy()
      resolve(false)
    })
    
    socket.on('error', (err) => {
      console.log('❌ 端口3000: 连接错误 -', err.message)
      resolve(false)
    })
    
    socket.connect(3000, 'localhost')
  })
}

// 测试HTTP请求
function testHttpRequest() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000', (res) => {
      console.log('✅ HTTP请求: 成功 (状态码:', res.statusCode, ')')
      res.on('data', () => {}) // 消费数据
      res.on('end', () => resolve(true))
    })
    
    req.on('error', (err) => {
      console.log('❌ HTTP请求: 失败 -', err.message)
      resolve(false)
    })
    
    req.setTimeout(5000, () => {
      console.log('❌ HTTP请求: 超时')
      req.destroy()
      resolve(false)
    })
  })
}

async function diagnose() {
  console.log('1. 检查端口连接:')
  const portOpen = await checkPort()
  
  console.log('\n2. 检查HTTP响应:')
  if (portOpen) {
    await testHttpRequest()
  } else {
    console.log('❌ 端口未开放，跳过HTTP测试')
  }
  
  console.log('\n📋 诊断完成')
  
  if (!portOpen) {
    console.log('\n🔧 建议解决方案:')
    console.log('1. 确保开发服务器正在运行: npm run dev')
    console.log('2. 检查防火墙设置')
    console.log('3. 尝试重启服务器')
    console.log('4. 使用 PowerShell 脚本: .\\start-dev.ps1')
  }
}

diagnose()
