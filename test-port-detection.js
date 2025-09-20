/**
 * 测试端口检测功能
 */

const apiPorts = [3002, 3001, 3000, 3003, 3004, 3005, 3006, 3007, 3008, 3009];
const timeout = 10000;

async function detectAvailablePorts() {
  console.log('🔍 开始检测可用端口...');
  
  for (const port of apiPorts) {
    try {
      const testUrl = `http://localhost:${port}/api/auth/status`;
      console.log(`🧪 测试端口 ${port}...`);
      
      const response = await fetch(testUrl, {
        method: 'GET',
        credentials: 'include',
        signal: AbortSignal.timeout(timeout)
      });
      
      if (response.ok) {
        const currentApiUrl = `http://localhost:${port}`;
        console.log(`✅ 端口 ${port} 可用，API URL: ${currentApiUrl}`);
        
        // 测试认证页面
        const authUrl = currentApiUrl + '/plugin/auth';
        console.log(`🧪 测试认证页面: ${authUrl}`);
        
        try {
          const authResponse = await fetch(authUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(timeout)
          });
          
          if (authResponse.ok) {
            console.log(`✅ 认证页面可访问，状态码: ${authResponse.status}`);
            console.log(`✅ 内容类型: ${authResponse.headers.get('content-type')}`);
            console.log(`✅ X-Frame-Options: ${authResponse.headers.get('X-Frame-Options') || '未设置'}`);
            return { port, apiUrl: currentApiUrl, authUrl };
          } else {
            console.log(`❌ 认证页面不可访问，状态码: ${authResponse.status}`);
          }
        } catch (authError) {
          console.log(`❌ 认证页面测试失败: ${authError.message}`);
        }
      } else {
        console.log(`❌ 端口 ${port} API不可用，状态码: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ 端口 ${port} 不可用: ${error.message}`);
    }
  }
  
  console.log('❌ 未找到可用的本地API服务器');
  return null;
}

// 运行测试
detectAvailablePorts().then(result => {
  if (result) {
    console.log('🎉 检测成功:', result);
  } else {
    console.log('💥 检测失败');
  }
}).catch(error => {
  console.error('测试失败:', error);
});
