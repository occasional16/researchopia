// Node.js脚本测试Cookie传递
const https = require('https');
const http = require('http');

function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
      headers: headers
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function testCookies() {
  console.log('🧪 测试Cookie传递到API...\n');

  // 测试1: Cookie API (无Cookie)
  console.log('1. 测试Cookie API (无Cookie):');
  try {
    const response1 = await makeRequest('http://localhost:3001/api/test-cookie');
    console.log(JSON.stringify(response1, null, 2));
  } catch (error) {
    console.log('错误:', error.message);
  }

  // 测试2: Cookie API (带Cookie)
  console.log('\n2. 测试Cookie API (带Cookie):');
  try {
    const headers = {
      'Cookie': 'rp_dev_auth=1; rp_dev_user=%7B%22username%22%3A%22testuser%22%2C%22id%22%3A%22test-123%22%2C%22email%22%3A%22test%40researchopia.com%22%7D'
    };
    const response2 = await makeRequest('http://localhost:3001/api/test-cookie', headers);
    console.log(JSON.stringify(response2, null, 2));
  } catch (error) {
    console.log('错误:', error.message);
  }

  // 测试3: 认证状态API (带Cookie)
  console.log('\n3. 测试认证状态API (带Cookie):');
  try {
    const headers = {
      'Cookie': 'rp_dev_auth=1; rp_dev_user=%7B%22username%22%3A%22testuser%22%2C%22id%22%3A%22test-123%22%2C%22email%22%3A%22test%40researchopia.com%22%7D'
    };
    const response3 = await makeRequest('http://localhost:3001/api/auth/status', headers);
    console.log(JSON.stringify(response3, null, 2));
  } catch (error) {
    console.log('错误:', error.message);
  }

  console.log('\n✅ 测试完成!');
}

testCookies();
