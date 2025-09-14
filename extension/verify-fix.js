// 研学港扩展修复验证脚本
// 在浏览器控制台中运行此脚本来验证修复是否成功

console.log('🔍 研学港扩展修复验证开始...');

// 1. 检查扩展是否加载
if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('✅ Chrome扩展API可用');
} else {
    console.log('❌ Chrome扩展API不可用');
}

// 2. 检查content script是否正确加载
if (typeof ResearchopiaContentScript !== 'undefined') {
    console.log('✅ 研学港Content Script已加载');
    
    // 3. 检查浮动图标是否存在
    const floatingIcon = document.getElementById('researchopia-floating-icon');
    if (floatingIcon) {
        console.log('✅ 浮动图标元素已创建');
        console.log('📍 图标位置:', floatingIcon.style.bottom, floatingIcon.style.right);
        console.log('👁️ 图标可见性:', floatingIcon.style.display);
        
        // 4. 测试点击事件
        console.log('🧪 模拟点击浮动图标...');
        const testClick = new MouseEvent('click', {
            bubbles: true,
            cancelable: true
        });
        
        // 模拟点击并记录结果
        const clickHandled = floatingIcon.dispatchEvent(testClick);
        console.log('📝 点击事件处理结果:', clickHandled);
        
        // 等待2秒查看徽章状态
        setTimeout(() => {
            chrome.action.getBadgeText({}, (text) => {
                if (text) {
                    console.log('✅ 扩展徽章文本:', text);
                    if (text === '✅') {
                        console.log('🎉 完美！侧边栏应该已自动打开');
                    } else if (text === 'DOI') {
                        console.log('⚠️ 侧边栏未自动打开，但功能正常，请手动点击扩展图标');
                    }
                } else {
                    console.log('❌ 扩展徽章无文本，可能存在问题');
                }
            });
        }, 2000);
        
    } else {
        console.log('❌ 浮动图标元素未找到');
    }
    
} else {
    console.log('❌ 研学港Content Script未加载');
}

// 5. 检查DOI检测功能
console.log('🔍 检查DOI检测功能...');
if (typeof ResearchopiaContentScript !== 'undefined') {
    const contentScript = window.researchopiaInstance;
    if (contentScript) {
        const testDOI = contentScript.detectDOI();
        if (testDOI) {
            console.log('✅ 检测到DOI:', testDOI);
        } else {
            console.log('ℹ️ 当前页面未检测到DOI（这是正常的，取决于页面内容）');
        }
    }
}

console.log('🏁 验证脚本执行完成');
console.log('💡 请观察2秒后的徽章状态信息');

// 辅助函数：手动触发DOI检测
window.testDOIDetection = function() {
    if (window.researchopiaInstance) {
        const doi = window.researchopiaInstance.detectDOI();
        console.log('🔍 手动DOI检测结果:', doi);
        return doi;
    }
    return null;
};

// 辅助函数：手动触发浮动图标点击
window.testFloatingIconClick = function() {
    const icon = document.getElementById('researchopia-floating-icon');
    if (icon) {
        icon.click();
        console.log('🖱️ 已手动点击浮动图标');
    } else {
        console.log('❌ 浮动图标不存在');
    }
};

console.log('🛠️ 调试函数已加载:');
console.log('  - testDOIDetection(): 手动测试DOI检测');
console.log('  - testFloatingIconClick(): 手动测试浮动图标点击');