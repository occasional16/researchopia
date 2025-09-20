/**
 * 测试插件iframe认证功能
 */

// 模拟Zotero插件的核心功能
const TestPlugin = {
  config: {
    apiPorts: [3001, 3000, 3002],
    currentApiUrl: null,
    timeout: 10000,
    authPageUrl: 'https://www.researchopia.com/plugin/auth',
    localAuthPageUrl: 'http://localhost:3001/plugin/auth'
  },

  log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] 研学港测试: ${message}`);
  },

  async detectAvailablePorts() {
    this.log('🔍 开始检测可用端口...');
    
    for (const port of this.config.apiPorts) {
      try {
        const testUrl = `http://localhost:${port}/api/auth/status`;
        this.log(`🧪 测试端口 ${port}...`);
        
        const response = await fetch(testUrl, {
          method: 'GET',
          credentials: 'include',
          signal: AbortSignal.timeout(this.config.timeout)
        });
        
        if (response.ok) {
          this.config.currentApiUrl = `http://localhost:${port}`;
          this.log(`✅ 端口 ${port} 可用，API URL: ${this.config.currentApiUrl}`);
          return true;
        }
      } catch (error) {
        this.log(`❌ 端口 ${port} 不可用: ${error.message}`);
      }
    }
    
    this.log('❌ 未找到可用的本地API服务器');
    return false;
  },

  getAuthUrl() {
    if (this.config.currentApiUrl) {
      return this.config.currentApiUrl + '/plugin/auth';
    } else {
      return this.config.authPageUrl;
    }
  },

  async testIframeAuth() {
    this.log('🚀 开始测试iframe认证...');
    
    // 1. 检测可用端口
    const portDetected = await this.detectAvailablePorts();
    this.log(`端口检测结果: ${portDetected ? '成功' : '失败'}`);
    
    // 2. 获取认证URL
    const authUrl = this.getAuthUrl();
    this.log(`认证URL: ${authUrl}`);
    
    // 3. 测试URL可访问性
    try {
      this.log('🧪 测试认证URL可访问性...');
      const response = await fetch(authUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout)
      });
      
      if (response.ok) {
        this.log('✅ 认证URL可访问');
        this.log(`响应状态: ${response.status}`);
        this.log(`响应类型: ${response.headers.get('content-type')}`);
        
        // 检查是否是HTML页面
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          this.log('✅ 认证页面返回HTML内容，适合iframe加载');
        } else {
          this.log('⚠️ 认证页面不是HTML内容，可能不适合iframe加载');
        }
      } else {
        this.log(`❌ 认证URL不可访问，状态码: ${response.status}`);
      }
    } catch (error) {
      this.log(`❌ 测试认证URL失败: ${error.message}`);
    }
    
    // 4. 测试CORS头部
    try {
      this.log('🧪 测试CORS配置...');
      const corsResponse = await fetch(authUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3001',
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      this.log(`CORS预检响应状态: ${corsResponse.status}`);
      this.log(`X-Frame-Options: ${corsResponse.headers.get('X-Frame-Options') || '未设置'}`);
      this.log(`Access-Control-Allow-Origin: ${corsResponse.headers.get('Access-Control-Allow-Origin') || '未设置'}`);
    } catch (error) {
      this.log(`❌ CORS测试失败: ${error.message}`);
    }
    
    this.log('🎉 iframe认证测试完成');
  }
};

// 运行测试
TestPlugin.testIframeAuth().catch(error => {
  console.error('测试失败:', error);
});
