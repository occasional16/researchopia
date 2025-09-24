/**
 * Researchopia 偏好设置管理器
 * 确保在全局作用域中定义
 */

// 确保在全局作用域中定义
if (typeof ResearchopiaPreferences === 'undefined') {
  var ResearchopiaPreferences = {

    /**
     * 初始化偏好设置面板
     */
    init() {
      try {
        Zotero.debug('ResearchopiaPreferences: Initializing preferences panel');

        // 检查必要的依赖
        if (!window.Zotero) {
          throw new Error('Zotero object not available');
        }

        if (!window.Zotero.ResearchopiaPlugin) {
          Zotero.debug('ResearchopiaPreferences: Warning - Zotero.ResearchopiaPlugin not available yet');
        }

        // 设置默认值
        this.setDefaultPreferences();

        // 更新UI状态
        this.updateLoginStatus();

        // 绑定事件监听器
        this.bindEventListeners();

        Zotero.debug('ResearchopiaPreferences: Initialization completed');
      } catch (error) {
        Zotero.debug('ResearchopiaPreferences: Initialization failed: ' + error.message);
        // 显示错误给用户
        if (typeof Services !== 'undefined' && Services.prompt) {
          Services.prompt.alert(null, 'Researchopia', '偏好设置初始化失败：' + error.message);
        }
      }
    },
  
  /**
   * 设置默认偏好设置
   */
  setDefaultPreferences() {
    const defaults = {
      'extensions.researchopia.autoSync': true,
      'extensions.researchopia.realtimeUpdates': true,
      'extensions.researchopia.syncOnStartup': false,
      'extensions.researchopia.showSharedAnnotations': true,
      'extensions.researchopia.showPrivateAnnotations': true,
      'extensions.researchopia.maxAnnotations': 50,
      'extensions.researchopia.requestTimeout': 30,
      'extensions.researchopia.debugMode': false
    };
    
    for (const [key, value] of Object.entries(defaults)) {
      try {
        // 检查偏好设置是否存在，如果不存在则设置默认值
        const currentValue = Zotero.Prefs.get(key);
        if (currentValue === undefined || currentValue === null) {
          Zotero.Prefs.set(key, value);
        }
      } catch (error) {
        // 如果获取失败，直接设置默认值
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
      const emailLabel = document.getElementById('researchopia-user-email');
      const loginForm = document.getElementById('researchopia-login-form');
      const loggedInActions = document.getElementById('researchopia-logged-in-actions');
      const loginMessage = document.getElementById('researchopia-login-message');

      // 尝试从插件获取登录状态
      let loginStatus = { isLoggedIn: false };
      if (window.Zotero && window.Zotero.ResearchopiaPlugin && window.Zotero.ResearchopiaPlugin.getLoginStatus) {
        try {
          loginStatus = window.Zotero.ResearchopiaPlugin.getLoginStatus();
        } catch (pluginError) {
          Zotero.debug('ResearchopiaPreferences: Failed to get login status from plugin: ' + pluginError.message);
        }
      }

      // 备用方案：直接从偏好设置获取
      if (!loginStatus.isLoggedIn) {
        const authToken = Zotero.Prefs.get('extensions.researchopia.authToken');
        const userInfoJson = Zotero.Prefs.get('extensions.researchopia.userInfo');

        if (authToken && userInfoJson) {
          try {
            const userInfo = JSON.parse(userInfoJson);
            loginStatus = {
              isLoggedIn: true,
              userInfo: userInfo
            };
          } catch (parseError) {
            loginStatus = { isLoggedIn: false };
          }
        }
      }

      if (loginStatus.isLoggedIn && loginStatus.userInfo) {
        // 已登录状态
        statusLabel.value = '已登录';
        statusLabel.style.color = '#28a745';

        // 显示用户名和邮箱
        const userNameLabel = document.getElementById('researchopia-user-name');
        if (userNameLabel) {
          userNameLabel.value = loginStatus.userInfo.name || loginStatus.userInfo.email?.split('@')[0] || '用户';
        }
        emailLabel.value = loginStatus.userInfo.email || '--';

        // 隐藏登录表单，显示已登录操作
        if (loginForm) loginForm.hidden = true;
        if (loggedInActions) loggedInActions.hidden = false;
        if (loginMessage) loginMessage.value = '';
      } else {
        // 未登录状态
        this.showLoggedOutState(statusLabel, emailLabel, loginForm, loggedInActions, loginMessage);
      }
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to update login status: ' + error.message);
    }
  },
  
  /**
   * 显示未登录状态
   */
  showLoggedOutState(statusLabel, emailLabel, loginForm, loggedInActions, loginMessage) {
    statusLabel.value = '未登录';
    statusLabel.style.color = '#dc3545';

    // 清空用户名和邮箱显示
    const userNameLabel = document.getElementById('researchopia-user-name');
    if (userNameLabel) userNameLabel.value = '--';
    emailLabel.value = '--';

    // 显示登录表单，隐藏已登录操作
    if (loginForm) loginForm.hidden = false;
    if (loggedInActions) loggedInActions.hidden = true;
    if (loginMessage) loginMessage.value = '';
  },
  
  /**
   * 绑定事件监听器
   */
  bindEventListeners() {
    // 监听偏好设置变化
    const preferences = [
      'extensions.researchopia.autoSync',
      'extensions.researchopia.realtimeUpdates',
      'extensions.researchopia.showSharedAnnotations',
      'extensions.researchopia.showPrivateAnnotations'
    ];

    preferences.forEach(pref => {
      Zotero.Prefs.registerObserver(pref, this.onPreferenceChanged.bind(this), false);
    });

    // 绑定按钮事件
    setTimeout(() => {
      this.bindButtonEvents();
    }, 100);
  },

  /**
   * 绑定按钮事件
   */
  bindButtonEvents() {
    try {
      // 等待DOM完全加载
      const bindEvents = () => {
        const loginBtn = document.getElementById('researchopia-login-btn');
        const logoutBtn = document.getElementById('researchopia-logout-btn');
        const resetBtn = document.getElementById('researchopia-reset-btn');
        const testBtn = document.getElementById('researchopia-test-btn');

        if (loginBtn) {
          loginBtn.onclick = () => this.performLogin();
          Zotero.debug('ResearchopiaPreferences: Login button bound');
        }

        if (logoutBtn) {
          logoutBtn.onclick = () => this.logout();
          Zotero.debug('ResearchopiaPreferences: Logout button bound');
        }

        const clearBtn = document.getElementById('researchopia-clear-btn');
        if (clearBtn) {
          clearBtn.onclick = () => this.clearLoginForm();
          Zotero.debug('ResearchopiaPreferences: Clear button bound');
        }

        if (resetBtn) {
          resetBtn.onclick = () => this.resetSettings();
          Zotero.debug('ResearchopiaPreferences: Reset button bound');
        }

        if (testBtn) {
          testBtn.onclick = () => this.testConnection();
          Zotero.debug('ResearchopiaPreferences: Test button bound');
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
      setTimeout(bindEvents, 500);
      setTimeout(bindEvents, 1000);

      Zotero.debug('ResearchopiaPreferences: Button events binding scheduled');
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to bind button events: ' + error.message);
    }
  },
  
  /**
   * 偏好设置变化处理
   */
  onPreferenceChanged(pref) {
    Zotero.debug(`ResearchopiaPreferences: Preference changed: ${pref}`);
    
    // 通知插件主体偏好设置已变化
    if (window.Zotero && window.Zotero.ResearchopiaPlugin) {
      window.Zotero.ResearchopiaPlugin.onPreferencesChanged(pref);
    }
  },
  
  /**
   * 清空登录表单
   */
  clearLoginForm() {
    try {
      const emailInput = document.getElementById('researchopia-email-input');
      const passwordInput = document.getElementById('researchopia-password-input');
      const loginMessage = document.getElementById('researchopia-login-message');

      Zotero.debug('ResearchopiaPreferences: Clearing form - emailInput=' + (emailInput ? 'found' : 'null') + ', passwordInput=' + (passwordInput ? 'found' : 'null'));

      if (emailInput) {
        emailInput.value = '';
        Zotero.debug('ResearchopiaPreferences: Email input cleared');
      }
      if (passwordInput) {
        passwordInput.value = '';
        Zotero.debug('ResearchopiaPreferences: Password input cleared');
      }
      if (loginMessage) {
        loginMessage.value = '';
        Zotero.debug('ResearchopiaPreferences: Login message cleared');
      }

      Zotero.debug('ResearchopiaPreferences: Login form cleared successfully');
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Failed to clear login form: ' + error.message);
    }
  },

  /**
   * 执行登录（使用表单输入）
   */
  async performLogin() {
    try {
      Zotero.debug('ResearchopiaPreferences: Starting form-based login process');

      const emailInput = document.getElementById('researchopia-email-input');
      const passwordInput = document.getElementById('researchopia-password-input');
      const loginMessage = document.getElementById('researchopia-login-message');
      const loginBtn = document.getElementById('researchopia-login-btn');

      Zotero.debug('ResearchopiaPreferences: emailInput = ' + (emailInput ? 'found' : 'null'));
      Zotero.debug('ResearchopiaPreferences: passwordInput = ' + (passwordInput ? 'found' : 'null'));

      if (!emailInput || !passwordInput) {
        const errorMsg = '登录表单元素未找到: emailInput=' + (emailInput ? 'found' : 'null') + ', passwordInput=' + (passwordInput ? 'found' : 'null');
        Zotero.debug('ResearchopiaPreferences: ' + errorMsg);
        throw new Error(errorMsg);
      }

      Zotero.debug('ResearchopiaPreferences: emailInput.value = ' + emailInput.value);
      Zotero.debug('ResearchopiaPreferences: passwordInput.value = ' + passwordInput.value);

      const email = emailInput.value ? emailInput.value.trim() : '';
      const password = passwordInput.value ? passwordInput.value.trim() : '';

      if (!email) {
        if (loginMessage) loginMessage.value = '请输入邮箱地址';
        if (loginMessage) loginMessage.style.color = '#dc3545';
        emailInput.focus();
        return;
      }

      if (!password) {
        if (loginMessage) loginMessage.value = '请输入密码';
        if (loginMessage) loginMessage.style.color = '#dc3545';
        passwordInput.focus();
        return;
      }

      // 检查插件是否可用
      if (!window.Zotero || !window.Zotero.ResearchopiaPlugin) {
        const errorMsg = '插件未正确初始化，请重启Zotero后重试';
        Zotero.debug('ResearchopiaPreferences: Plugin not available - ' + errorMsg);
        if (loginMessage) {
          loginMessage.value = errorMsg;
          loginMessage.style.color = '#dc3545';
        }
        return;
      }

      Zotero.debug('ResearchopiaPreferences: Attempting authentication for: ' + email);

      // 显示登录进度
      if (loginMessage) {
        loginMessage.value = '正在登录...';
        loginMessage.style.color = '#007bff';
      }
      if (loginBtn) loginBtn.disabled = true;

      try {
        // 调用插件的登录方法
        await window.Zotero.ResearchopiaPlugin.login(email, password);

        // 登录成功
        if (loginMessage) {
          loginMessage.value = '登录成功！';
          loginMessage.style.color = '#28a745';
        }

        // 清空密码输入框（保留邮箱）
        if (passwordInput) passwordInput.value = '';

        // 更新UI状态
        this.updateLoginStatus();

        Zotero.debug('ResearchopiaPreferences: Form-based login successful');

        // 2秒后清空成功消息
        setTimeout(() => {
          if (loginMessage) loginMessage.value = '';
        }, 2000);

      } catch (authError) {
        // 登录失败
        Zotero.debug('ResearchopiaPreferences: Form-based login failed: ' + authError.message);

        if (loginMessage) {
          // 使用友好的错误消息
          const friendlyMessage = this.getFriendlyErrorMessage(authError.message);
          loginMessage.value = friendlyMessage;
          loginMessage.style.color = '#dc3545';
        }
      }

    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Form-based login error: ' + error.message);
      const loginMessage = document.getElementById('researchopia-login-message');
      if (loginMessage) {
        loginMessage.value = '登录过程出错：' + error.message;
        loginMessage.style.color = '#dc3545';
      }
    } finally {
      // 恢复登录按钮
      const loginBtn = document.getElementById('researchopia-login-btn');
      if (loginBtn) loginBtn.disabled = false;
    }
  },

  /**
   * 显示登录对话框（备用方法）
   */
  async showLogin() {
    try {
      Zotero.debug('ResearchopiaPreferences: Starting login process');

      // 检查插件是否可用
      if (!window.Zotero || !window.Zotero.ResearchopiaPlugin) {
        const errorMsg = '插件未正确初始化，请重启Zotero后重试';
        Zotero.debug('ResearchopiaPreferences: Plugin not available - ' + errorMsg);
        Services.prompt.alert(null, 'Researchopia', errorMsg);
        return;
      }

      // 修复Services.prompt API的正确用法
      const emailInput = { value: '' };
      const emailOk = Services.prompt.prompt(
        null,
        'Researchopia 登录',
        '请输入您的邮箱地址：',
        emailInput,
        null,
        {}
      );

      if (!emailOk || !emailInput.value || emailInput.value.trim() === '') {
        Zotero.debug('ResearchopiaPreferences: User cancelled email input or entered empty email');
        return;
      }

      const passwordInput = { value: '' };
      const passwordOk = Services.prompt.promptPassword(
        null,
        'Researchopia 登录',
        '请输入您的密码：',
        passwordInput,
        null,
        {}
      );

      if (!passwordOk || !passwordInput.value || passwordInput.value.trim() === '') {
        Zotero.debug('ResearchopiaPreferences: User cancelled password input or entered empty password');
        return;
      }

      Zotero.debug('ResearchopiaPreferences: Attempting authentication for: ' + emailInput.value);

      // 显示登录进度
      const progressWindow = new Zotero.ProgressWindow();
      progressWindow.changeHeadline('Researchopia');
      progressWindow.addDescription('正在登录...');
      progressWindow.show();

      try {
        // 调用插件的登录方法
        await window.Zotero.ResearchopiaPlugin.login(email, password);

        progressWindow.addDescription('登录成功！');
        setTimeout(() => progressWindow.close(), 2000);

        // 更新UI状态
        this.updateLoginStatus();

        Zotero.debug('ResearchopiaPreferences: Login successful');
        Services.prompt.alert(null, 'Researchopia', '✅ 登录成功！');

      } catch (authError) {
        progressWindow.close();
        throw authError;
      }

    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Login failed: ' + error.message);

      // 提供更友好的错误信息
      let userMessage = '登录失败：';
      if (error.message.includes('Invalid login credentials')) {
        userMessage += '邮箱或密码错误，请检查后重试';
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        userMessage += '网络连接问题，请检查网络后重试';
      } else {
        userMessage += error.message;
      }

      Services.prompt.alert(null, 'Researchopia', userMessage);
    }
  },

  /**
   * 获取友好的错误消息
   */
  getFriendlyErrorMessage(errorMessage) {
    const msg = errorMessage.toLowerCase();

    // 根据错误消息内容返回友好提示
    if (msg.includes('邮箱或密码错误') || msg.includes('invalid') && msg.includes('credentials')) {
      return '邮箱或密码错误，请检查后重试';
    } else if (msg.includes('网络连接失败') || msg.includes('network')) {
      return '网络连接失败，请检查网络设置';
    } else if (msg.includes('连接超时') || msg.includes('timeout')) {
      return '连接超时，请检查网络后重试';
    } else if (msg.includes('服务器') || msg.includes('server') || msg.includes('500')) {
      return '服务器暂时不可用，请稍后再试';
    } else if (msg.includes('账户被禁用') || msg.includes('forbidden') || msg.includes('403')) {
      return '账户被禁用或无权限访问';
    } else if (msg.includes('过于频繁') || msg.includes('429')) {
      return '登录尝试过于频繁，请稍后再试';
    } else if (msg.includes('邮箱格式') || msg.includes('email')) {
      return '邮箱格式不正确';
    } else if (msg.includes('密码格式') || msg.includes('password')) {
      return '密码格式不正确';
    } else if (msg.includes('输入信息有误')) {
      return '输入信息有误，请检查邮箱和密码';
    } else if (msg.includes('http post')) {
      return '网络请求失败，请检查网络连接';
    } else {
      // 如果是已经友好化的消息，直接返回
      return errorMessage;
    }
  },

  /**
   * 退出登录
   */
  async logout() {
    try {
      Zotero.debug('ResearchopiaPreferences: Starting logout process');

      const confirmed = Services.prompt.confirm(
        null,
        'Researchopia',
        '确定要退出登录吗？这将清除本地保存的认证信息。'
      );

      if (confirmed) {
        Zotero.debug('ResearchopiaPreferences: User confirmed logout');

        // 清除认证信息
        Zotero.Prefs.clear('extensions.researchopia.authToken');
        Zotero.Prefs.clear('extensions.researchopia.userInfo');

        // 调用插件的退出登录方法
        if (window.Zotero && window.Zotero.ResearchopiaPlugin && window.Zotero.ResearchopiaPlugin.logout) {
          try {
            await window.Zotero.ResearchopiaPlugin.logout();
            Zotero.debug('ResearchopiaPreferences: Plugin logout successful');
          } catch (logoutError) {
            Zotero.debug('ResearchopiaPreferences: Plugin logout failed: ' + logoutError.message);
          }
        }

        // 清空登录表单
        this.clearLoginForm();

        // 更新UI
        this.updateLoginStatus();

        Zotero.debug('ResearchopiaPreferences: Logout successful');

        // 显示成功消息在登录表单中
        const loginMessage = document.getElementById('researchopia-login-message');
        if (loginMessage) {
          loginMessage.value = '已成功退出登录';
          loginMessage.style.color = '#28a745';

          // 3秒后清空消息
          setTimeout(() => {
            if (loginMessage) loginMessage.value = '';
          }, 3000);
        }
      } else {
        Zotero.debug('ResearchopiaPreferences: User cancelled logout');
      }
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Logout failed: ' + error.message);

      // 显示错误消息
      const loginMessage = document.getElementById('researchopia-login-message');
      if (loginMessage) {
        loginMessage.value = '退出登录失败：' + error.message;
        loginMessage.style.color = '#dc3545';
      } else {
        Services.prompt.alert(null, 'Researchopia', '❌ 退出登录失败：' + error.message);
      }
    }
  },
  
  /**
   * 重置设置
   */
  resetSettings() {
    try {
      const confirmed = Services.prompt.confirm(
        null,
        'Researchopia',
        '确定要重置所有设置吗？这将恢复默认配置（不会影响登录状态）。'
      );
      
      if (confirmed) {
        // 保存登录信息
        const authToken = Zotero.Prefs.get('extensions.researchopia.authToken');
        const userInfo = Zotero.Prefs.get('extensions.researchopia.userInfo');
        
        // 清除所有设置
        const prefs = [
          'extensions.researchopia.autoSync',
          'extensions.researchopia.realtimeUpdates',
          'extensions.researchopia.syncOnStartup',
          'extensions.researchopia.showSharedAnnotations',
          'extensions.researchopia.showPrivateAnnotations',
          'extensions.researchopia.maxAnnotations',
          'extensions.researchopia.serverUrl',
          'extensions.researchopia.requestTimeout',
          'extensions.researchopia.debugMode'
        ];
        
        prefs.forEach(pref => Zotero.Prefs.clear(pref));
        
        // 恢复默认值
        this.setDefaultPreferences();
        
        // 恢复登录信息
        if (authToken) Zotero.Prefs.set('extensions.researchopia.authToken', authToken);
        if (userInfo) Zotero.Prefs.set('extensions.researchopia.userInfo', userInfo);
        
        // 刷新界面
        window.location.reload();
        
        Services.prompt.alert(null, 'Researchopia', '设置已重置为默认值');
      }
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Reset settings failed: ' + error.message);
    }
  },
  
  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const serverUrl = Zotero.Prefs.get('extensions.researchopia.serverUrl');
      
      Services.prompt.alert(null, 'Researchopia', '正在测试连接到：' + serverUrl);
      
      // 这里可以添加实际的连接测试逻辑
      const response = await Zotero.HTTP.request('GET', serverUrl + '/rest/v1/', {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4'
        },
        responseType: 'json'
      });
      
      if (response.status >= 200 && response.status < 300) {
        Services.prompt.alert(null, 'Researchopia', '✅ 连接测试成功！服务器响应正常。');
      } else {
        Services.prompt.alert(null, 'Researchopia', '❌ 连接测试失败：HTTP ' + response.status);
      }
      
    } catch (error) {
      Zotero.debug('ResearchopiaPreferences: Connection test failed: ' + error.message);
      Services.prompt.alert(null, 'Researchopia', '❌ 连接测试失败：' + error.message);
    }
  }
  };
}

// 确保对象在全局作用域中可用
if (typeof window !== 'undefined') {
  window.ResearchopiaPreferences = ResearchopiaPreferences;
}
