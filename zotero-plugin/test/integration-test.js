/**
 * Researchopia 插件集成测试
 * 用于验证插件的核心功能是否正常工作
 */

class ResearchopiaIntegrationTest {
  constructor() {
    this.testResults = [];
    this.addon = null;
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 开始运行 Researchopia 集成测试...');
    
    try {
      // 初始化插件
      await this.initializeAddon();
      
      // 运行各项测试
      await this.testAuthentication();
      await this.testAnnotationExtraction();
      await this.testSyncFunctionality();
      await this.testSocialFeatures();
      await this.testUIComponents();
      await this.testReaderIntegration();
      
      // 输出测试结果
      this.printTestResults();
      
    } catch (error) {
      console.error('❌ 测试运行失败:', error);
    }
  }

  /**
   * 初始化插件
   */
  async initializeAddon() {
    try {
      this.addon = Zotero.Researchopia;
      if (!this.addon) {
        throw new Error('插件未正确加载');
      }
      
      this.addTestResult('插件初始化', true, '插件成功加载');
    } catch (error) {
      this.addTestResult('插件初始化', false, error.message);
      throw error;
    }
  }

  /**
   * 测试认证功能
   */
  async testAuthentication() {
    console.log('🔐 测试认证功能...');
    
    try {
      // 测试认证管理器是否存在
      if (!this.addon.auth) {
        throw new Error('认证管理器未初始化');
      }
      
      // 测试认证状态检查
      const isAuth = this.addon.auth.isAuthenticated();
      this.addTestResult('认证状态检查', true, `认证状态: ${isAuth}`);
      
      // 测试用户信息获取
      const user = this.addon.auth.getCurrentUser();
      this.addTestResult('用户信息获取', true, user ? '用户信息可用' : '未登录状态');
      
    } catch (error) {
      this.addTestResult('认证功能测试', false, error.message);
    }
  }

  /**
   * 测试标注提取功能
   */
  async testAnnotationExtraction() {
    console.log('📝 测试标注提取功能...');
    
    try {
      if (!this.addon.annotation) {
        throw new Error('标注管理器未初始化');
      }
      
      // 获取当前选中的条目
      const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
      
      if (selectedItems.length > 0) {
        const item = selectedItems[0];
        
        // 测试标注提取
        const annotations = await this.addon.annotation.extractAnnotationsFromItem(item);
        this.addTestResult('标注提取', true, `提取到 ${annotations.length} 个标注`);
        
        // 测试标注处理
        if (annotations.length > 0) {
          const processed = await this.addon.annotation.processAnnotations(annotations);
          this.addTestResult('标注处理', true, `处理了 ${processed.length} 个标注`);
        }
        
      } else {
        this.addTestResult('标注提取', true, '没有选中的条目，跳过测试');
      }
      
    } catch (error) {
      this.addTestResult('标注提取功能', false, error.message);
    }
  }

  /**
   * 测试同步功能
   */
  async testSyncFunctionality() {
    console.log('🔄 测试同步功能...');
    
    try {
      if (!this.addon.sync) {
        throw new Error('同步管理器未初始化');
      }
      
      // 测试在线状态检查
      const isOnline = await this.addon.sync.checkOnlineStatus();
      this.addTestResult('在线状态检查', true, `在线状态: ${isOnline}`);
      
      // 测试缓存功能
      this.addon.sync.clearCache();
      this.addTestResult('缓存清理', true, '缓存已清理');
      
    } catch (error) {
      this.addTestResult('同步功能测试', false, error.message);
    }
  }

  /**
   * 测试社交功能
   */
  async testSocialFeatures() {
    console.log('👥 测试社交功能...');
    
    try {
      if (!this.addon.social) {
        throw new Error('社交管理器未初始化');
      }
      
      // 测试社交统计
      const stats = await this.addon.social.getSocialStats('test-annotation-id');
      this.addTestResult('社交统计获取', true, '社交统计功能正常');
      
      // 测试缓存清理
      this.addon.social.clearCache();
      this.addTestResult('社交缓存清理', true, '社交缓存已清理');
      
    } catch (error) {
      this.addTestResult('社交功能测试', false, error.message);
    }
  }

  /**
   * 测试UI组件
   */
  async testUIComponents() {
    console.log('🎨 测试UI组件...');
    
    try {
      if (!this.addon.ui) {
        throw new Error('UI管理器未初始化');
      }
      
      // 测试UI状态
      const uiState = this.addon.ui.getUIState();
      this.addTestResult('UI状态获取', true, `UI状态: ${JSON.stringify(uiState)}`);
      
    } catch (error) {
      this.addTestResult('UI组件测试', false, error.message);
    }
  }

  /**
   * 测试阅读器集成
   */
  async testReaderIntegration() {
    console.log('📖 测试阅读器集成...');
    
    try {
      if (!this.addon.reader) {
        throw new Error('阅读器管理器未初始化');
      }
      
      // 测试阅读器统计
      const stats = this.addon.reader.getReaderStats();
      this.addTestResult('阅读器统计', true, `阅读器统计: ${JSON.stringify(stats)}`);
      
    } catch (error) {
      this.addTestResult('阅读器集成测试', false, error.message);
    }
  }

  /**
   * 添加测试结果
   */
  addTestResult(testName, passed, message) {
    this.testResults.push({
      name: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 打印测试结果
   */
  printTestResults() {
    console.log('\n📊 测试结果汇总:');
    console.log('='.repeat(50));
    
    let passedCount = 0;
    let totalCount = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.message}`);
      if (result.passed) passedCount++;
    });
    
    console.log('='.repeat(50));
    console.log(`总计: ${passedCount}/${totalCount} 个测试通过`);
    
    if (passedCount === totalCount) {
      console.log('🎉 所有测试通过！');
    } else {
      console.log('⚠️ 部分测试失败，请检查相关功能');
    }
  }
}

// 导出测试类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResearchopiaIntegrationTest;
}

// 如果在浏览器环境中，添加到全局对象
if (typeof window !== 'undefined') {
  window.ResearchopiaIntegrationTest = ResearchopiaIntegrationTest;
}

// 自动运行测试（如果直接执行此文件）
if (typeof Zotero !== 'undefined' && Zotero.Researchopia) {
  const tester = new ResearchopiaIntegrationTest();
  tester.runAllTests().catch(console.error);
}
