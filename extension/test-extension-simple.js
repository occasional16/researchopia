// 简单测试脚本 - 验证扩展功能
// 可以在控制台运行此脚本来测试扩展功能

console.log('🧪 开始测试研学港扩展功能...');

// 测试1: 检查DOI检测
function testDOIDetection() {
  console.log('📄 测试DOI检测...');
  
  // 模拟DOI数据
  const testDOI = '10.1038/s41467-025-62625-w';
  
  // 检查是否能检测到DOI
  if (window.researchopiaContentScript) {
    const detectedDOI = window.researchopiaContentScript.detectDOI();
    console.log('检测到的DOI:', detectedDOI);
    
    if (detectedDOI) {
      console.log('✅ DOI检测功能正常');
    } else {
      console.log('❌ 未检测到DOI（这在非学术页面是正常的）');
    }
  } else {
    console.log('❌ Content Script未加载');
  }
}

// 测试2: 检查浮动图标
function testFloatingIcon() {
  console.log('🎯 测试浮动图标...');
  
  const icon = document.getElementById('researchopia-floating-icon');
  if (icon) {
    console.log('✅ 浮动图标已创建');
    console.log('图标位置:', icon.style.left, icon.style.top);
    console.log('图标可见性:', icon.style.display !== 'none');
  } else {
    console.log('❌ 浮动图标未找到');
  }
}

// 测试3: 检查扩展连接
async function testExtensionConnection() {
  console.log('🔗 测试扩展连接...');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'log',
      message: '测试连接',
      timestamp: Date.now()
    });
    
    if (response && response.success) {
      console.log('✅ 扩展连接正常');
    } else {
      console.log('❌ 扩展连接异常:', response);
    }
  } catch (error) {
    console.log('❌ 扩展连接失败:', error.message);
  }
}

// 测试4: 检查storage
async function testStorage() {
  console.log('💾 测试Storage...');
  
  try {
    // 设置测试数据
    await chrome.storage.sync.set({
      testData: 'Hello from test',
      timestamp: Date.now()
    });
    
    // 读取测试数据
    const result = await chrome.storage.sync.get(['testData', 'timestamp']);
    
    if (result.testData) {
      console.log('✅ Storage功能正常:', result);
      
      // 清理测试数据
      await chrome.storage.sync.remove(['testData', 'timestamp']);
    } else {
      console.log('❌ Storage功能异常');
    }
  } catch (error) {
    console.log('❌ Storage测试失败:', error.message);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始运行所有测试...\n');
  
  await testExtensionConnection();
  console.log('---');
  
  await testStorage();
  console.log('---');
  
  testDOIDetection();
  console.log('---');
  
  testFloatingIcon();
  console.log('---');
  
  console.log('🧪 测试完成！');
  console.log('💡 提示: 如果浮动图标未显示，请访问学术网站（如 nature.com）进行测试');
}

// 自动运行测试
runAllTests();