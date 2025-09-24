/**
 * Researchopia 偏好设置脚本
 * 基于备份代码的成功实现，使用纯JavaScript
 */

// 全局偏好设置对象
var ResearchopiaPreferences = {
  /**
   * 初始化偏好设置
   */
  init() {
    try {
      Zotero.debug('ResearchopiaPreferences: Initializing...');
      
      // 设置默认值
      this.setDefaultPreferences();
      
      // 更新UI状态
      this.updateLoginStatus();
      
      // 绑定事件
      this.bindButtonEvents();
      
      Zotero.debug('ResearchopiaPreferences: Initialization completed');
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Initialization failed: ' + error.message);
    }
  },

  /**
   * 设置默认偏好设置
   */
  setDefaultPreferences() {
    const defaults = {
      'extensions.researchopia.isLoggedIn': false,
      'extensions.researchopia.userEmail': '',
      'extensions.researchopia.supabaseUrl': 'https://obcblvdtqhwrihoddlez.supabase.co',
      'extensions.researchopia.enable': true,
      'extensions.researchopia.autoShare': false,
      'extensions.researchopia.notifications': true
    };

    for (const [key, value] of Object.entries(defaults)) {
      if (!Zotero.Prefs.get(key, null)) {
        Zotero.Prefs.set(key, value);
      }
    }
  },

  /**
   * 更新登录状态显示
   */
  updateLoginStatus() {
    try {
      const statusLabel = document.getElementById('researchopia-login-status');
      const isLoggedIn = Zotero.Prefs.get('extensions.researchopia.isLoggedIn', false);
      const userEmail = Zotero.Prefs.get('extensions.researchopia.userEmail', '');

      if (statusLabel) {
        if (isLoggedIn && userEmail) {
          statusLabel.textContent = `已登录 (${userEmail})`;
          statusLabel.style.color = 'green';
        } else {
          statusLabel.textContent = '未登录';
          statusLabel.style.color = 'red';
        }
      }
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to update login status: ' + error.message);
    }
  },

  /**
   * 绑定按钮事件
   */
  bindButtonEvents() {
    try {
      // 等待DOM完全加载
      const bindEvents = () => {
        const loginBtn = document.getElementById('researchopia-login-btn');
        const clearBtn = document.getElementById('researchopia-clear-btn');

        if (loginBtn) {
          loginBtn.onclick = () => this.performLogin();
          Zotero.debug('ResearchopiaPreferences: Login button bound');
        } else {
          Zotero.debug('ResearchopiaPreferences: Login button not found');
        }

        if (clearBtn) {
          clearBtn.onclick = () => this.clearLoginForm();
          Zotero.debug('ResearchopiaPreferences: Clear button bound');
        }

        // 绑定回车键登录
        const emailInput = document.getElementById('researchopia-email-input');
        const passwordInput = document.getElementById('researchopia-password-input');

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
              this.performLogin();
            }
          });
        }
      };

      // 立即尝试绑定，如果失败则延迟重试
      bindEvents();
      setTimeout(bindEvents, 100);
      setTimeout(bindEvents, 500);
      setTimeout(bindEvents, 1000);

      Zotero.debug('ResearchopiaPreferences: Button events binding scheduled');
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to bind button events: ' + error.message);
    }
  },

  /**
   * 执行登录
   */
  async performLogin() {
    try {
      Zotero.debug('ResearchopiaPreferences: Starting login...');
      
      const emailInput = document.getElementById('researchopia-email-input');
      const passwordInput = document.getElementById('researchopia-password-input');
      const messageLabel = document.getElementById('researchopia-login-message');

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

      // 模拟登录过程
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 这里应该调用实际的Supabase认证
      const success = true; // 暂时模拟成功

      if (success) {
        if (messageLabel) messageLabel.textContent = '登录成功';
        
        // 保存登录状态
        Zotero.Prefs.set('extensions.researchopia.isLoggedIn', true);
        Zotero.Prefs.set('extensions.researchopia.userEmail', email);
        
        // 更新UI状态
        this.updateLoginStatus();
        
        Zotero.debug('ResearchopiaPreferences: Login successful');
      } else {
        if (messageLabel) messageLabel.textContent = '登录失败，请检查邮箱和密码';
      }

    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Login failed: ' + error.message);
      const messageLabel = document.getElementById('researchopia-login-message');
      if (messageLabel) messageLabel.textContent = '登录失败：' + error.message;
    }
  },

  /**
   * 清空登录表单
   */
  clearLoginForm() {
    const emailInput = document.getElementById('researchopia-email-input');
    const passwordInput = document.getElementById('researchopia-password-input');
    const messageLabel = document.getElementById('researchopia-login-message');

    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (messageLabel) messageLabel.textContent = '';

    Zotero.debug('ResearchopiaPreferences: Login form cleared');
  }
};

// 当DOM加载完成时初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ResearchopiaPreferences.init();
  });
} else {
  ResearchopiaPreferences.init();
}
