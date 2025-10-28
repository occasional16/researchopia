// welcome.js - 欢迎页面脚本

// 检查服务器连接状态（可选功能，如果页面中有对应元素）
async function checkServerStatus() {
  const serverStatus = document.getElementById('serverStatus');
  
  if (!serverStatus) {
    console.log('⚠️ 服务器状态指示器元素不存在，跳过检查');
    return;
  }
  
  try {
    const response = await fetch('http://localhost:3000', { 
      method: 'HEAD',
      mode: 'no-cors'
    });
    
    serverStatus.textContent = '已连接';
    serverStatus.className = 'status-indicator status-success';
  } catch (error) {
    serverStatus.textContent = '未连接';
    serverStatus.className = 'status-indicator status-warning';
  }
}

// 测试扩展功能
function testExtension(e) {
  e.preventDefault();
  
  // 打开一个测试页面
  const testUrls = [
    'https://doi.org/10.1038/s41467-025-62625-w'
  ];
  
  const randomUrl = testUrls[Math.floor(Math.random() * testUrls.length)];
  window.open(randomUrl, '_blank');
  
  // 显示提示
  alert('已打开测试页面！\n\n请在新打开的学术网页中：\n1. 查看是否出现悬浮的"研"字图标\n2. 点击图标测试侧边栏功能\n3. 点击浏览器工具栏中的扩展图标查看详情');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  // 绑定测试按钮事件
  const testButton = document.getElementById('testExtension');
  if (testButton) {
    testButton.addEventListener('click', testExtension);
  }
  
  // 延迟检查服务器状态
  setTimeout(checkServerStatus, 1000);
});