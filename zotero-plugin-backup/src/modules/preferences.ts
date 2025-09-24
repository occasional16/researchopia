/**
 * Researchopia 偏好设置管理器
 */

export class PreferencesManager {
  
  /**
   * 初始化偏好设置面板
   */
  static init(): void {
    try {
      ztoolkit.log('🔧 Initializing preferences panel');

      // 设置默认值
      PreferencesManager.setDefaultPreferences();

      // 更新UI状态
      PreferencesManager.updateLoginStatus();

      // 绑定事件监听器
      PreferencesManager.bindEventListeners();

      ztoolkit.log('✅ Preferences initialization completed');
    } catch (error) {
      ztoolkit.log(`❌ Preferences initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * 设置默认偏好设置
   */
  private static setDefaultPreferences(): void {
    const defaults = {
      'autoSync': true,
      'realtimeUpdates': true,
      'syncOnStartup': true,
      'showSharedAnnotations': true,
      'showPrivateAnnotations': true,
      'maxAnnotations': 50,
      'requestTimeout': 30,
      'debugMode': false
    };

    for (const [key, value] of Object.entries(defaults)) {
      const prefKey = `extensions.zotero.researchopia.${key}`;
      if (!Zotero.Prefs.get(prefKey, true)) {
        Zotero.Prefs.set(prefKey, value, true);
      }
    }
  }

  /**
   * 更新登录状态显示
   */
  private static updateLoginStatus(): void {
    try {
      // 使用window.document而不是直接使用document
      const doc = ztoolkit.getGlobal('document') || window.document;
      if (!doc) {
        ztoolkit.log('❌ Document not available for login status update');
        return;
      }

      const statusLabel = doc.getElementById('researchopia-login-status');
      const userNameLabel = doc.getElementById('researchopia-user-name');
      const userEmailLabel = doc.getElementById('researchopia-user-email');
      const loginForm = doc.getElementById('researchopia-login-form');
      const loggedInActions = doc.getElementById('researchopia-logged-in-actions');

      // 检查是否已登录（这里需要实际的认证逻辑）
      const isLoggedIn = false; // TODO: 实现实际的登录状态检查
      
      if (isLoggedIn) {
        if (statusLabel) statusLabel.textContent = '已登录';
        if (userNameLabel) userNameLabel.textContent = 'Test User'; // TODO: 获取实际用户名
        if (userEmailLabel) userEmailLabel.textContent = 'test@example.com'; // TODO: 获取实际邮箱
        if (loginForm) loginForm.style.display = 'none';
        if (loggedInActions) loggedInActions.style.display = 'block';
      } else {
        if (statusLabel) statusLabel.textContent = '未登录';
        if (userNameLabel) userNameLabel.textContent = '--';
        if (userEmailLabel) userEmailLabel.textContent = '--';
        if (loginForm) loginForm.style.display = 'block';
        if (loggedInActions) loggedInActions.style.display = 'none';
      }
    } catch (error) {
      ztoolkit.log(`❌ Failed to update login status: ${(error as Error).message}`);
    }
  }

  /**
   * 绑定事件监听器
   */
  private static bindEventListeners(): void {
    try {
      // 等待DOM完全加载，使用重试机制
      const bindEvents = () => {
        const doc = ztoolkit.getGlobal('document') || window.document;
        if (!doc) {
          ztoolkit.log('❌ Document not available for event binding');
          return;
        }

        // 登录按钮 - 使用onclick而不是addEventListener
        const loginBtn = doc.getElementById('researchopia-login-btn') as HTMLButtonElement;
        if (loginBtn) {
          loginBtn.onclick = () => {
            ztoolkit.log('🔘 Login button clicked');
            PreferencesManager.handleLogin();
          };
          ztoolkit.log('✅ Login button bound');
        } else {
          ztoolkit.log('❌ Login button not found');
        }

        // 清空按钮
        const clearBtn = doc.getElementById('researchopia-clear-btn') as HTMLButtonElement;
        if (clearBtn) {
          clearBtn.onclick = () => PreferencesManager.handleClear();
          ztoolkit.log('✅ Clear button bound');
        }

        // 退出登录按钮
        const logoutBtn = doc.getElementById('researchopia-logout-btn') as HTMLButtonElement;
        if (logoutBtn) {
          logoutBtn.onclick = () => PreferencesManager.handleLogout();
          ztoolkit.log('✅ Logout button bound');
        }

        // 重置设置按钮
        const resetBtn = doc.getElementById('researchopia-reset-btn') as HTMLButtonElement;
        if (resetBtn) {
          resetBtn.onclick = () => PreferencesManager.handleReset();
          ztoolkit.log('✅ Reset button bound');
        }

        // 测试连接按钮
        const testBtn = doc.getElementById('researchopia-test-btn') as HTMLButtonElement;
        if (testBtn) {
          testBtn.onclick = () => PreferencesManager.handleTestConnection();
          ztoolkit.log('✅ Test button bound');
        }

        // 绑定回车键登录
        const emailInput = doc.getElementById('researchopia-email-input') as HTMLInputElement;
        const passwordInput = doc.getElementById('researchopia-password-input') as HTMLInputElement;

        if (emailInput) {
          emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              passwordInput?.focus();
            }
          });
        }

        if (passwordInput) {
          passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              PreferencesManager.handleLogin();
            }
          });
        }
      };

      // 立即尝试绑定，如果失败则延迟重试
      bindEvents();
      setTimeout(bindEvents, 500);
      setTimeout(bindEvents, 1000);
      setTimeout(bindEvents, 2000);
      setTimeout(bindEvents, 3000);

      ztoolkit.log('✅ Event listeners bound successfully');
    } catch (error) {
      ztoolkit.log(`❌ Failed to bind event listeners: ${(error as Error).message}`);
    }
  }

  /**
   * 处理登录
   */
  private static async handleLogin(): Promise<void> {
    try {
      ztoolkit.log('🔐 Starting login process...');
      const doc = ztoolkit.getGlobal('document') || window.document;
      const emailInput = doc.getElementById('researchopia-email-input') as HTMLInputElement;
      const passwordInput = doc.getElementById('researchopia-password-input') as HTMLInputElement;
      const messageLabel = doc.getElementById('researchopia-login-message');

      ztoolkit.log(`📧 Email input found: ${!!emailInput}`);
      ztoolkit.log(`🔑 Password input found: ${!!passwordInput}`);
      ztoolkit.log(`💬 Message label found: ${!!messageLabel}`);

      if (!emailInput || !passwordInput) {
        throw new Error('Login form elements not found');
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      if (!email || !password) {
        if (messageLabel) messageLabel.textContent = '请输入邮箱和密码';
        return;
      }

      if (messageLabel) messageLabel.textContent = '登录中...';

      // TODO: 实现实际的登录逻辑
      // const success = await addon.api.supabase.login(email, password);
      
      // 模拟登录成功
      await new Promise(resolve => setTimeout(resolve, 1000));
      const success = true; // 暂时设为true，模拟登录成功

      if (success) {
        if (messageLabel) messageLabel.textContent = '登录成功';
        PreferencesManager.updateLoginStatus();
      } else {
        if (messageLabel) messageLabel.textContent = '登录失败，请检查邮箱和密码';
      }

    } catch (error) {
      ztoolkit.log(`❌ Login failed: ${(error as Error).message}`);
      const doc = ztoolkit.getGlobal('document') || window.document;
      const messageLabel = doc.getElementById('researchopia-login-message');
      if (messageLabel) messageLabel.textContent = `登录失败: ${(error as Error).message}`;
    }
  }

  /**
   * 处理清空表单
   */
  private static handleClear(): void {
    const emailInput = document.getElementById('researchopia-email-input') as HTMLInputElement;
    const passwordInput = document.getElementById('researchopia-password-input') as HTMLInputElement;
    const messageLabel = document.getElementById('researchopia-login-message');

    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (messageLabel) messageLabel.textContent = '';
  }

  /**
   * 处理退出登录
   */
  private static async handleLogout(): Promise<void> {
    try {
      // TODO: 实现实际的退出登录逻辑
      // await addon.api.supabase.logout();
      
      PreferencesManager.updateLoginStatus();
      ztoolkit.log('✅ Logged out successfully');
    } catch (error) {
      ztoolkit.log(`❌ Logout failed: ${(error as Error).message}`);
    }
  }

  /**
   * 处理重置设置
   */
  private static handleReset(): void {
    try {
      const confirmed = confirm('确定要重置所有设置吗？这将清除所有自定义配置。');
      if (!confirmed) return;

      // 清除所有偏好设置
      const prefKeys = [
        'autoSync', 'realtimeUpdates', 'syncOnStartup',
        'showSharedAnnotations', 'showPrivateAnnotations', 'maxAnnotations',
        'requestTimeout', 'debugMode'
      ];

      for (const key of prefKeys) {
        Zotero.Prefs.clear(`extensions.zotero.researchopia.${key}`, true);
      }

      // 重新设置默认值
      PreferencesManager.setDefaultPreferences();

      alert('设置已重置为默认值');
      ztoolkit.log('✅ Settings reset successfully');
    } catch (error) {
      ztoolkit.log(`❌ Reset failed: ${(error as Error).message}`);
      alert(`重置失败: ${(error as Error).message}`);
    }
  }

  /**
   * 处理测试连接
   */
  private static async handleTestConnection(): Promise<void> {
    try {
      // TODO: 实现实际的连接测试
      // const success = await addon.api.supabase.testConnection();
      
      // 模拟测试
      await new Promise(resolve => setTimeout(resolve, 1000));
      const success = true; // 暂时设为true

      if (success) {
        alert('连接测试成功！');
      } else {
        alert('连接测试失败，请检查网络和配置。');
      }
    } catch (error) {
      ztoolkit.log(`❌ Connection test failed: ${(error as Error).message}`);
      alert(`连接测试失败: ${(error as Error).message}`);
    }
  }
}

// 全局暴露给偏好设置面板使用
(globalThis as any).ResearchopiaPreferences = PreferencesManager;
