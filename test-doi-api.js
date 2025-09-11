// 测试修复后的 DOI API
const testDOI = '10.1038/nature12373'

async function testCheckDOI() {
  console.log('=== 测试 Check DOI API ===')
  try {
    const response = await fetch(`http://localhost:3000/api/papers/check-doi?doi=${encodeURIComponent(testDOI)}`)
    const data = await response.json()
    
    console.log('状态:', response.status)
    console.log('响应:', data)
    
    if (response.ok) {
      console.log('✓ Check DOI API 工作正常')
      return data
    } else {
      console.log('✗ Check DOI API 失败:', data.error)
      return null
    }
  } catch (error) {
    console.log('✗ Check DOI API 异常:', error.message)
    return null
  }
}

async function testAddFromDOI() {
  console.log('\n=== 测试 Add From DOI API ===')
  try {
    const response = await fetch('http://localhost:3000/api/papers/add-from-doi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doi: testDOI,
        userId: 'test-user-id' // 模拟用户ID
      })
    })
    
    const data = await response.json()
    
    console.log('状态:', response.status)
    console.log('响应:', data)
    
    if (response.ok) {
      console.log('✓ Add From DOI API 工作正常')
    } else {
      console.log('✗ Add From DOI API 失败:', data.error)
    }
    
  } catch (error) {
    console.log('✗ Add From DOI API 异常:', error.message)
  }
}

// 运行测试
async function runTests() {
  console.log('开始测试 DOI API...\n')
  
  const checkResult = await testCheckDOI()
  
  // 如果论文不存在，尝试添加
  if (checkResult && !checkResult.exists) {
    await testAddFromDOI()
  } else {
    console.log('\n论文已存在，跳过添加测试')
  }
  
  console.log('\n测试完成')
}

runTests()
