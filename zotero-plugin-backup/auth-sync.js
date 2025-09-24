/**
 * 研学港Zotero插件认证同步脚本
 * 
 * 使用方法：
 * 1. 在 researchopia.com 登录成功后
 * 2. 按F12打开开发者工具
 * 3. 在Console中粘贴并运行此脚本
 * 4. 脚本会自动将认证信息同步到Zotero插件
 */

(function() {
    'use strict';
    
    console.log('🔐 研学港Zotero插件认证同步脚本');
    console.log('正在检查认证状态...');
    
    // 检查是否已登录
    const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
    const userInfo = localStorage.getItem('user') || localStorage.getItem('user_info') || localStorage.getItem('profile');
    
    if (!authToken) {
        console.error('❌ 未找到认证Token，请确保已登录');
        alert('未找到认证Token，请确保已登录研学港');
        return;
    }
    
    console.log('✅ 找到认证Token:', authToken.substring(0, 20) + '...');
    
    // 解析用户信息
    let user = null;
    if (userInfo) {
        try {
            user = JSON.parse(userInfo);
            console.log('✅ 找到用户信息:', user.name || user.username || '未知用户');
        } catch (e) {
            console.warn('⚠️ 用户信息解析失败，将使用默认信息');
        }
    }
    
    // 如果没有用户信息，尝试从API获取
    if (!user) {
        console.log('🔍 正在从API获取用户信息...');
        
        fetch('/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data && data.id) {
                user = data;
                console.log('✅ 从API获取用户信息成功:', user.name || user.username || '未知用户');
                syncToZotero();
            } else {
                console.warn('⚠️ API返回的用户信息无效，使用默认信息');
                user = { id: 'unknown', name: '研学港用户', email: '' };
                syncToZotero();
            }
        })
        .catch(error => {
            console.warn('⚠️ 获取用户信息失败:', error.message);
            user = { id: 'unknown', name: '研学港用户', email: '' };
            syncToZotero();
        });
    } else {
        syncToZotero();
    }
    
    function syncToZotero() {
        console.log('🔄 正在同步认证信息到Zotero...');
        
        // 方法1: 写入临时文件（需要浏览器支持文件系统访问）
        try {
            const authData = {
                user: {
                    id: user.id || 'unknown',
                    name: user.name || user.username || '研学港用户',
                    email: user.email || ''
                },
                token: authToken,
                timestamp: new Date().toISOString(),
                source: 'web_sync_script'
            };
            
            // 创建下载链接，让用户保存认证文件
            const blob = new Blob([JSON.stringify(authData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'researchopia_auth.json';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('✅ 认证文件已生成并下载');
            console.log('📁 请将下载的 researchopia_auth.json 文件放到以下位置：');
            console.log('   Windows: %TEMP%\\researchopia_auth.json');
            console.log('   macOS: /tmp/researchopia_auth.json');
            console.log('   Linux: /tmp/researchopia_auth.json');
            
            alert('✅ 认证信息同步成功！\n\n' +
                  '认证文件已下载，请按以下步骤操作：\n' +
                  '1. 将下载的 researchopia_auth.json 文件\n' +
                  '2. 复制到系统临时目录（Windows: %TEMP%）\n' +
                  '3. 返回Zotero，插件将自动检测认证状态\n\n' +
                  '或者，您也可以选择"手动输入Token"方式，\n' +
                  '直接复制以下Token到插件中：\n\n' +
                  authToken);
            
        } catch (error) {
            console.error('❌ 文件同步失败:', error.message);
            
            // 备用方法：显示Token供用户手动复制
            console.log('🔄 使用备用方法：手动复制Token');
            console.log('📋 请复制以下Token到Zotero插件中：');
            console.log(authToken);
            
            // 复制到剪贴板
            if (navigator.clipboard) {
                navigator.clipboard.writeText(authToken).then(() => {
                    console.log('✅ Token已复制到剪贴板');
                    alert('✅ 认证Token已复制到剪贴板！\n\n' +
                          '请返回Zotero，选择"手动输入Token"方式，\n' +
                          '然后粘贴Token完成登录。\n\n' +
                          'Token: ' + authToken.substring(0, 50) + '...');
                }).catch(() => {
                    showTokenDialog();
                });
            } else {
                showTokenDialog();
            }
        }
    }
    
    function showTokenDialog() {
        const tokenDialog = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 20px; border: 2px solid #007acc; border-radius: 8px; 
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; max-width: 500px;">
                <h3 style="margin: 0 0 15px 0; color: #007acc;">🔐 研学港认证Token</h3>
                <p style="margin: 0 0 10px 0;">请复制以下Token到Zotero插件中：</p>
                <textarea readonly style="width: 100%; height: 100px; font-family: monospace; font-size: 12px; 
                                        border: 1px solid #ccc; padding: 8px; resize: none;">${authToken}</textarea>
                <div style="margin-top: 15px; text-align: right;">
                    <button onclick="this.parentElement.parentElement.remove()" 
                            style="padding: 8px 16px; background: #007acc; color: white; border: none; 
                                   border-radius: 4px; cursor: pointer;">关闭</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', tokenDialog);
    }
    
})();

console.log('🎉 认证同步脚本加载完成！');
