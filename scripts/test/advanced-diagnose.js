console.log('🔍 高级 localhost 连接诊断...\n')

const net = require('net')
const http = require('http')

// 测试多个地址
const testAddresses = [
  { name: 'localhost', host: 'localhost', port: 3000 },
  { name: '127.0.0.1', host: '127.0.0.1', port: 3000 },
  { name: '0.0.0.0', host: '0.0.0.0', port: 3000 },
  { name: '本机IP', host: '183.173.171.124', port: 3000 }
]

// 检查单个地址
function checkAddress(address) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(2000)
    
    socket.on('connect', () => {
      console.log(`✅ ${address.name} (${address.host}): 连接成功`)
      socket.destroy()
      resolve(true)
    })
    
    socket.on('timeout', () => {
      console.log(`⏱️  ${address.name} (${address.host}): 超时`)
      socket.destroy()
      resolve(false)
    })
    
    socket.on('error', (err) => {
      console.log(`❌ ${address.name} (${address.host}): ${err.code || err.message}`)
      resolve(false)
    })
    
    socket.connect(address.port, address.host)
  })
}

// HTTP测试
function testHttp(address) {
  return new Promise((resolve) => {
    const url = `http://${address.host}:${address.port}`
    const req = http.get(url, (res) => {
      console.log(`✅ HTTP ${address.name}: 状态码 ${res.statusCode}`)
      res.on('data', () => {}) // 消费数据
      res.on('end', () => resolve(true))
    })
    
    req.on('error', (err) => {
      console.log(`❌ HTTP ${address.name}: ${err.code || err.message}`)
      resolve(false)
    })
    
    req.setTimeout(3000, () => {
      console.log(`⏱️  HTTP ${address.name}: 超时`)
      req.destroy()
      resolve(false)
    })
  })
}

async function advancedDiagnose() {
  console.log('1. 测试TCP连接:')
  const results = []
  
  for (const address of testAddresses) {
    const result = await checkAddress(address)
    results.push({ address, connected: result })
  }
  
  console.log('\n2. 测试HTTP响应:')
  const workingAddresses = results.filter(r => r.connected)
  
  if (workingAddresses.length > 0) {
    for (const { address } of workingAddresses) {
      await testHttp(address)
    }
  } else {
    console.log('❌ 没有可用的TCP连接')
  }
  
  console.log('\n📋 诊断总结:')
  const successful = results.filter(r => r.connected)
  
  if (successful.length > 0) {
    console.log('✅ 可用地址:')
    successful.forEach(({ address }) => {
      console.log(`   - http://${address.host}:${address.port}`)
    })
  } else {
    console.log('❌ 所有地址都无法连接')
    console.log('\n🔧 可能的问题:')
    console.log('1. 开发服务器未运行')
    console.log('2. 防火墙阻止连接')
    console.log('3. 端口被其他程序占用')
    console.log('4. 网络适配器配置问题')
  }
  
  console.log('\n💡 建议:')
  console.log('- VS Code内置浏览器似乎能正常访问')
  console.log('- 可以直接在VS Code中测试应用功能')
  console.log('- 如需外部浏览器访问，请检查防火墙设置')
}

advancedDiagnose()
