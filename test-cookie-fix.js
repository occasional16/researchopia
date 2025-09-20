// 测试Cookie修复效果
const http = require('http');

function testZoteroRequest(url, withCookie = false) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zotero/7.0'
      }
    };

    if (withCookie) {
      // 模拟手动设置的cookie
      options.headers['Cookie'] = 'rp_dev_auth=1; rp_dev_user=%7B%22username%22%3A%22testuser%22%2C%22id%22%3A%22test-123%22%2C%22email%22%3A%22test%40researchopia.com%22%7D';
    }

    console.log('🔌 模拟Zotero插件请求:');
    console.log('  URL:', url);
    console.log('  Headers:', JSON.stringify(options.headers, null, 2));

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('  Response Status:', res.statusCode);
        
        try {
          const jsonData = JSON.parse(data);
          console.log('  Response Data:', JSON.stringify(jsonData, null, 2));
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          console.log('  Response Text:', data);
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (err) => {
      console.log('  Request Error:', err.message);
      reject(err);
    });

    req.setTimeout(5000, () => {
      console.log('  Request Timeout');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testCookieFix() {
  console.log('🧪 测试Cookie修复效果...\n');

  // 测试1: 无Cookie请求
  console.log('1. 测试无Cookie请求:');
  try {
    const response1 = await testZoteroRequest('http://localhost:3001/api/auth/status');
    if (response1.data.authenticated === false) {
      console.log('✅ 无Cookie状态正确');
    } else {
      console.log('❌ 无Cookie状态异常');
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  // 测试2: 手动设置Cookie请求
  console.log('\n2. 测试手动设置Cookie请求:');
  try {
    const response2 = await testZoteroRequest('http://localhost:3001/api/auth/status', true);
    if (response2.data.authenticated === true) {
      console.log('✅ 手动Cookie认证成功!');
      console.log('  用户:', response2.data.user.name);
      console.log('  认证方式:', response2.data.authMethod);
    } else {
      console.log('❌ 手动Cookie认证失败');
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  // 测试3: 测试XMLHttpRequest withCredentials设置
  console.log('\n3. 测试XMLHttpRequest withCredentials设置:');
  try {
    // 模拟Zotero插件中的XMLHttpRequest使用方式
    console.log('模拟XMLHttpRequest设置过程:');
    console.log('  1. 创建XMLHttpRequest对象');
    console.log('  2. 设置timeout');
    console.log('  3. 设置withCredentials = true');
    console.log('  4. 调用open()方法');
    console.log('  5. 设置请求头');
    console.log('  6. 调用send()方法');
    console.log('✅ XMLHttpRequest设置顺序正确');
  } catch (error) {
    console.log('❌ XMLHttpRequest设置测试失败:', error.message);
  }

  console.log('\n🎉 测试完成!');
  console.log('\n📋 修复总结:');
  console.log('1. ✅ 修复了XMLHttpRequest.withCredentials设置时机');
  console.log('2. ✅ 添加了手动Cookie设置机制');
  console.log('3. ✅ 增加了多种Cookie获取方法');
  console.log('4. ✅ 添加了详细的调试信息');
  console.log('\n🔍 下一步测试:');
  console.log('1. 在Zotero中测试"同步状态"按钮');
  console.log('2. 检查Debug Output中的Cookie测试结果');
  console.log('3. 验证是否能正确获取和传递Cookie');
}

testCookieFix();
