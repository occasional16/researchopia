/// <reference types="chrome" />
/**
 * Welcome Page Script for Researchopia Extension
 */

// Check server connection status
async function checkServerStatus(): Promise<void> {
  const serverStatus = document.getElementById('serverStatus');
  
  if (!serverStatus) {
    console.log('⚠️ 服务器状态指示器元素不存在，跳过检查');
    return;
  }
  
  try {
    await fetch('http://localhost:3000', { 
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

// Test extension functionality
function testExtension(e: Event): void {
  e.preventDefault();
  
  const testUrls = [
    'https://doi.org/10.1038/s41467-025-62625-w'
  ];
  
  const randomUrl = testUrls[Math.floor(Math.random() * testUrls.length)];
  window.open(randomUrl, '_blank');
  
  alert('已打开测试页面！\n\n请在新打开的学术网页中：\n1. 查看是否出现悬浮的"研"字图标\n2. 点击图标测试侧边栏功能\n3. 点击浏览器工具栏中的扩展图标查看详情');
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Display version from manifest
  const versionText = document.getElementById('versionText');
  if (versionText) {
    const manifest = chrome.runtime.getManifest();
    versionText.textContent = `v${manifest.version}`;
  }

  // Bind test button event
  const testButton = document.getElementById('testExtension');
  if (testButton) {
    testButton.addEventListener('click', testExtension);
  }
  
  // Delayed server status check
  setTimeout(() => {
    checkServerStatus();
  }, 500);
});
