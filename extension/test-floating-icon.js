// 测试脚本 - 验证浮动图标侧边栏功能
// 在浏览器控制台运行此脚本来测试功能

console.log('🧪 开始测试浮动图标侧边栏功能...');

// 测试1: 检查是否存在浮动图标
function testFloatingIconExists() {
  const icon = document.getElementById('researchopia-floating-icon');
  if (icon) {
    console.log('✅ 测试1通过: 浮动图标存在');
    return true;
  } else {
    console.log('❌ 测试1失败: 未找到浮动图标');
    return false;
  }
}

// 测试2: 模拟点击浮动图标
async function testFloatingIconClick() {
  const icon = document.getElementById('researchopia-floating-icon');
  if (!icon) {
    console.log('❌ 测试2跳过: 浮动图标不存在');
    return false;
  }

  console.log('🖱️ 模拟点击浮动图标...');
  
  // 添加临时消息监听器来捕获响应
  const messageListener = (event) => {
    console.log('📨 收到消息事件:', event);
  };
  
  window.addEventListener('message', messageListener, { once: true });
  
  // 模拟点击
  const clickEvent = new MouseEvent('mousedown', {
    button: 0,
    clientX: 100,
    clientY: 100
  });
  
  icon.dispatchEvent(clickEvent);
  
  // 立即触发mouseup
  setTimeout(() => {
    const upEvent = new MouseEvent('mouseup', {
      button: 0,
      clientX: 100,
      clientY: 100
    });
    icon.dispatchEvent(upEvent);
    console.log('🖱️ 模拟点击完成');
  }, 50);
  
  return true;
}

// 测试3: 检查DOI检测
function testDOIDetection() {
  if (window.researchopiaContentScript) {
    const doi = window.researchopiaContentScript.detectedDOI;
    if (doi) {
      console.log('✅ 测试3通过: 检测到DOI:', doi);
      return doi;
    } else {
      console.log('⚠️ 测试3: 未检测到DOI（可能不是学术页面）');
      return null;
    }
  } else {
    console.log('❌ 测试3失败: 内容脚本未初始化');
    return false;
  }
}

// 测试4: 检查扩展是否正常运行
async function testExtensionStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getSettings'
    });
    
    if (response && response.success) {
      console.log('✅ 测试4通过: 扩展正常运行');
      console.log('📋 当前设置:', response.settings);
      return true;
    } else {
      console.log('❌ 测试4失败: 扩展响应异常');
      return false;
    }
  } catch (error) {
    console.log('❌ 测试4失败: 无法连接到扩展:', error.message);
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始运行所有测试...\n');
  
  const results = {
    iconExists: testFloatingIconExists(),
    doiDetection: testDOIDetection(),
    extensionStatus: await testExtensionStatus(),
    iconClick: await testFloatingIconClick()
  };
  
  console.log('\n📊 测试结果汇总:');
  console.log('- 浮动图标存在:', results.iconExists ? '✅' : '❌');
  console.log('- DOI检测:', results.doiDetection ? '✅ ' + results.doiDetection : (results.doiDetection === null ? '⚠️ 无DOI' : '❌'));
  console.log('- 扩展状态:', results.extensionStatus ? '✅' : '❌');
  console.log('- 图标点击:', results.iconClick ? '✅' : '❌');
  
  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\n🎯 总体结果: ${passCount}/${totalCount} 测试通过`);
  
  if (passCount === totalCount) {
    console.log('🎉 所有测试通过！浮动图标功能应该正常工作。');
  } else {
    console.log('⚠️ 存在问题，请检查失败的测试项。');
  }
  
  return results;
}

// 自动运行测试
runAllTests().catch(error => {
  console.error('❌ 测试运行失败:', error);
});

// 导出测试函数供手动调用
window.researchopiaTest = {
  runAllTests,
  testFloatingIconExists,
  testFloatingIconClick,
  testDOIDetection,
  testExtensionStatus
};

console.log('💡 测试函数已导出到 window.researchopiaTest，可手动调用特定测试。');