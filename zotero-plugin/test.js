/*
  Researchopia Plugin Test Suite
  Basic functionality tests for the Zotero plugin
*/

Zotero.Researchopia.Test = {
  
  /**
   * 运行所有测试
   */
  async runAllTests() {
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    
    const tests = [
      'testPluginInitialization',
      'testConfigModule',
      'testAnnotationSharing',
      'testAnnotationConversion',
      'testUIComponents'
    ];
    
    for (const testName of tests) {
      results.total++;
      try {
        const passed = await this[testName]();
        if (passed) {
          results.passed++;
          this.log(`✓ ${testName} passed`);
        } else {
          results.failed++;
          results.errors.push(`${testName} failed`);
          this.log(`✗ ${testName} failed`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${testName} threw error: ${error.message}`);
        this.log(`✗ ${testName} error: ${error.message}`);
      }
    }
    
    this.log(`Test Results: ${results.passed}/${results.total} passed`);
    return results;
  },
  
  /**
   * 测试插件初始化
   */
  testPluginInitialization() {
    try {
      // 检查主对象存在
      if (!Zotero.Researchopia) return false;
      
      // 检查必要属性
      const requiredProps = ['id', 'version', 'rootURI', 'initialized'];
      for (const prop of requiredProps) {
        if (!(prop in Zotero.Researchopia)) return false;
      }
      
      // 检查初始化状态
      if (!Zotero.Researchopia.initialized) return false;
      
      return true;
    } catch (error) {
      this.log('Plugin initialization test error: ' + error);
      return false;
    }
  },
  
  /**
   * 测试配置模块
   */
  testConfigModule() {
    try {
      // 检查Config对象存在
      if (!Zotero.Researchopia.Config) return false;
      
      // 测试基本配置获取
      const apiBase = Zotero.Researchopia.Config.get('apiBase');
      if (!apiBase || typeof apiBase !== 'string') return false;
      
      // 测试配置设置和获取
      const testKey = 'testValue';
      const testValue = 'test123';
      Zotero.Researchopia.Config.set(testKey, testValue);
      const retrieved = Zotero.Researchopia.Config.get(testKey);
      if (retrieved !== testValue) return false;
      
      // 测试配置验证
      const validation = Zotero.Researchopia.Config.validate();
      if (!validation || typeof validation.valid !== 'boolean') return false;
      
      return true;
    } catch (error) {
      this.log('Config module test error: ' + error);
      return false;
    }
  },
  
  /**
   * 测试标注分享模块
   */
  testAnnotationSharing() {
    try {
      // 检查AnnotationSharing对象存在
      if (!Zotero.Researchopia.AnnotationSharing) return false;
      
      // 检查必要方法存在
      const requiredMethods = [
        'init',
        'convertZoteroToUniversal',
        'uploadAnnotations',
        'getDocumentAnnotations'
      ];
      
      for (const method of requiredMethods) {
        if (typeof Zotero.Researchopia.AnnotationSharing[method] !== 'function') {
          return false;
        }
      }
      
      // 测试ID生成
      const id1 = Zotero.Researchopia.AnnotationSharing.generateId();
      const id2 = Zotero.Researchopia.AnnotationSharing.generateId();
      if (!id1 || !id2 || id1 === id2) return false;
      
      return true;
    } catch (error) {
      this.log('Annotation sharing test error: ' + error);
      return false;
    }
  },
  
  /**
   * 测试标注转换功能
   */
  testAnnotationConversion() {
    try {
      // 创建模拟Zotero标注
      const mockZoteroAnnotation = {
        key: 'test123',
        annotationType: 'highlight',
        annotationText: 'Test annotation text',
        annotationComment: 'Test comment',
        annotationColor: '#ffd400',
        annotationPosition: JSON.stringify({
          pageIndex: 0,
          rects: [[100, 100, 200, 120]]
        }),
        dateAdded: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        parentItemID: 12345
      };
      
      // 测试转换
      const universal = Zotero.Researchopia.AnnotationSharing.convertZoteroToUniversal(mockZoteroAnnotation);
      
      // 验证转换结果
      if (!universal) return false;
      if (universal.id !== 'test123') return false;
      if (universal.type !== 'highlight') return false;
      if (universal.content.text !== 'Test annotation text') return false;
      if (universal.metadata.platform !== 'zotero') return false;
      
      return true;
    } catch (error) {
      this.log('Annotation conversion test error: ' + error);
      return false;
    }
  },
  
  /**
   * 测试UI组件
   */
  testUIComponents() {
    try {
      // 检查Item Pane注册
      if (!Zotero.Researchopia.registeredSection) return false;
      
      // 检查主要方法存在
      const requiredMethods = [
        'renderItemPane',
        'buildExternalURL',
        'showAlert'
      ];
      
      for (const method of requiredMethods) {
        if (typeof Zotero.Researchopia[method] !== 'function') {
          return false;
        }
      }
      
      // 测试URL构建（使用null item，应该返回基础URL）
      const url = Zotero.Researchopia.buildExternalURL(null);
      if (!url || !url.includes('researchopia.com')) return false;
      
      return true;
    } catch (error) {
      this.log('UI components test error: ' + error);
      return false;
    }
  },
  
  /**
   * 创建模拟标注用于测试
   */
  createMockAnnotation(type = 'highlight') {
    return {
      key: this.generateTestId(),
      annotationType: type,
      annotationText: `Mock ${type} text`,
      annotationComment: `Mock ${type} comment`,
      annotationColor: '#ffd400',
      annotationPosition: JSON.stringify({
        pageIndex: Math.floor(Math.random() * 10),
        rects: [[100, 100, 200, 120]]
      }),
      dateAdded: new Date().toISOString(),
      dateModified: new Date().toISOString(),
      parentItemID: 12345
    };
  },
  
  /**
   * 生成测试ID
   */
  generateTestId() {
    return 'test_' + Math.random().toString(36).substring(2, 15);
  },
  
  /**
   * 日志输出
   */
  log(msg) {
    Zotero.debug("Researchopia-Test: " + msg);
  },
  
  /**
   * 运行性能测试
   */
  async runPerformanceTests() {
    this.log("Running performance tests...");
    
    // 测试批量标注转换性能
    const startTime = Date.now();
    const mockAnnotations = [];
    
    for (let i = 0; i < 100; i++) {
      mockAnnotations.push(this.createMockAnnotation());
    }
    
    const convertedAnnotations = mockAnnotations
      .map(ann => Zotero.Researchopia.AnnotationSharing.convertZoteroToUniversal(ann))
      .filter(ann => ann !== null);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.log(`Converted ${convertedAnnotations.length} annotations in ${duration}ms`);
    this.log(`Average: ${(duration / convertedAnnotations.length).toFixed(2)}ms per annotation`);
    
    return {
      count: convertedAnnotations.length,
      duration: duration,
      averagePerItem: duration / convertedAnnotations.length
    };
  }
};