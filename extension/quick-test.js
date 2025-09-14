// 简化测试脚本 - 专门测试侧边栏打开功能
// 在浏览器控制台运行此脚本

console.log('🔧 开始简化测试...');

// 测试1: 直接测试浮动图标点击
function testDirectIconClick() {
  console.log('🖱️ 测试1: 直接点击浮动图标');
  
  const icon = document.getElementById('researchopia-floating-icon');
  if (!icon) {
    console.log('❌ 浮动图标不存在');
    return false;
  }
  
  console.log('✅ 找到浮动图标，模拟点击...');
  
  // 模拟真实的鼠标点击
  const rect = icon.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // 创建完整的点击序列
  const mouseDown = new MouseEvent('mousedown', {
    button: 0,
    buttons: 1,
    clientX: centerX,
    clientY: centerY,
    bubbles: true,
    cancelable: true
  });
  
  const mouseUp = new MouseEvent('mouseup', {
    button: 0,
    buttons: 0,
    clientX: centerX,
    clientY: centerY,
    bubbles: true,
    cancelable: true
  });
  
  const click = new MouseEvent('click', {
    button: 0,
    clientX: centerX,
    clientY: centerY,
    bubbles: true,
    cancelable: true
  });
  
  // 执行点击序列
  icon.dispatchEvent(mouseDown);
  setTimeout(() => {
    icon.dispatchEvent(mouseUp);
    icon.dispatchEvent(click);
    console.log('🖱️ 点击序列已完成');
  }, 50);
  
  return true;
}

// 测试2: 直接调用openSidebar方法
async function testDirectOpenSidebar() {
  console.log('📞 测试2: 直接调用openSidebar方法');
  
  if (window.researchopiaContentScript && window.researchopiaContentScript.openSidebar) {
    try {
      const result = await window.researchopiaContentScript.openSidebar();
      console.log('✅ 直接调用结果:', result);
      return result;
    } catch (error) {
      console.log('❌ 直接调用失败:', error);
      return false;
    }
  } else {
    console.log('❌ 无法访问内容脚本');
    return false;
  }
}

// 测试3: 发送消息到background
async function testMessageToBackground() {
  console.log('📨 测试3: 发送消息到background');
  
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'openSidebar' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('✅ Background响应:', response);
    return response && response.success;
  } catch (error) {
    console.log('❌ 消息发送失败:', error.message);
    return false;
  }
}

// 测试4: 检查扩展基本状态
async function testExtensionBasics() {
  console.log('🔍 测试4: 检查扩展基本状态');
  
  const results = {};
  
  // 检查content script
  results.contentScript = !!window.researchopiaContentScript;
  console.log('- Content Script:', results.contentScript ? '✅' : '❌');
  
  // 检查浮动图标
  results.floatingIcon = !!document.getElementById('researchopia-floating-icon');
  console.log('- 浮动图标:', results.floatingIcon ? '✅' : '❌');
  
  // 检查DOI检测
  if (window.researchopiaContentScript) {
    results.doi = window.researchopiaContentScript.detectedDOI || 'none';
    console.log('- DOI检测:', results.doi !== 'none' ? '✅ ' + results.doi : '⚠️ 无DOI');
  }
  
  // 检查chrome APIs
  results.sidePanel = !!chrome.sidePanel;
  results.runtime = !!chrome.runtime;
  results.storage = !!chrome.storage;
  results.tabs = !!chrome.tabs;
  
  console.log('- SidePanel API:', results.sidePanel ? '✅' : '❌');
  console.log('- Runtime API:', results.runtime ? '✅' : '❌');
  console.log('- Storage API:', results.storage ? '✅' : '❌');
  console.log('- Tabs API:', results.tabs ? '✅' : '❌');
  
  return results;
}

// 运行所有测试
async function runQuickTests() {
  console.log('🚀 运行快速测试...\n');
  
  // 先检查基本状态
  console.log('=== 基本状态检查 ===');
  const basics = await testExtensionBasics();
  
  console.log('\n=== 功能测试 ===');
  
  // 测试消息发送
  console.log('1️⃣ 测试消息到background');
  const messageResult = await testMessageToBackground();
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 测试直接调用
  console.log('\n2️⃣ 测试直接方法调用');
  const directResult = await testDirectOpenSidebar();
  
  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 测试点击
  console.log('\n3️⃣ 测试图标点击');
  const clickResult = testDirectIconClick();
  
  console.log('\n=== 测试结果汇总 ===');
  console.log('- 消息发送:', messageResult ? '✅' : '❌');
  console.log('- 直接调用:', directResult ? '✅' : '❌');
  console.log('- 图标点击:', clickResult ? '✅' : '❌');
  
  const successful = [messageResult, directResult, clickResult].filter(Boolean).length;
  console.log(`\n🎯 成功率: ${successful}/3`);
  
  if (successful === 0) {
    console.log('⚠️ 所有测试都失败，可能需要检查扩展权限或重新加载扩展');
  } else if (successful < 3) {
    console.log('⚠️ 部分测试失败，建议手动点击工具栏图标');
  } else {
    console.log('🎉 所有测试成功！');
  }
  
  return { messageResult, directResult, clickResult, basics };
}

// 导出函数
window.quickTest = {
  runQuickTests,
  testDirectIconClick,
  testDirectOpenSidebar,
  testMessageToBackground,
  testExtensionBasics
};

// 自动运行
runQuickTests().catch(console.error);

console.log('💡 快速测试函数已导出到 window.quickTest');