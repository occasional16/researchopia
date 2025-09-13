// test-extension.js - 扩展功能测试脚本

class ExtensionTester {
  constructor() {
    this.testResults = [];
    this.init();
  }

  init() {
    console.log('🧪 研学港扩展测试开始...');
    this.runAllTests();
  }

  async runAllTests() {
    console.log('\n📋 测试清单：');
    
    // 测试DOI检测功能
    await this.testDOIDetection();
    
    // 测试存储功能
    await this.testStorageAPI();
    
    // 测试消息传递
    await this.testMessaging();
    
    // 测试权限检查
    await this.testPermissions();
    
    // 输出测试结果
    this.printResults();
  }

  async testDOIDetection() {
    const testName = 'DOI检测功能';
    console.log(`\n🔍 测试 ${testName}...`);
    
    try {
      // 测试不同DOI格式
      const testCases = [
        {
          input: 'doi:10.1038/nature12373',
          expected: '10.1038/nature12373'
        },
        {
          input: 'https://doi.org/10.1126/science.1234567',
          expected: '10.1126/science.1234567'
        },
        {
          input: '10.1109/ACCESS.2021.1234567',
          expected: '10.1109/ACCESS.2021.1234567'
        }
      ];

      let passed = 0;
      for (const testCase of testCases) {
        const result = this.cleanDOI(testCase.input);
        if (result === testCase.expected) {
          passed++;
          console.log(`  ✅ ${testCase.input} -> ${result}`);
        } else {
          console.log(`  ❌ ${testCase.input} -> ${result} (期望: ${testCase.expected})`);
        }
      }

      const success = passed === testCases.length;
      this.addResult(testName, success, `${passed}/${testCases.length} 测试通过`);

    } catch (error) {
      console.error(`  ❌ ${testName} 测试失败:`, error);
      this.addResult(testName, false, error.message);
    }
  }

  async testStorageAPI() {
    const testName = '存储API功能';
    console.log(`\n💾 测试 ${testName}...`);
    
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // 测试写入
        await chrome.storage.local.set({ 
          testKey: 'testValue',
          testNumber: 12345,
          testObject: { nested: 'value' }
        });
        console.log('  ✅ 存储写入成功');

        // 测试读取
        const result = await chrome.storage.local.get(['testKey', 'testNumber', 'testObject']);
        const isValid = result.testKey === 'testValue' && 
                       result.testNumber === 12345 && 
                       result.testObject.nested === 'value';

        if (isValid) {
          console.log('  ✅ 存储读取成功');
          this.addResult(testName, true, '读写功能正常');
        } else {
          console.log('  ❌ 存储读取数据不匹配');
          this.addResult(testName, false, '读取数据不匹配');
        }

        // 清理测试数据
        await chrome.storage.local.remove(['testKey', 'testNumber', 'testObject']);
        console.log('  ✅ 测试数据清理完成');

      } else {
        console.log('  ⚠️  Chrome Storage API 不可用（可能运行在非扩展环境）');
        this.addResult(testName, false, 'API不可用');
      }
    } catch (error) {
      console.error(`  ❌ ${testName} 测试失败:`, error);
      this.addResult(testName, false, error.message);
    }
  }

  async testMessaging() {
    const testName = '消息传递功能';
    console.log(`\n📡 测试 ${testName}...`);
    
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // 测试运行时消息
        console.log('  📤 发送测试消息...');
        
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: 'ping', timestamp: Date.now() },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            }
          );
        });

        if (response && response.success) {
          console.log('  ✅ 消息传递成功');
          this.addResult(testName, true, '通信正常');
        } else {
          console.log('  ❌ 消息传递失败');
          this.addResult(testName, false, '响应无效');
        }

      } else {
        console.log('  ⚠️  Chrome Runtime API 不可用');
        this.addResult(testName, false, 'API不可用');
      }
    } catch (error) {
      console.error(`  ❌ ${testName} 测试失败:`, error);
      this.addResult(testName, false, error.message);
    }
  }

  async testPermissions() {
    const testName = '权限检查';
    console.log(`\n🔐 测试 ${testName}...`);
    
    try {
      if (typeof chrome !== 'undefined' && chrome.permissions) {
        const requiredPermissions = ['activeTab', 'storage', 'tabs'];
        const permissionResults = [];

        for (const permission of requiredPermissions) {
          const hasPermission = await chrome.permissions.contains({
            permissions: [permission]
          });
          
          permissionResults.push({
            permission,
            granted: hasPermission
          });

          console.log(`  ${hasPermission ? '✅' : '❌'} 权限 "${permission}": ${hasPermission ? '已授权' : '未授权'}`);
        }

        const allGranted = permissionResults.every(r => r.granted);
        this.addResult(testName, allGranted, `${permissionResults.filter(r => r.granted).length}/${requiredPermissions.length} 权限已授权`);

      } else {
        console.log('  ⚠️  Chrome Permissions API 不可用');
        this.addResult(testName, false, 'API不可用');
      }
    } catch (error) {
      console.error(`  ❌ ${testName} 测试失败:`, error);
      this.addResult(testName, false, error.message);
    }
  }

  // 辅助函数：清理DOI
  cleanDOI(doi) {
    if (!doi) return null;
    
    doi = doi.replace(/^(doi:|DOI:|https?:\/\/(?:www\.|dx\.)?doi\.org\/)/i, '');
    doi = doi.replace(/[.,;:)\]}"'>]*$/, '');
    doi = doi.replace(/<[^>]*>/g, '');
    
    return doi.trim();
  }

  addResult(testName, success, message) {
    this.testResults.push({
      name: testName,
      success,
      message,
      timestamp: new Date().toISOString()
    });
  }

  printResults() {
    console.log('\n📊 测试结果汇总：');
    console.log('═'.repeat(50));
    
    const passed = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.message}`);
    });
    
    console.log('═'.repeat(50));
    console.log(`📈 总计: ${passed}/${total} 测试通过 (${Math.round(passed/total*100)}%)`);
    
    if (passed === total) {
      console.log('🎉 所有测试都通过了！扩展功能正常。');
    } else {
      console.log('⚠️  部分测试未通过，请检查扩展配置。');
    }
  }
}

// 运行测试
if (typeof window !== 'undefined') {
  // 在浏览器环境中运行
  console.log('🚀 在浏览器中启动扩展测试...');
  new ExtensionTester();
} else {
  // 在Node.js环境中导出
  module.exports = ExtensionTester;
}

// 添加手动测试指导
console.log('\n📝 手动测试指导：');
console.log('1. 访问 https://www.nature.com/articles/s41467-025-62625-w');
console.log('2. 查看页面右侧是否出现悬浮的"研"字图标');
console.log('3. 点击悬浮图标，确认侧边栏正常打开');
console.log('4. 点击工具栏中的扩展图标，查看弹窗界面');
console.log('5. 测试DOI检测和搜索功能');
console.log('6. 尝试拖拽悬浮图标到不同位置');
console.log('\n🔧 如有问题，请检查：');
console.log('- 扩展是否正确安装和启用');
console.log('- 研学港本地服务器是否运行在 localhost:3000');
console.log('- 浏览器控制台是否有错误信息');