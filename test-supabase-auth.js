// 测试Supabase认证cookie同步
const http = require('http');

function makeZoteroRequest(url, options = {}) {
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
      // 模拟真实的Supabase认证cookie
      const supabaseToken = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        refresh_token: 'refresh_token_example',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: {
            username: 'testuser'
          }
        }
      };
      
      const encodedToken = encodeURIComponent(JSON.stringify(supabaseToken));
      
      if (options.authType === 'supabase') {
        requestOptions.headers['Cookie'] = `sb-localhost-auth-token=${encodedToken}`;
      } else {
        // 开发认证
        requestOptions.headers['Cookie'] = 'rp_dev_auth=1; rp_dev_user=%7B%22username%22%3A%22testuser%22%2C%22id%22%3A%22test-123%22%2C%22email%22%3A%22test%40researchopia.com%22%7D';
      }
    }

    console.log('🔌 模拟Zotero插件请求:');
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

async function testSupabaseAuth() {
  console.log('🧪 测试Supabase认证同步...\n');

  // 测试1: 无认证
  console.log('1. 测试无认证状态:');
  try {
    const response1 = await makeZoteroRequest('http://localhost:3001/api/auth/status');
    console.log('结果:', response1.data);
    console.log('认证状态:', response1.data.authenticated ? '✅ 已认证' : '❌ 未认证');
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  // 测试2: 开发认证
  console.log('\n2. 测试开发认证:');
  try {
    const response2 = await makeZoteroRequest('http://localhost:3001/api/auth/status', {
      withCredentials: true,
      authType: 'dev'
    });
    console.log('结果:', response2.data);
    if (response2.data.authenticated) {
      console.log('✅ 开发认证成功!');
      console.log('  用户:', response2.data.user.name);
      console.log('  认证方式:', response2.data.authMethod);
    } else {
      console.log('❌ 开发认证失败');
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  // 测试3: 模拟Supabase认证
  console.log('\n3. 测试Supabase认证:');
  try {
    const response3 = await makeZoteroRequest('http://localhost:3001/api/auth/status', {
      withCredentials: true,
      authType: 'supabase'
    });
    console.log('结果:', response3.data);
    if (response3.data.authenticated) {
      console.log('✅ Supabase认证成功!');
      console.log('  用户:', response3.data.user.name);
      console.log('  认证方式:', response3.data.authMethod);
    } else {
      console.log('❌ Supabase认证失败');
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
  }

  console.log('\n✅ 测试完成!');
}

testSupabaseAuth();
