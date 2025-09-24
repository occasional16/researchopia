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
      const userNameLabel = document.getElementById('researchopia-user-name');
      const userEmailLabel = document.getElementById('researchopia-user-email');
      const loginForm = document.getElementById('researchopia-login-form');
      const loggedInActions = document.getElementById('researchopia-logged-in-actions');

      // 使用新的认证管理器检查状态
      const addon = Zotero.Researchopia;
      let isLoggedIn = false;
      let user = null;

      if (addon && addon.auth) {
        isLoggedIn = addon.auth.isAuthenticated();
        user = addon.auth.getCurrentUser();
      }

      if (statusLabel) {
        if (isLoggedIn && user) {
          statusLabel.textContent = '已登录';
          statusLabel.style.color = 'green';

          if (userNameLabel) userNameLabel.textContent = user.displayName || user.username || '用户';
          if (userEmailLabel) userEmailLabel.textContent = user.email || '';

          if (loginForm) loginForm.style.display = 'none';
          if (loggedInActions) loggedInActions.style.display = 'block';
        } else {
          statusLabel.textContent = '未登录';
          statusLabel.style.color = 'red';

          if (userNameLabel) userNameLabel.textContent = '--';
          if (userEmailLabel) userEmailLabel.textContent = '--';

          if (loginForm) loginForm.style.display = 'block';
          if (loggedInActions) loggedInActions.style.display = 'none';
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
        const registerBtn = document.getElementById('researchopia-register-btn');
        const clearBtn = document.getElementById('researchopia-clear-btn');

        if (loginBtn) {
          loginBtn.onclick = () => this.performLogin();
          Zotero.debug('ResearchopiaPreferences: Login button bound');
        } else {
          Zotero.debug('ResearchopiaPreferences: Login button not found');
        }

        if (registerBtn) {
          registerBtn.onclick = () => this.performRegister();
          Zotero.debug('ResearchopiaPreferences: Register button bound');
        }

        if (clearBtn) {
          clearBtn.onclick = () => this.clearLoginForm();
          Zotero.debug('ResearchopiaPreferences: Clear button bound');
        }

        // 退出登录按钮
        const logoutBtn = document.getElementById('researchopia-logout-btn');
        if (logoutBtn) {
          logoutBtn.onclick = () => this.performLogout();
          Zotero.debug('ResearchopiaPreferences: Logout button bound');
        }

        // 其他功能按钮
        const clearCacheBtn = document.getElementById('researchopia-clear-cache-btn');
        if (clearCacheBtn) {
          clearCacheBtn.onclick = () => this.clearCache();
        }

        const exportBtn = document.getElementById('researchopia-export-settings-btn');
        if (exportBtn) {
          exportBtn.onclick = () => this.exportSettings();
        }

        const importBtn = document.getElementById('researchopia-import-settings-btn');
        if (importBtn) {
          importBtn.onclick = () => this.importSettings();
        }

        const resetBtn = document.getElementById('researchopia-reset-btn');
        if (resetBtn) {
          resetBtn.onclick = () => this.resetSettings();
        }

        const testBtn = document.getElementById('researchopia-test-btn');
        if (testBtn) {
          testBtn.onclick = () => this.testConnection();
        }

        const refreshStatsBtn = document.getElementById('researchopia-refresh-stats-btn');
        if (refreshStatsBtn) {
          refreshStatsBtn.onclick = () => this.refreshStats();
        }

        // 透明度滑块
        const opacitySlider = document.getElementById('researchopia-annotation-opacity');
        const opacityValue = document.getElementById('researchopia-opacity-value');
        if (opacitySlider && opacityValue) {
          opacitySlider.addEventListener('input', (e) => {
            opacityValue.textContent = e.target.value + '%';
          });
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

      // 使用新的认证管理器
      const addon = Zotero.Researchopia;
      if (addon && addon.auth) {
        const result = await addon.auth.login(email, password);

        if (result.success) {
          if (messageLabel) messageLabel.textContent = '登录成功';

          // 更新UI状态
          this.updateLoginStatus();

          // 清空密码字段
          passwordInput.value = '';

          Zotero.debug('ResearchopiaPreferences: Login successful');
        } else {
          if (messageLabel) messageLabel.textContent = '登录失败：' + (result.error || '未知错误');
        }
      } else {
        throw new Error('认证管理器未初始化');
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
  },

  /**
   * 执行注册
   */
  async performRegister() {
    try {
      Zotero.debug('ResearchopiaPreferences: Starting registration...');

      const emailInput = document.getElementById('researchopia-email-input');
      const passwordInput = document.getElementById('researchopia-password-input');
      const messageLabel = document.getElementById('researchopia-login-message');

      if (!emailInput || !passwordInput) {
        throw new Error('Registration form elements not found');
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      if (!email || !password) {
        if (messageLabel) messageLabel.textContent = '请输入邮箱和密码';
        return;
      }

      if (password.length < 6) {
        if (messageLabel) messageLabel.textContent = '密码长度至少6位';
        return;
      }

      if (messageLabel) messageLabel.textContent = '注册中...';

      // 使用新的认证管理器
      const addon = Zotero.Researchopia;
      if (addon && addon.auth) {
        const displayName = email.split('@')[0]; // 使用邮箱前缀作为显示名
        const result = await addon.auth.register(email, password, displayName);

        if (result.success) {
          if (messageLabel) messageLabel.textContent = '注册成功！请检查邮箱确认注册';

          // 清空密码字段
          passwordInput.value = '';

          Zotero.debug('ResearchopiaPreferences: Registration successful');
        } else {
          if (messageLabel) messageLabel.textContent = '注册失败：' + (result.error || '未知错误');
        }
      } else {
        throw new Error('认证管理器未初始化');
      }

    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Registration failed: ' + error.message);
      const messageLabel = document.getElementById('researchopia-login-message');
      if (messageLabel) messageLabel.textContent = '注册失败：' + error.message;
    }
  },

  /**
   * 执行退出登录
   */
  async performLogout() {
    try {
      Zotero.debug('ResearchopiaPreferences: Starting logout...');

      // 使用新的认证管理器
      const addon = Zotero.Researchopia;
      if (addon && addon.auth) {
        await addon.auth.logout();

        // 更新UI状态
        this.updateLoginStatus();

        // 清空登录表单
        this.clearLoginForm();

        Zotero.debug('ResearchopiaPreferences: Logout successful');
      } else {
        throw new Error('认证管理器未初始化');
      }

    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Logout failed: ' + error.message);
    }
  },

  /**
   * 清除缓存
   */
  clearCache() {
    try {
      const addon = Zotero.Researchopia;
      if (addon) {
        // 清除各种缓存
        if (addon.sync) addon.sync.clearCache();
        if (addon.social) addon.social.clearCache();
        if (addon.annotation) {
          addon.annotation.clearExtractedAnnotations();
          addon.annotation.clearSharedAnnotationsCache();
        }

        alert('缓存已清除');
        Zotero.debug('ResearchopiaPreferences: Cache cleared');
      }
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to clear cache: ' + error.message);
      alert('清除缓存失败: ' + error.message);
    }
  },

  /**
   * 导出设置
   */
  exportSettings() {
    try {
      const settings = {
        autoSync: Zotero.Prefs.get('extensions.researchopia.autoSync', true),
        realtimeUpdates: Zotero.Prefs.get('extensions.researchopia.realtimeUpdates', true),
        showSharedAnnotations: Zotero.Prefs.get('extensions.researchopia.showSharedAnnotations', true),
        showPrivateAnnotations: Zotero.Prefs.get('extensions.researchopia.showPrivateAnnotations', true),
        readerIntegration: Zotero.Prefs.get('extensions.researchopia.readerIntegration', true),
        maxAnnotations: Zotero.Prefs.get('extensions.researchopia.maxAnnotations', 100),
        sortMethod: Zotero.Prefs.get('extensions.researchopia.sortMethod', 'likes'),
        annotationOpacity: Zotero.Prefs.get('extensions.researchopia.annotationOpacity', 70),
        enableLikes: Zotero.Prefs.get('extensions.researchopia.enableLikes', true),
        enableComments: Zotero.Prefs.get('extensions.researchopia.enableComments', true),
        enableFollows: Zotero.Prefs.get('extensions.researchopia.enableFollows', true),
        enableNotifications: Zotero.Prefs.get('extensions.researchopia.enableNotifications', true),
        annotationVisibility: Zotero.Prefs.get('extensions.researchopia.annotationVisibility', 'public'),
        requestTimeout: Zotero.Prefs.get('extensions.researchopia.requestTimeout', 30),
        syncInterval: Zotero.Prefs.get('extensions.researchopia.syncInterval', 5),
        cacheSize: Zotero.Prefs.get('extensions.researchopia.cacheSize', 50),
        debugMode: Zotero.Prefs.get('extensions.researchopia.debugMode', false),
        offlineMode: Zotero.Prefs.get('extensions.researchopia.offlineMode', false),
        autoShare: Zotero.Prefs.get('extensions.researchopia.autoShare', false)
      };

      const settingsJson = JSON.stringify(settings, null, 2);

      // 创建下载链接
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'researchopia-settings.json';
      a.click();
      URL.revokeObjectURL(url);

      Zotero.debug('ResearchopiaPreferences: Settings exported');
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to export settings: ' + error.message);
      alert('导出设置失败: ' + error.message);
    }
  },

  /**
   * 导入设置
   */
  importSettings() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const settings = JSON.parse(e.target.result);

            // 应用设置
            Object.keys(settings).forEach(key => {
              Zotero.Prefs.set(`extensions.researchopia.${key}`, settings[key]);
            });

            alert('设置导入成功，请重启Zotero以应用更改');
            Zotero.debug('ResearchopiaPreferences: Settings imported');
          } catch (error) {
            alert('导入设置失败: 文件格式错误');
            Zotero.debug('ResearchopiaPreferences: Failed to parse settings file: ' + error.message);
          }
        };

        reader.readAsText(file);
      };

      input.click();
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to import settings: ' + error.message);
      alert('导入设置失败: ' + error.message);
    }
  },

  /**
   * 重置设置
   */
  resetSettings() {
    try {
      if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
        // 重置所有偏好设置
        const prefKeys = [
          'autoSync', 'realtimeUpdates', 'showSharedAnnotations', 'showPrivateAnnotations',
          'readerIntegration', 'maxAnnotations', 'sortMethod', 'annotationOpacity',
          'enableLikes', 'enableComments', 'enableFollows', 'enableNotifications',
          'annotationVisibility', 'requestTimeout', 'syncInterval', 'cacheSize',
          'debugMode', 'offlineMode', 'autoShare'
        ];

        prefKeys.forEach(key => {
          Zotero.Prefs.clear(`extensions.researchopia.${key}`);
        });

        alert('设置已重置，请重启Zotero以应用更改');
        Zotero.debug('ResearchopiaPreferences: Settings reset');
      }
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to reset settings: ' + error.message);
      alert('重置设置失败: ' + error.message);
    }
  },

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const testBtn = document.getElementById('researchopia-test-btn');
      if (testBtn) {
        testBtn.disabled = true;
        testBtn.textContent = '测试中...';
      }

      const addon = Zotero.Researchopia;
      if (addon && addon.sync) {
        // 测试网络连接
        const isOnline = await addon.sync.checkOnlineStatus();

        if (isOnline) {
          alert('连接测试成功！');
        } else {
          alert('连接测试失败，请检查网络连接');
        }
      } else {
        alert('插件未正确初始化');
      }

      Zotero.debug('ResearchopiaPreferences: Connection test completed');
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Connection test failed: ' + error.message);
      alert('连接测试失败: ' + error.message);
    } finally {
      const testBtn = document.getElementById('researchopia-test-btn');
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.textContent = '测试连接';
      }
    }
  },

  /**
   * 刷新统计信息
   */
  async refreshStats() {
    try {
      const refreshBtn = document.getElementById('researchopia-refresh-stats-btn');
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '刷新中...';
      }

      const addon = Zotero.Researchopia;
      if (addon && addon.auth && addon.auth.isAuthenticated()) {
        const user = addon.auth.getCurrentUser();
        if (user) {
          // 获取统计信息
          const following = await addon.social.getUserFollowing();
          const followers = await addon.social.getUserFollowers();

          // 更新显示
          const statsShared = document.getElementById('researchopia-stats-shared');
          const statsLikes = document.getElementById('researchopia-stats-likes');
          const statsComments = document.getElementById('researchopia-stats-comments');
          const statsFollowing = document.getElementById('researchopia-stats-following');
          const statsFollowers = document.getElementById('researchopia-stats-followers');

          if (statsShared) statsShared.textContent = '0'; // TODO: 实现获取用户共享标注数
          if (statsLikes) statsLikes.textContent = '0'; // TODO: 实现获取用户收到的点赞数
          if (statsComments) statsComments.textContent = '0'; // TODO: 实现获取用户发表的评论数
          if (statsFollowing) statsFollowing.textContent = following.length.toString();
          if (statsFollowers) statsFollowers.textContent = followers.length.toString();
        }
      } else {
        alert('请先登录后再刷新统计信息');
      }

      Zotero.debug('ResearchopiaPreferences: Stats refreshed');
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to refresh stats: ' + error.message);
      alert('刷新统计失败: ' + error.message);
    } finally {
      const refreshBtn = document.getElementById('researchopia-refresh-stats-btn');
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '刷新统计';
      }
    }
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
