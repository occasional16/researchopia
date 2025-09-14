// 快速验证消息路由修复的脚本
// 在浏览器控制台中运行

console.log('🔧 验证消息路由修复...');

// 模拟发送 openSidePanel 消息
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.sendMessage({
    action: 'openSidePanel',
    doi: '10.1234/test.doi',
    url: window.location.href
  }).then(response => {
    console.log('✅ openSidePanel 消息测试结果:', response);
    if (response.success) {
      console.log('🎉 消息路由修复成功！');
    } else {
      console.log('⚠️ 响应包含错误:', response.error);
    }
  }).catch(error => {
    console.log('❌ 消息发送失败:', error);
  });
} else {
  console.log('❌ Chrome扩展API不可用');
}

// 也测试 floatingIconClicked 消息
setTimeout(() => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({
      action: 'floatingIconClicked',
      doi: '10.1234/test.doi2',
      url: window.location.href
    }).then(response => {
      console.log('✅ floatingIconClicked 消息测试结果:', response);
    }).catch(error => {
      console.log('❌ floatingIconClicked 消息失败:', error);
    });
  }
}, 1000);

console.log('🔍 消息路由测试已发送，请查看上方结果...');