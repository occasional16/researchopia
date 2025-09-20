// 模拟Zotero插件的XMLHttpRequest请求
const http = require('http');

function simulateZoteroXHR(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Zotero/7.0',
        ...options.headers
      }
    };

    // 模拟withCredentials: true的行为
    if (options.withCredentials) {
      // 在真实的浏览器环境中，这会自动包含cookie
      // 这里我们手动添加测试cookie
      requestOptions.headers['Cookie'] = 'rp_dev_auth=1; rp_dev_user=%7B%22username%22%3A%22testuser%22%2C%22id%22%3A%22test-123%22%2C%22email%22%3A%22test%40researchopia.com%22%7D';
    }

    console.log('🔌 模拟Zotero插件XMLHttpRequest请求:');
    console.log('  URL:', url);
    console.log('  Method:', requestOptions.method);
    console.log('  Headers:', requestOptions.headers);

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log('  Response Status:', res.statusCode);
        console.log('  Response Headers:', res.headers);
        
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
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

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testZoteroPlugin() {
  console.log('🧪 测试Zotero插件Cookie同步...\n');

  // 测试1: 端口检测
  console.log('1. 测试端口检测:');
  try {
    const response1 = await simulateZoteroXHR('http://localhost:3001/api/port-detector');
    console.log('✅ 端口检测成功:', response1.data);
  } catch (error) {
    console.log('❌ 端口检测失败:', error.message);
  }

  // 测试2: 认证状态检查 (无Cookie)
  console.log('\n2. 测试认证状态检查 (无Cookie):');
  try {
    const response2 = await simulateZoteroXHR('http://localhost:3001/api/auth/status');
    console.log('结果:', response2.data);
  } catch (error) {
    console.log('❌ 认证状态检查失败:', error.message);
  }

  // 测试3: 认证状态检查 (带Cookie - 模拟withCredentials: true)
  console.log('\n3. 测试认证状态检查 (带Cookie):');
  try {
    const response3 = await simulateZoteroXHR('http://localhost:3001/api/auth/status', {
      withCredentials: true
    });
    console.log('结果:', response3.data);
    
    if (response3.data.authenticated) {
      console.log('✅ Zotero插件认证成功!');
      console.log('  用户:', response3.data.user.name);
      console.log('  邮箱:', response3.data.user.email);
      console.log('  认证方式:', response3.data.authMethod);
      console.log('  Token:', response3.data.token);
    } else {
      console.log('❌ Zotero插件认证失败');
    }
  } catch (error) {
    console.log('❌ 认证状态检查失败:', error.message);
  }

  console.log('\n✅ Zotero插件测试完成!');
}

testZoteroPlugin();
