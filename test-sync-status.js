// 测试同步状态功能
const http = require('http');

function simulateZoteroPluginRequest(url, withCookie = false) {
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
      // 模拟开发认证cookie
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
        console.log('  Response Headers:', JSON.stringify(res.headers, null, 2));
        
        try {
          const jsonData = JSON.parse(data);
          console.log('  Response Data:', JSON.stringify(jsonData, null, 2));
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          console.log('  Response Text:', data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
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

async function testSyncStatus() {
  console.log('🧪 测试插件同步状态功能...\n');

  // 测试1: 检查服务器是否运行
  console.log('1. 检查服务器状态:');
  try {
    const healthResponse = await simulateZoteroPluginRequest('http://localhost:3001/api/health');
    console.log('✅ 服务器运行正常');
  } catch (error) {
    console.log('❌ 服务器未运行:', error.message);
    return;
  }

  // 测试2: 无认证状态
  console.log('\n2. 测试无认证状态:');
  try {
    const response1 = await simulateZoteroPluginRequest('http://localhost:3001/api/auth/status');
    if (response1.data.authenticated === false) {
      console.log('✅ 无认证状态正确');
    } else {
      console.log('❌ 无认证状态异常');
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  // 测试3: 带认证cookie
  console.log('\n3. 测试带认证cookie:');
  try {
    const response2 = await simulateZoteroPluginRequest('http://localhost:3001/api/auth/status', true);
    if (response2.data.authenticated === true) {
      console.log('✅ 认证状态同步成功!');
      console.log('  用户:', response2.data.user.name);
      console.log('  邮箱:', response2.data.user.email);
      console.log('  认证方式:', response2.data.authMethod);
      console.log('  Token:', response2.data.token);
    } else {
      console.log('❌ 认证状态同步失败');
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  // 测试4: 端口检测
  console.log('\n4. 测试端口检测:');
  const ports = [3001, 3000, 3002];
  for (const port of ports) {
    try {
      console.log(`  测试端口 ${port}...`);
      const response = await simulateZoteroPluginRequest(`http://localhost:${port}/api/health`);
      console.log(`  ✅ 端口 ${port} 可用`);
    } catch (error) {
      console.log(`  ❌ 端口 ${port} 不可用: ${error.message}`);
    }
  }

  console.log('\n🎉 测试完成!');
  console.log('\n📋 插件使用指南:');
  console.log('1. 在浏览器中登录研学港网站');
  console.log('2. 打开Zotero插件面板');
  console.log('3. 点击"同步状态"按钮');
  console.log('4. 查看插件面板是否显示登录状态');
  console.log('5. 检查Zotero Debug Output中的详细日志');
}

testSyncStatus();
