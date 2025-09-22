/**
 * Researchopia Zotero Plugin Bootstrap - Modular Version
 * 模块化版本，整合专业架构
 */

// 全局变量
var Zotero;
var rootURI;

// 日志函数 - 只使用Zotero.debug
function log(message) {
  if (typeof Zotero !== 'undefined' && Zotero.debug) {
    Zotero.debug("Researchopia: " + message);
  }
}

// 全局插件实例
let researchopiaPluginInstance = null;

/**
 * 内置认证管理器
 */
class BuiltinAuthManager {
  constructor() {
    this.initialized = false;
    this.isAuthenticated = false;
    this.currentUser = null;
    this.authToken = null;
    this.baseURL = 'https://www.researchopia.com';

    log('BuiltinAuthManager initialized');
  }

  /**
   * 初始化认证管理器
   */
  async initialize() {
    try {
      this.initialized = true;

      // 尝试从本地存储恢复认证状态
      await this.restoreAuthState();

      log('BuiltinAuthManager initialization completed');
    } catch (error) {
      log('BuiltinAuthManager initialization failed: ' + error.message);
    }
  }

  /**
   * 恢复认证状态
   */
  async restoreAuthState() {
    try {
      // 从Zotero偏好设置中读取认证信息
      const savedToken = Zotero.Prefs.get('extensions.researchopia.authToken', '');
      const savedUser = Zotero.Prefs.get('extensions.researchopia.currentUser', '');

      if (savedToken && savedUser) {
        this.authToken = savedToken;
        try {
          this.currentUser = JSON.parse(savedUser);
          this.isAuthenticated = true;

          log('Auth state restored: ' + this.currentUser.name);
        } catch (parseError) {
          // 清除无效的用户数据
          this.clearAuthState();
        }
      }
    } catch (error) {
      log('Failed to restore auth state: ' + error.message);
    }
  }

  /**
   * 开始登录流程 - 真正的Supabase集成
   */
  async startLogin() {
    try {
      log('Starting integrated Supabase login process...');

      // 直接在插件内部进行认证，无需外部跳转
      await this.showInternalLoginForm();

    } catch (error) {
      log('Login process failed: ' + error.message);
      Zotero.alert(null, 'Researchopia 登录', '❌ 登录失败: ' + error.message);
    }
  }

  /**
   * 显示内部登录表单
   */
  async showInternalLoginForm() {
    try {
      // 首先询问用户选择登录方式
      const choice = await this.askLoginChoice();

      if (choice === 'demo') {
        // 启动演示模式
        await this.startDemoMode();
        return;
      }

      if (choice === 'login') {
        // 创建登录对话框
        const loginDialog = this.createLoginDialog();

        // 显示对话框并等待用户输入
        const result = await this.showLoginDialog(loginDialog);

        if (result.success) {
          // 直接调用Supabase认证API
          await this.authenticateWithSupabase(result.email, result.password);
        }
      }

    } catch (error) {
      log('Internal login form failed: ' + error.message);
      throw error;
    }
  }

  /**
   * 询问登录方式选择
   */
  async askLoginChoice() {
    try {
      // 显示选择对话框
      const choice = await new Promise((resolve) => {
        const result = Zotero.alert(
          null,
          'Researchopia 登录方式',
          '请选择登录方式：\n\n' +
          '1. 真实登录 - 使用您的研学港账户\n' +
          '2. 演示模式 - 体验功能（推荐）\n\n' +
          '注意：由于技术限制，真实登录需要手动输入账户信息',
          3, // 显示三个按钮
          '真实登录',
          '演示模式',
          '取消'
        );

        switch (result) {
          case 0: resolve('login'); break;
          case 1: resolve('demo'); break;
          default: resolve('cancel'); break;
        }
      });

      return choice;

    } catch (error) {
      log('Ask login choice failed: ' + error.message);
      return 'demo'; // 默认演示模式
    }
  }

  /**
   * 直接调用Supabase认证API
   */
  async authenticateWithSupabase(email, password) {
    try {
      log('Authenticating with Supabase API...');

      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://obcblvdtqhwrihoddlez.supabase.co/auth/v1/token?grant_type=password');

        xhr.setRequestHeader('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4');
        xhr.setRequestHeader('Content-Type', 'application/json');

        const requestData = {
          email: email,
          password: password
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const authData = JSON.parse(xhr.responseText);
              resolve({ data: authData, status: xhr.status });
            } catch (parseError) {
              reject(new Error('Invalid response format: ' + parseError.message));
            }
          } else {
            let errorMessage = `HTTP ${xhr.status}`;
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage += ': ' + (errorData.error_description || errorData.message || 'Authentication failed');
            } catch (e) {
              errorMessage += ': Authentication failed';
            }
            reject(new Error(errorMessage));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Request timeout'));
        xhr.timeout = 15000;

        xhr.send(JSON.stringify(requestData));
      });

      if (response.data && response.data.access_token && response.data.user) {
        // 认证成功，保存用户信息和token
        const user = {
          id: response.data.user.id,
          name: response.data.user.user_metadata?.username || response.data.user.email?.split('@')[0] || '用户',
          email: response.data.user.email
        };

        this.isAuthenticated = true;
        this.currentUser = user;
        this.authToken = response.data.access_token;

        // 保存认证状态
        await this.saveSupabaseAuthState(user, response.data.access_token);
        await this.saveAuthState();

        log('Supabase authentication successful!');

        Zotero.alert(
          null,
          'Researchopia 登录',
          '✅ 登录成功！\n\n欢迎回来，' + user.name + '！\n标注共享功能现已可用。'
        );

        // 刷新UI
        this.refreshUI();

      } else {
        throw new Error('Invalid authentication response');
      }

    } catch (error) {
      log('Supabase authentication failed: ' + error.message);

      // 显示用户友好的错误信息
      let userMessage = '登录失败：';
      if (error.message.includes('Invalid login credentials')) {
        userMessage += '邮箱或密码错误';
      } else if (error.message.includes('Email not confirmed')) {
        userMessage += '请先验证您的邮箱';
      } else if (error.message.includes('Too many requests')) {
        userMessage += '登录尝试次数过多，请稍后再试';
      } else {
        userMessage += error.message;
      }

      Zotero.alert(null, 'Researchopia 登录', '❌ ' + userMessage);
      throw error;
    }
  }

  /**
   * 创建登录对话框
   */
  createLoginDialog() {
    try {
      // 使用简单的输入对话框
      return {
        getCredentials: () => {
          const email = this.promptUser('Researchopia 登录', '请输入您的邮箱地址：', '');
          if (!email) return null;

          const password = this.promptUser('Researchopia 登录', '请输入您的密码：', '', true);
          if (!password) return null;

          return { email, password };
        }
      };
    } catch (error) {
      log('Create login dialog failed: ' + error.message);
      throw error;
    }
  }

  /**
   * 显示登录对话框
   */
  async showLoginDialog(loginDialog) {
    try {
      const credentials = loginDialog.getCredentials();

      if (credentials && credentials.email && credentials.password) {
        return {
          success: true,
          email: credentials.email.trim(),
          password: credentials.password
        };
      }

      return { success: false, error: 'User cancelled' };

    } catch (error) {
      log('Show login dialog failed: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 用户输入提示（兼容Zotero API）
   */
  promptUser(title, message, defaultValue = '', isPassword = false) {
    try {
      // 尝试使用Services.prompt
      if (typeof Services !== 'undefined' && Services.prompt) {
        const prompts = Services.prompt;
        const result = { value: defaultValue };

        let success;
        if (isPassword) {
          success = prompts.promptPassword(
            null, // parent window
            title,
            message,
            result,
            null, // checkMsg
            {} // checkValue
          );
        } else {
          success = prompts.prompt(
            null, // parent window
            title,
            message,
            result,
            null, // checkMsg
            {} // checkValue
          );
        }

        return success ? result.value : null;
      }

      // 备用方案：使用简化的输入方式
      return this.getSimpleInput(title, message, defaultValue, isPassword);

    } catch (error) {
      log('Prompt user failed: ' + error.message);
      return null;
    }
  }

  /**
   * 简化输入方法
   */
  getSimpleInput(title, message, defaultValue, isPassword = false) {
    try {
      // 对于演示，我们提供一个测试账户
      if (message.includes('邮箱')) {
        Zotero.alert(
          null,
          title,
          '请输入您的邮箱地址\n\n如需测试，可以使用演示模式'
        );
        // 返回一个测试邮箱用于演示
        return 'demo@researchopia.com';
      }

      if (message.includes('密码')) {
        Zotero.alert(
          null,
          title,
          '请输入您的密码\n\n如需测试，可以使用演示模式'
        );
        // 返回一个测试密码用于演示
        return 'demo123456';
      }

      return defaultValue;

    } catch (error) {
      log('Simple input failed: ' + error.message);
      return null;
    }
  }

  /**
   * 开始网页登录
   */
  async startWebLogin() {
    try {
      // 生成唯一的会话ID
      const sessionId = 'zotero_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      this.currentSessionId = sessionId;

      // 打开登录页面
      const loginURL = `https://www.researchopia.com/plugin/auth?session=${sessionId}&source=zotero`;
      Zotero.launchURL(loginURL);

      // 显示详细说明
      Zotero.alert(
        null,
        'Researchopia 网页登录',
        '🔐 登录页面已在浏览器中打开\n\n' +
        '请按以下步骤操作：\n' +
        '1. 在浏览器中完成登录\n' +
        '2. 登录成功后，页面会显示"登录成功"信息\n' +
        '3. 返回Zotero，插件将自动检测登录状态\n\n' +
        '如果自动检测失败，请选择"手动输入Token"方式'
      );

      // 开始轮询检查认证状态
      this.startAuthPolling();

    } catch (error) {
      log('Web login failed: ' + error.message);
    }
  }

  /**
   * 开始手动登录
   */
  async startManualLogin() {
    try {
      // 先打开登录页面
      Zotero.launchURL('https://www.researchopia.com/plugin/auth');

      // 显示手动输入说明
      const instructions =
        '请按以下步骤手动获取认证信息：\n\n' +
        '1. 在浏览器中登录 researchopia.com\n' +
        '2. 登录成功后，按F12打开开发者工具\n' +
        '3. 在Console中输入：localStorage.getItem("auth_token")\n' +
        '4. 复制返回的token（去掉引号）\n' +
        '5. 点击确定后，将token粘贴到下一个对话框中';

      Zotero.alert(null, '手动登录说明', instructions);

      // 获取用户输入的token
      const token = Zotero.prompt(
        '输入认证Token',
        '请粘贴从浏览器获取的认证Token：',
        ''
      );

      if (token && token.trim()) {
        // 验证token并获取用户信息
        const authResult = await this.validateManualToken(token.trim());

        if (authResult.success) {
          this.isAuthenticated = true;
          this.currentUser = authResult.user;
          this.authToken = authResult.token;

          await this.saveAuthState();

          Zotero.alert(
            null,
            'Researchopia 登录',
            `✅ 登录成功！\n\n欢迎回来，${authResult.user.name}！\n标注共享功能现已可用。`
          );

          // 刷新UI
          this.refreshUI();
        } else {
          Zotero.alert(
            null,
            'Researchopia 登录',
            `❌ 登录失败：${authResult.error}\n\n请检查Token是否正确，或重试网页登录。`
          );
        }
      }

    } catch (error) {
      log('Manual login failed: ' + error.message);
      Zotero.alert(null, 'Researchopia 登录', `❌ 手动登录失败：${error.message}`);
    }
  }

  /**
   * 验证手动输入的token
   */
  async validateManualToken(token) {
    try {
      // 使用token调用用户信息API
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://www.researchopia.com/api/user/profile');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const userData = JSON.parse(xhr.responseText);
              resolve({ data: userData, status: xhr.status });
            } catch (parseError) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}: Token验证失败`));
          }
        };

        xhr.onerror = () => reject(new Error('网络错误'));
        xhr.ontimeout = () => reject(new Error('请求超时'));
        xhr.timeout = 10000;
        xhr.send();
      });

      if (response.data && response.data.id) {
        return {
          success: true,
          user: {
            id: response.data.id,
            name: response.data.name || response.data.username || '用户',
            email: response.data.email || ''
          },
          token: token
        };
      }

      return { success: false, error: '无效的用户数据' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 刷新UI
   */
  refreshUI() {
    setTimeout(() => {
      try {
        if (Zotero.getActiveZoteroPane && Zotero.getActiveZoteroPane()) {
          const zoteroPane = Zotero.getActiveZoteroPane();
          if (zoteroPane.itemsView && zoteroPane.itemsView.selection) {
            const currentSelection = zoteroPane.itemsView.selection.currentIndex;
            if (currentSelection >= 0) {
              zoteroPane.itemsView.selection.select(currentSelection);
            }
          }
        }
      } catch (refreshError) {
        log("UI refresh failed: " + refreshError.message);
      }
    }, 500);
  }

  /**
   * 开始Supabase认证状态轮询
   */
  startSupabaseAuthPolling() {
    let pollCount = 0;
    const maxPolls = 60; // 最多轮询60次（10分钟）

    const pollInterval = setInterval(async () => {
      pollCount++;

      try {
        // 检查Supabase认证状态
        const authResult = await this.checkSupabaseAuthStatus();

        if (authResult.success) {
          clearInterval(pollInterval);

          // 保存认证信息
          this.isAuthenticated = true;
          this.currentUser = authResult.user;
          this.authToken = authResult.token;

          // 持久化保存到Supabase格式
          await this.saveSupabaseAuthState(authResult.user, authResult.token);
          await this.saveAuthState(); // 保持兼容性

          log('Supabase authentication successful!');

          // 通知用户登录成功
          Zotero.alert(
            null,
            'Researchopia 登录',
            '✅ 登录成功！\n\n欢迎回来，' + authResult.user.name + '！\n标注共享功能现已可用。'
          );

          // 刷新UI
          this.refreshUI();
        }

        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          log('Supabase auth polling timeout');
          Zotero.alert(
            null,
            'Researchopia 登录',
            '⏰ 登录超时\n\n请确保在浏览器中完成登录，然后重试'
          );
        }

      } catch (error) {
        log('Supabase auth polling error: ' + error.message);
      }
    }, 5000); // 每5秒检查一次
  }

  /**
   * 检查Supabase认证状态
   */
  async checkSupabaseAuthStatus() {
    try {
      // 方法1：检查本地存储的认证信息
      const localAuth = await this.checkLocalSupabaseAuth();
      if (localAuth.success) {
        return localAuth;
      }

      // 方法2：通过API检查会话状态
      const sessionAuth = await this.checkSupabaseSession();
      if (sessionAuth.success) {
        return sessionAuth;
      }

      return { success: false, error: 'No valid authentication found' };

    } catch (error) {
      log('Check Supabase auth status failed: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查本地Supabase认证信息
   */
  async checkLocalSupabaseAuth() {
    try {
      // 检查Zotero配置中的认证信息
      const authToken = Zotero.Prefs.get('extensions.researchopia.supabaseToken');
      const authUser = Zotero.Prefs.get('extensions.researchopia.supabaseUser');
      const authTime = Zotero.Prefs.get('extensions.researchopia.supabaseAuthTime');

      if (authToken && authUser && authTime) {
        const authTimestamp = new Date(authTime);
        const now = new Date();
        const hoursDiff = (now - authTimestamp) / (1000 * 60 * 60);

        // 检查是否在24小时内
        if (hoursDiff < 24) {
          const user = JSON.parse(authUser);

          // 验证token是否仍然有效
          const isValid = await this.validateSupabaseToken(authToken);
          if (isValid) {
            return {
              success: true,
              user: user,
              token: authToken
            };
          }
        }
      }

      return { success: false, error: 'No valid local auth' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查Supabase会话状态
   */
  async checkSupabaseSession() {
    try {
      // 调用Supabase Auth API检查会话
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://obcblvdtqhwrihoddlez.supabase.co/auth/v1/user');
        xhr.setRequestHeader('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4');

        // 尝试从本地存储获取token
        const storedToken = Zotero.Prefs.get('extensions.researchopia.supabaseToken');
        if (storedToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${storedToken}`);
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const userData = JSON.parse(xhr.responseText);
              resolve({ data: userData, status: xhr.status });
            } catch (parseError) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}: Session check failed`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Request timeout'));
        xhr.timeout = 10000;
        xhr.send();
      });

      if (response.data && response.data.id) {
        return {
          success: true,
          user: {
            id: response.data.id,
            name: response.data.user_metadata?.username || response.data.email?.split('@')[0] || '用户',
            email: response.data.email || ''
          },
          token: Zotero.Prefs.get('extensions.researchopia.supabaseToken') || 'session-token'
        };
      }

      return { success: false, error: 'No valid session' };

    } catch (error) {
      log('Supabase session check failed: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 验证Supabase Token
   */
  async validateSupabaseToken(token) {
    try {
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://obcblvdtqhwrihoddlez.supabase.co/auth/v1/user');
        xhr.setRequestHeader('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.onload = () => {
          resolve(xhr.status >= 200 && xhr.status < 300);
        };

        xhr.onerror = () => resolve(false);
        xhr.ontimeout = () => resolve(false);
        xhr.timeout = 5000;
        xhr.send();
      });

      return response;

    } catch (error) {
      log('Token validation failed: ' + error.message);
      return false;
    }
  }

  /**
   * 保存Supabase认证状态
   */
  async saveSupabaseAuthState(user, token) {
    try {
      Zotero.Prefs.set('extensions.researchopia.supabaseToken', token);
      Zotero.Prefs.set('extensions.researchopia.supabaseUser', JSON.stringify(user));
      Zotero.Prefs.set('extensions.researchopia.supabaseAuthTime', new Date().toISOString());

      log('Supabase auth state saved');
    } catch (error) {
      log('Failed to save Supabase auth state: ' + error.message);
    }
  }

  /**
   * 检查网页端认证状态（多种方式）
   */
  async checkWebAuthStatus() {
    try {
      // 方式1：检查浏览器localStorage（通过临时文件）
      const localStorageAuth = await this.checkBrowserLocalStorage();
      if (localStorageAuth.success) {
        return localStorageAuth;
      }

      // 方式2：检查系统临时文件
      const tempFileAuth = await this.checkTempFileAuth();
      if (tempFileAuth.success) {
        return tempFileAuth;
      }

      // 方式3：检查Zotero配置文件中的认证信息
      const configAuth = await this.checkConfigAuth();
      if (configAuth.success) {
        return configAuth;
      }

      return { success: false, error: 'No authentication found' };

    } catch (error) {
      log('Check web auth status failed: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查浏览器localStorage（通过读取浏览器配置文件）
   */
  async checkBrowserLocalStorage() {
    try {
      // 这里可以尝试读取Chrome/Firefox的localStorage文件
      // 但由于安全限制，这种方法在Zotero中可能不可行
      return { success: false, error: 'Browser localStorage not accessible' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查系统临时文件中的认证信息
   */
  async checkTempFileAuth() {
    try {
      // 检查用户临时目录中的认证文件
      const tempDir = Zotero.getTempDirectory();
      const authFile = tempDir.clone();
      authFile.append('researchopia_auth.json');

      if (authFile.exists()) {
        const content = await Zotero.File.getContentsAsync(authFile);
        const authData = JSON.parse(content);

        // 检查认证信息是否有效（不超过24小时）
        const authTime = new Date(authData.timestamp);
        const now = new Date();
        const hoursDiff = (now - authTime) / (1000 * 60 * 60);

        if (hoursDiff < 24 && authData.user && authData.token) {
          return {
            success: true,
            user: authData.user,
            token: authData.token
          };
        }
      }

      return { success: false, error: 'No valid temp file auth' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查Zotero配置中的认证信息
   */
  async checkConfigAuth() {
    try {
      // 检查是否有外部程序写入的认证信息
      const authToken = Zotero.Prefs.get('extensions.researchopia.webAuthToken');
      const authUser = Zotero.Prefs.get('extensions.researchopia.webAuthUser');
      const authTime = Zotero.Prefs.get('extensions.researchopia.webAuthTime');

      if (authToken && authUser && authTime) {
        const authTimestamp = new Date(authTime);
        const now = new Date();
        const hoursDiff = (now - authTimestamp) / (1000 * 60 * 60);

        if (hoursDiff < 24) {
          const user = JSON.parse(authUser);
          return {
            success: true,
            user: user,
            token: authToken
          };
        }
      }

      return { success: false, error: 'No valid config auth' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查认证状态（本地）
   */
  async checkAuthStatus() {
    // 检查本地存储的认证状态
    await this.restoreAuthState();
  }

  /**
   * 保存认证状态
   */
  async saveAuthState() {
    try {
      if (this.authToken && this.currentUser) {
        Zotero.Prefs.set('extensions.researchopia.authToken', this.authToken);
        Zotero.Prefs.set('extensions.researchopia.currentUser', JSON.stringify(this.currentUser));
        log('Auth state saved');
      } else {
        this.clearAuthState();
      }
    } catch (error) {
      log('Failed to save auth state: ' + error.message);
    }
  }

  /**
   * 清除认证状态
   */
  clearAuthState() {
    try {
      this.isAuthenticated = false;
      this.currentUser = null;
      this.authToken = null;

      Zotero.Prefs.clear('extensions.researchopia.authToken');
      Zotero.Prefs.clear('extensions.researchopia.currentUser');

      log('Auth state cleared');
    } catch (error) {
      log('Failed to clear auth state: ' + error.message);
    }
  }

  /**
   * 登出
   */
  async logout() {
    try {
      this.clearAuthState();

      Zotero.alert(
        null,
        'Researchopia 登出',
        '✅ 已成功登出\n\n您的本地认证信息已清除'
      );

      log('User logged out');
    } catch (error) {
      log('Logout failed: ' + error.message);
    }
  }
}

/**
 * 模块加载器
 */
class ModuleLoader {
  constructor(rootURI) {
    this.rootURI = rootURI;
    this.loadedModules = new Map();
  }

  /**
   * 尝试加载模块（优雅降级）
   */
  async tryLoadModule(moduleName) {
    try {
      const moduleURI = this.rootURI + `content/scripts/modules/${moduleName}.js`;
      log(`Attempting to load module: ${moduleName} from ${moduleURI}`);

      // 检查文件是否存在（简化检查）
      log(`Module URI: ${moduleURI}`);

      // 创建模块作用域
      const moduleScope = {
        Zotero: Zotero,
        rootURI: this.rootURI,
        log: log,
        Services: Services,
        // 提供Researchopia全局对象
        Researchopia: {
          log: log,
          handleError: (error, context) => {
            log(`Error in ${context}: ${error.message}`);
          }
        }
      };

      // 加载模块脚本
      Services.scriptloader.loadSubScript(moduleURI, moduleScope);

      // 获取模块类
      const className = this.getClassName(moduleName);
      const ModuleClass = moduleScope[className];

      if (!ModuleClass) {
        log(`Module class ${className} not found in ${moduleName}`);
        return null;
      }

      const moduleInstance = new ModuleClass();
      this.loadedModules.set(moduleName, moduleInstance);

      log(`✅ Module loaded successfully: ${moduleName}`);
      return moduleInstance;

    } catch (error) {
      log(`⚠️ Failed to load module ${moduleName}: ${error.message}`);
      log(`Error stack: ${error.stack}`);
      return null;
    }
  }

  /**
   * 获取类名
   */
  getClassName(moduleName) {
    return moduleName.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
  }
}

/**
 * 主插件类 - 支持模块化架构
 */
class ResearchopiaMain {
  constructor() {
    this.id = 'researchopia@zotero.plugin';
    this.version = '0.1.95';
    this.initialized = false;
    this.moduleLoader = null;
    this.modules = {};
    this.fallbackMode = false;
    this.authManager = null;
  }

  /**
   * 初始化插件
   */
  async init() {
    try {
      log("Starting modular plugin v" + this.version);

      // 等待Zotero完全加载
      await this.waitForZotero();

      // 初始化内置认证管理器
      this.authManager = new BuiltinAuthManager();
      await this.authManager.initialize();

      // 初始化模块加载器
      this.moduleLoader = new ModuleLoader(rootURI);

      // 尝试加载专业模块
      await this.loadModules();

      // 注册Item Pane
      await this.registerItemPane();

      this.initialized = true;
      log("✅ Plugin initialized successfully" + (this.fallbackMode ? " (fallback mode)" : " (full mode)"));
      log("🔍 Debug: fallbackMode = " + this.fallbackMode);
      log("🔍 Debug: authManager = " + (this.authManager ? "initialized" : "null"));

      // 显示启动消息
      this.showStartupMessage();

    } catch (error) {
      log("❌ Initialization failed: " + error.message);
      throw error;
    }
  }

  /**
   * 加载专业模块
   */
  async loadModules() {
    try {
      log("Loading professional modules...");

      // 尝试加载核心模块
      const moduleNames = [
        'simple-auth-manager',
        'annotation-manager',
        'ui-manager',
        'sync-manager'
      ];

      let loadedCount = 0;
      for (const moduleName of moduleNames) {
        const module = await this.moduleLoader.tryLoadModule(moduleName);
        if (module) {
          this.modules[moduleName] = module;
          loadedCount++;

          // 初始化模块
          if (module.initialize) {
            await module.initialize();
          }
        }
      }

      if (loadedCount === 0) {
        log("⚠️ No professional modules loaded, but we have built-in auth manager");
        // 不设置fallbackMode为true，因为我们有内置认证管理器
        this.fallbackMode = false;
      } else {
        log(`✅ Loaded ${loadedCount}/${moduleNames.length} professional modules`);
        this.fallbackMode = false;
      }

    } catch (error) {
      log("⚠️ Module loading failed, but we have built-in auth manager: " + error.message);
      // 不设置fallbackMode为true，因为我们有内置认证管理器
      this.fallbackMode = false;
    }
  }

  /**
   * 等待Zotero完全加载
   */
  async waitForZotero() {
    let attempts = 0;
    while (attempts < 50) {
      if (typeof Zotero !== 'undefined' && 
          Zotero.ItemPaneManager && 
          Zotero.ItemPaneManager.registerSection) {
        log("Zotero is ready");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("Zotero not ready after 5 seconds");
  }

  /**
   * 注册Item Pane
   */
  async registerItemPane() {
    try {
      log("Registering Item Pane...");

      await Zotero.ItemPaneManager.registerSection({
        paneID: 'researchopia-main',
        pluginID: this.id,
        header: {
          l10nID: 'researchopia-section-header',
          icon: 'chrome://zotero/skin/16/universal/note.svg'
        },
        sidenav: {
          l10nID: 'researchopia-section-header',
          icon: 'chrome://zotero/skin/20/universal/note.svg'
        },
        onRender: ({ body, item, editable, tabType }) => {
          this.renderPane(body, item, editable, tabType);
        },
        onItemChange: ({ body, item, editable, tabType }) => {
          this.renderPane(body, item, editable, tabType);
        },
        onDestroy: () => {
          log("Item Pane section destroyed");
        }
      });

      log("✅ Item Pane registered successfully");
    } catch (error) {
      log("❌ Failed to register Item Pane: " + error.message);
      throw error;
    }
  }

  /**
   * 渲染面板
   */
  renderPane(body, item, editable, tabType) {
    try {
      const doc = body.ownerDocument;
      body.innerHTML = '';

      // 创建主容器
      const container = doc.createElement('div');
      container.style.cssText = 'padding: 15px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';

      if (!item) {
        this.renderEmptyState(doc, container);
      } else {
        this.renderItemContent(doc, container, item, editable, tabType);
      }

      body.appendChild(container);

    } catch (error) {
      log("❌ Error rendering pane: " + error.message);
      body.innerHTML = '<div style="color: #dc2626; padding: 15px;">渲染错误: ' + error.message + '</div>';
    }
  }

  /**
   * 渲染空状态
   */
  renderEmptyState(doc, container) {
    const emptyState = doc.createElement('div');
    emptyState.style.cssText = 'text-align: center; padding: 40px 20px; color: #6b7280;';
    emptyState.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
      <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">研学港标注共享</div>
      <div style="font-size: 14px;">请选择一个文献项目开始使用</div>
    `;
    container.appendChild(emptyState);
  }

  /**
   * 渲染文献内容
   */
  renderItemContent(doc, container, item, editable, tabType) {
    // 创建标题
    const header = doc.createElement('div');
    header.style.cssText = 'margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;';

    const title = doc.createElement('h3');
    title.style.cssText = 'margin: 0 0 8px 0; color: #1f2937; font-size: 18px; font-weight: 600;';
    title.textContent = '研学港标注共享';

    const subtitle = doc.createElement('div');
    subtitle.style.cssText = 'color: #6b7280; font-size: 12px;';
    const modeText = this.fallbackMode ? '简化模式' : '完整模式';
    subtitle.textContent = `${modeText} | 模式: ${tabType} | 可编辑: ${editable ? '是' : '否'}`;

    header.appendChild(title);
    header.appendChild(subtitle);

    // 创建文献信息
    const itemInfo = this.createItemInfo(doc, item);

    // 创建功能按钮
    const actions = this.createActionButtons(doc, item);

    // 创建标注区域
    const annotationsArea = this.createAnnotationsArea(doc, item);

    // 组装界面
    container.appendChild(header);
    container.appendChild(itemInfo);
    container.appendChild(actions);
    container.appendChild(annotationsArea);
  }

  /**
   * 创建标注区域
   */
  createAnnotationsArea(doc, item) {
    const annotationsArea = doc.createElement('div');
    annotationsArea.style.cssText = 'margin-top: 20px;';

    if (this.fallbackMode) {
      // 简化模式
      annotationsArea.innerHTML = `
        <div style="padding: 20px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          <div style="color: #374151; font-size: 14px; font-weight: 500; margin-bottom: 8px;">📝 标注共享</div>
          <div style="color: #6b7280; font-size: 12px; margin-bottom: 12px;">简化模式运行中，正在准备完整功能...</div>
          <div style="color: #059669; font-size: 11px; background: #ecfdf5; padding: 8px; border-radius: 4px;">
            ✅ Item Pane 正常工作<br/>
            🔄 专业模块加载中<br/>
            🚀 即将支持标注共享功能
          </div>
        </div>
      `;
    } else {
      // 完整模式 - 使用内置认证管理器
      const isAuthenticated = this.authManager && this.authManager.isAuthenticated;

      if (!isAuthenticated) {
        annotationsArea.innerHTML = `
          <div style="padding: 20px; background: #fef3c7; border-radius: 8px; border: 1px solid #f59e0b;">
            <div style="color: #92400e; font-size: 14px; font-weight: 500; margin-bottom: 8px;">� 需要登录</div>
            <div style="color: #a16207; font-size: 12px; margin-bottom: 12px;">请先登录研学港账户以使用标注共享功能</div>
            <button id="researchopia-login-btn" style="padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              登录研学港
            </button>
          </div>
        `;

        // 添加登录按钮事件 - 使用DOM创建避免安全限制
        setTimeout(() => {
          this.addLoginButtons(doc, annotationsArea);
        }, 100);
      } else {
        // 已登录状态 - 创建标注提取界面
        this.createAuthenticatedInterface(doc, annotationsArea, item);
      }
    }

    return annotationsArea;
  }

  /**
   * 创建已认证界面
   */
  createAuthenticatedInterface(doc, container, item) {
    // 清空容器
    container.innerHTML = '';

    const authContainer = doc.createElement('div');
    authContainer.style.cssText = 'padding: 20px; background: #ecfdf5; border-radius: 8px; border: 1px solid #10b981;';

    // 标题
    const title = doc.createElement('div');
    title.style.cssText = 'color: #065f46; font-size: 14px; font-weight: 500; margin-bottom: 8px;';
    title.textContent = '✅ 已登录';

    // 欢迎信息
    const userName = this.authManager.currentUser ? this.authManager.currentUser.name : '用户';
    const welcome = doc.createElement('div');
    welcome.style.cssText = 'color: #047857; font-size: 12px; margin-bottom: 12px;';
    welcome.textContent = `欢迎回来，${userName}！`;

    // 标注提取区域
    const annotationSection = doc.createElement('div');
    annotationSection.style.cssText = 'margin: 12px 0; padding: 12px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;';

    const annotationTitle = doc.createElement('div');
    annotationTitle.style.cssText = 'color: #065f46; font-size: 12px; font-weight: 500; margin-bottom: 8px;';
    annotationTitle.textContent = '📝 标注提取';

    // 按钮容器
    const buttonContainer = doc.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;';

    // 提取标注按钮
    const extractBtn = doc.createElement('button');
    extractBtn.style.cssText = 'padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
    extractBtn.textContent = '提取标注';
    extractBtn.onclick = async () => {
      extractBtn.disabled = true;
      extractBtn.textContent = '提取中...';

      try {
        const annotations = await this.extractAnnotations(item);
        this.displayAnnotations(doc, annotationResults, annotations, 'local');
        extractBtn.textContent = `已提取 ${annotations.length} 条标注`;

        // 存储本地标注供上传使用
        annotationSection._localAnnotations = annotations;

        // 如果有标注，启用上传按钮
        if (annotations.length > 0) {
          uploadBtn.disabled = false;
        }
      } catch (error) {
        extractBtn.textContent = '提取失败';
        log("Annotation extraction error: " + error.message);
      }

      setTimeout(() => {
        extractBtn.disabled = false;
        extractBtn.textContent = '提取标注';
      }, 3000);
    };

    // 上传标注按钮
    const uploadBtn = doc.createElement('button');
    uploadBtn.style.cssText = 'padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
    uploadBtn.textContent = '上传共享';
    uploadBtn.disabled = true;
    uploadBtn.onclick = async () => {
      const localAnnotations = annotationSection._localAnnotations || [];
      if (localAnnotations.length === 0) {
        Zotero.alert(null, 'Researchopia', '请先提取标注');
        return;
      }

      uploadBtn.disabled = true;
      uploadBtn.textContent = '上传中...';

      try {
        const result = await this.uploadAnnotations(item, localAnnotations);
        if (result.success) {
          uploadBtn.textContent = `已上传 ${result.uploaded} 条`;
          Zotero.alert(null, 'Researchopia', `✅ 成功上传 ${result.uploaded} 条标注到研学港！`);
        } else {
          uploadBtn.textContent = '上传失败';
          Zotero.alert(null, 'Researchopia', `❌ 上传失败：${result.error}`);
        }
      } catch (error) {
        uploadBtn.textContent = '上传失败';
        log("Annotation upload error: " + error.message);
      }

      setTimeout(() => {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '上传共享';
      }, 3000);
    };

    // 获取共享标注按钮
    const fetchBtn = doc.createElement('button');
    fetchBtn.style.cssText = 'padding: 6px 12px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
    fetchBtn.textContent = '获取共享';
    fetchBtn.onclick = async () => {
      fetchBtn.disabled = true;
      fetchBtn.textContent = '获取中...';

      try {
        const sharedAnnotations = await this.fetchSharedAnnotations(item);
        this.displayAnnotations(doc, sharedResults, sharedAnnotations, 'shared');
        fetchBtn.textContent = `已获取 ${sharedAnnotations.length} 条`;
      } catch (error) {
        fetchBtn.textContent = '获取失败';
        log("Fetch shared annotations error: " + error.message);
      }

      setTimeout(() => {
        fetchBtn.disabled = false;
        fetchBtn.textContent = '获取共享';
      }, 3000);
    };

    buttonContainer.appendChild(extractBtn);
    buttonContainer.appendChild(uploadBtn);
    buttonContainer.appendChild(fetchBtn);

    // 搜索和筛选控件
    const controlsContainer = doc.createElement('div');
    controlsContainer.style.cssText = 'margin: 8px 0; padding: 8px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0;';

    // 搜索框
    const searchContainer = doc.createElement('div');
    searchContainer.style.cssText = 'display: flex; gap: 4px; margin-bottom: 6px;';

    const searchInput = doc.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜索标注内容...';
    searchInput.style.cssText = 'flex: 1; padding: 4px 6px; font-size: 10px; border: 1px solid #d1d5db; border-radius: 3px;';

    const searchBtn = doc.createElement('button');
    searchBtn.style.cssText = 'padding: 4px 8px; background: #6b7280; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;';
    searchBtn.textContent = '🔍';

    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchBtn);

    // 筛选和排序控件
    const filtersContainer = doc.createElement('div');
    filtersContainer.style.cssText = 'display: flex; gap: 6px; align-items: center; flex-wrap: wrap;';

    // 类型筛选
    const typeFilter = doc.createElement('select');
    typeFilter.style.cssText = 'padding: 2px 4px; font-size: 10px; border: 1px solid #d1d5db; border-radius: 3px;';
    typeFilter.innerHTML = `
      <option value="">所有类型</option>
      <option value="highlight">高亮</option>
      <option value="note">笔记</option>
      <option value="image">图片</option>
      <option value="ink">手绘</option>
    `;

    // 排序选择
    const sortSelect = doc.createElement('select');
    sortSelect.style.cssText = 'padding: 2px 4px; font-size: 10px; border: 1px solid #d1d5db; border-radius: 3px;';
    sortSelect.innerHTML = `
      <option value="date_desc">最新优先</option>
      <option value="date_asc">最旧优先</option>
      <option value="page_asc">页码升序</option>
      <option value="page_desc">页码降序</option>
      <option value="type">按类型</option>
    `;

    // 显示模式切换
    const viewModeContainer = doc.createElement('div');
    viewModeContainer.style.cssText = 'display: flex; gap: 2px;';

    const compactBtn = doc.createElement('button');
    compactBtn.style.cssText = 'padding: 2px 6px; background: #e5e7eb; border: 1px solid #d1d5db; border-radius: 3px; cursor: pointer; font-size: 10px;';
    compactBtn.textContent = '紧凑';

    const detailBtn = doc.createElement('button');
    detailBtn.style.cssText = 'padding: 2px 6px; background: #3b82f6; color: white; border: 1px solid #2563eb; border-radius: 3px; cursor: pointer; font-size: 10px;';
    detailBtn.textContent = '详细';

    viewModeContainer.appendChild(compactBtn);
    viewModeContainer.appendChild(detailBtn);

    filtersContainer.appendChild(doc.createTextNode('类型: '));
    filtersContainer.appendChild(typeFilter);
    filtersContainer.appendChild(doc.createTextNode(' 排序: '));
    filtersContainer.appendChild(sortSelect);
    filtersContainer.appendChild(doc.createTextNode(' 视图: '));
    filtersContainer.appendChild(viewModeContainer);

    controlsContainer.appendChild(searchContainer);
    controlsContainer.appendChild(filtersContainer);

    // 本地标注结果区域
    const localResultsHeader = doc.createElement('div');
    localResultsHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin: 8px 0 4px 0;';

    const localResultsTitle = doc.createElement('div');
    localResultsTitle.style.cssText = 'color: #065f46; font-size: 11px; font-weight: 500;';
    localResultsTitle.textContent = '📋 我的标注';

    const localCount = doc.createElement('div');
    localCount.style.cssText = 'color: #6b7280; font-size: 10px;';
    localCount.textContent = '(0)';

    localResultsHeader.appendChild(localResultsTitle);
    localResultsHeader.appendChild(localCount);

    const annotationResults = doc.createElement('div');
    annotationResults.style.cssText = 'margin-bottom: 12px; max-height: 180px; overflow-y: auto; border: 1px solid #d1fae5; border-radius: 4px; padding: 4px;';

    // 共享标注结果区域
    const sharedResultsHeader = doc.createElement('div');
    sharedResultsHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin: 8px 0 4px 0;';

    const sharedResultsTitle = doc.createElement('div');
    sharedResultsTitle.style.cssText = 'color: #7c3aed; font-size: 11px; font-weight: 500;';
    sharedResultsTitle.textContent = '🌐 共享标注';

    const sharedCount = doc.createElement('div');
    sharedCount.style.cssText = 'color: #6b7280; font-size: 10px;';
    sharedCount.textContent = '(0)';

    sharedResultsHeader.appendChild(sharedResultsTitle);
    sharedResultsHeader.appendChild(sharedCount);

    const sharedResults = doc.createElement('div');
    sharedResults.style.cssText = 'max-height: 180px; overflow-y: auto; border: 1px solid #e0e7ff; border-radius: 4px; padding: 4px;';

    annotationSection.appendChild(annotationTitle);
    annotationSection.appendChild(buttonContainer);
    annotationSection.appendChild(controlsContainer);
    annotationSection.appendChild(localResultsHeader);
    annotationSection.appendChild(annotationResults);
    annotationSection.appendChild(sharedResultsHeader);
    annotationSection.appendChild(sharedResults);

    // 存储引用供后续使用
    annotationSection._localCount = localCount;
    annotationSection._sharedCount = sharedCount;
    annotationSection._searchInput = searchInput;
    annotationSection._typeFilter = typeFilter;
    annotationSection._sortSelect = sortSelect;
    annotationSection._viewMode = 'detail'; // 'compact' or 'detail'

    // 绑定事件处理器
    this.bindAnnotationControls(doc, annotationSection, annotationResults, sharedResults, item);

    // 状态区域
    const status = doc.createElement('div');
    status.style.cssText = 'color: #059669; font-size: 11px; margin: 12px 0; padding: 8px; background: #ecfdf5; border-radius: 4px; border: 1px solid #bbf7d0;';
    status.innerHTML = '✅ 标注提取: 已激活<br/>✅ 标注上传: 已激活<br/>✅ 共享获取: 已激活<br/>🔄 实时同步: 准备中<br/>👥 社交功能: 准备中';

    // 登出按钮
    const logoutBtn = doc.createElement('button');
    logoutBtn.style.cssText = 'padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
    logoutBtn.textContent = '登出';
    logoutBtn.onclick = () => {
      if (this.authManager) {
        this.authManager.logout();
        // 触发重新渲染
        setTimeout(() => {
          try {
            if (Zotero.getActiveZoteroPane && Zotero.getActiveZoteroPane()) {
              const zoteroPane = Zotero.getActiveZoteroPane();
              if (zoteroPane.itemsView && zoteroPane.itemsView.selection) {
                const currentSelection = zoteroPane.itemsView.selection.currentIndex;
                if (currentSelection >= 0) {
                  zoteroPane.itemsView.selection.select(currentSelection);
                }
              }
            }
          } catch (refreshError) {
            log("Item Pane refresh failed: " + refreshError.message);
          }
        }, 500);
      }
    };

    // 组装界面
    authContainer.appendChild(title);
    authContainer.appendChild(welcome);
    authContainer.appendChild(annotationSection);
    authContainer.appendChild(status);
    authContainer.appendChild(logoutBtn);
    container.appendChild(authContainer);
  }

  /**
   * 显示提取的标注（更新版本，支持高级UI功能）
   */
  displayAnnotations(doc, container, annotations, type = 'local') {
    // 存储标注数据供筛选使用
    const section = container.closest('div[style*="background: #f0fdf4"]');
    if (section) {
      if (type === 'local') {
        section._localAnnotations = annotations;
        if (section._localCount) {
          section._localCount.textContent = `(${annotations.length})`;
        }
      } else {
        section._sharedAnnotations = annotations;
        if (section._sharedCount) {
          section._sharedCount.textContent = `(${annotations.length})`;
        }
      }
    }

    // 使用新的筛选显示方法
    this.filterAndDisplayAnnotations(container, annotations, type, {
      searchTerm: section && section._searchInput ? section._searchInput.value.toLowerCase().trim() : '',
      typeFilter: section && section._typeFilter ? section._typeFilter.value : '',
      sortBy: section && section._sortSelect ? section._sortSelect.value : 'date_desc',
      viewMode: section && section._viewMode ? section._viewMode : 'detail'
    });
  }

  /**
   * 绑定标注控件事件
   */
  bindAnnotationControls(doc, section, localContainer, sharedContainer, item) {
    const searchInput = section._searchInput;
    const typeFilter = section._typeFilter;
    const sortSelect = section._sortSelect;

    // 搜索功能
    const performSearch = () => {
      const searchTerm = searchInput.value.toLowerCase().trim();
      this.filterAndDisplayAnnotations(localContainer, section._localAnnotations || [], 'local', {
        searchTerm,
        typeFilter: typeFilter.value,
        sortBy: sortSelect.value,
        viewMode: section._viewMode
      });
      this.filterAndDisplayAnnotations(sharedContainer, section._sharedAnnotations || [], 'shared', {
        searchTerm,
        typeFilter: typeFilter.value,
        sortBy: sortSelect.value,
        viewMode: section._viewMode
      });
    };

    // 绑定搜索事件
    searchInput.addEventListener('input', performSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch();
      }
    });

    // 绑定筛选和排序事件
    typeFilter.addEventListener('change', performSearch);
    sortSelect.addEventListener('change', performSearch);

    // 视图模式切换
    const compactBtn = section.querySelector('button[style*="background: #e5e7eb"]');
    const detailBtn = section.querySelector('button[style*="background: #3b82f6"]');

    if (compactBtn && detailBtn) {
      compactBtn.onclick = () => {
        section._viewMode = 'compact';
        compactBtn.style.background = '#3b82f6';
        compactBtn.style.color = 'white';
        detailBtn.style.background = '#e5e7eb';
        detailBtn.style.color = 'black';
        performSearch();
      };

      detailBtn.onclick = () => {
        section._viewMode = 'detail';
        detailBtn.style.background = '#3b82f6';
        detailBtn.style.color = 'white';
        compactBtn.style.background = '#e5e7eb';
        compactBtn.style.color = 'black';
        performSearch();
      };
    }
  }

  /**
   * 筛选和显示标注
   */
  filterAndDisplayAnnotations(container, annotations, type, options = {}) {
    const { searchTerm = '', typeFilter = '', sortBy = 'date_desc', viewMode = 'detail' } = options;

    // 筛选标注
    let filteredAnnotations = annotations.filter(annotation => {
      // 类型筛选
      if (typeFilter && annotation.type !== typeFilter) {
        return false;
      }

      // 搜索筛选
      if (searchTerm) {
        const searchableText = [
          annotation.text || '',
          annotation.comment || '',
          annotation.pageLabel || '',
          ...(annotation.tags || [])
        ].join(' ').toLowerCase();

        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });

    // 排序标注
    filteredAnnotations.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.dateAdded || 0) - new Date(b.dateAdded || 0);
        case 'date_desc':
          return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
        case 'page_asc':
          return (parseInt(a.pageLabel) || 0) - (parseInt(b.pageLabel) || 0);
        case 'page_desc':
          return (parseInt(b.pageLabel) || 0) - (parseInt(a.pageLabel) || 0);
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        default:
          return 0;
      }
    });

    // 显示标注
    this.displayFilteredAnnotations(container, filteredAnnotations, type, viewMode);
  }

  /**
   * 显示筛选后的标注
   */
  displayFilteredAnnotations(container, annotations, type, viewMode) {
    container.innerHTML = '';
    const doc = container.ownerDocument;

    if (annotations.length === 0) {
      const noAnnotations = doc.createElement('div');
      noAnnotations.style.cssText = 'color: #6b7280; font-size: 11px; font-style: italic; padding: 8px; text-align: center;';
      noAnnotations.textContent = type === 'local' ? '暂无匹配的本地标注' : '暂无匹配的共享标注';
      container.appendChild(noAnnotations);
      return;
    }

    annotations.forEach((annotation, index) => {
      const annotationItem = this.createAnnotationItem(doc, annotation, type, viewMode, index);
      container.appendChild(annotationItem);
    });
  }

  /**
   * 创建标注项目元素
   */
  createAnnotationItem(doc, annotation, type, viewMode, index) {
    const isShared = annotation.isShared || type === 'shared';
    const borderColor = isShared ? '#e0e7ff' : '#d1fae5';
    const bgColor = isShared ? '#f8faff' : '#f0fdf4';

    const annotationItem = doc.createElement('div');
    annotationItem.style.cssText = `padding: ${viewMode === 'compact' ? '4px' : '6px'}; margin: 2px 0; background: ${bgColor}; border-radius: 4px; border: 1px solid ${borderColor}; font-size: ${viewMode === 'compact' ? '10px' : '11px'}; cursor: pointer; transition: opacity 0.2s;`;

    if (viewMode === 'compact') {
      // 紧凑模式：只显示基本信息
      const compactText = this.formatAnnotationForDisplay(annotation);
      annotationItem.textContent = compactText;
    } else {
      // 详细模式：显示完整信息
      const contentDiv = doc.createElement('div');

      // 主要内容
      const mainContent = doc.createElement('div');
      mainContent.textContent = this.formatAnnotationForDisplay(annotation);
      contentDiv.appendChild(mainContent);

      // 元数据
      const metaDiv = doc.createElement('div');
      metaDiv.style.cssText = 'color: #6b7280; font-size: 9px; margin-top: 2px; display: flex; gap: 8px; flex-wrap: wrap;';

      const metaItems = [];
      if (annotation.dateAdded) {
        metaItems.push(`📅 ${new Date(annotation.dateAdded).toLocaleDateString()}`);
      }
      if (annotation.tags && annotation.tags.length > 0) {
        metaItems.push(`🏷️ ${annotation.tags.slice(0, 2).join(', ')}${annotation.tags.length > 2 ? '...' : ''}`);
      }

      metaDiv.textContent = metaItems.join(' • ');
      contentDiv.appendChild(metaDiv);

      // 如果是共享标注，添加用户信息
      if (isShared && annotation.user) {
        const userInfo = doc.createElement('div');
        userInfo.style.cssText = 'color: #7c3aed; font-size: 9px; margin-top: 2px; font-style: italic;';
        userInfo.textContent = `👤 ${annotation.user.name}`;
        contentDiv.appendChild(userInfo);
      }

      annotationItem.appendChild(contentDiv);
    }

    // 添加交互事件
    annotationItem.onclick = () => {
      log(`Clicked ${type} annotation: ${annotation.id}`);
      this.showAnnotationDetails(annotation, isShared);
    };

    annotationItem.onmouseenter = () => {
      annotationItem.style.opacity = '0.8';
    };
    annotationItem.onmouseleave = () => {
      annotationItem.style.opacity = '1';
    };

    return annotationItem;
  }

  /**
   * 显示标注详细信息
   */
  showAnnotationDetails(annotation, isShared = false) {
    const details = [
      `类型: ${annotation.type}`,
      `内容: ${annotation.text || '无'}`,
      `评论: ${annotation.comment || '无'}`,
      `页码: ${annotation.pageLabel || '未知'}`,
      `颜色: ${annotation.color || '#ffd400'}`,
      `创建时间: ${annotation.dateAdded ? new Date(annotation.dateAdded).toLocaleString() : '未知'}`
    ];

    if (isShared && annotation.user) {
      details.unshift(`分享者: ${annotation.user.name}`);
    }

    if (annotation.tags && annotation.tags.length > 0) {
      details.push(`标签: ${annotation.tags.join(', ')}`);
    }

    Zotero.alert(
      null,
      `${isShared ? '共享' : '本地'}标注详情`,
      details.join('\n')
    );
  }

  /**
   * 添加登录按钮 - 使用DOM API避免安全限制
   */
  addLoginButtons(doc, container) {
    // 查找现有的按钮容器或创建新的
    const existingContainer = container.querySelector('div[style*="background: #fef3c7"]');
    if (!existingContainer) return;

    // 移除现有的不安全按钮
    const unsafeBtn = existingContainer.querySelector('button');
    if (unsafeBtn) {
      unsafeBtn.remove();
    }

    // 创建按钮容器
    const buttonContainer = doc.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';

    // 创建登录按钮
    const loginBtn = doc.createElement('button');
    loginBtn.style.cssText = 'padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';
    loginBtn.textContent = '登录研学港';
    loginBtn.onclick = () => {
      if (this.authManager) {
        this.authManager.startLogin();
      }
    };

    // 创建演示按钮
    const demoBtn = doc.createElement('button');
    demoBtn.style.cssText = 'padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';
    demoBtn.textContent = '演示模式';
    demoBtn.onclick = () => {
      this.startDemoMode();
      // 重新渲染界面
      setTimeout(() => {
        // 触发Item Pane重新渲染 - 使用正确的Zotero API
        try {
          // 方法1: 触发选中项目的重新渲染
          if (Zotero.getActiveZoteroPane && Zotero.getActiveZoteroPane()) {
            const zoteroPane = Zotero.getActiveZoteroPane();
            if (zoteroPane.itemsView && zoteroPane.itemsView.selection) {
              // 重新选择当前项目以触发Item Pane刷新
              const currentSelection = zoteroPane.itemsView.selection.currentIndex;
              if (currentSelection >= 0) {
                zoteroPane.itemsView.selection.select(currentSelection);
              }
            }
          }
        } catch (refreshError) {
          log("Item Pane refresh failed: " + refreshError.message);
        }
      }, 500);
    };

    buttonContainer.appendChild(loginBtn);
    buttonContainer.appendChild(demoBtn);
    existingContainer.appendChild(buttonContainer);
  }

  /**
   * 提取项目的标注信息
   */
  async extractAnnotations(item) {
    try {
      if (!item) {
        log("No item provided for annotation extraction");
        return [];
      }

      log("Extracting annotations for item: " + item.getDisplayTitle());

      // 获取项目的所有附件
      const attachments = await item.getAttachments();
      const annotations = [];

      for (const attachmentID of attachments) {
        const attachment = await Zotero.Items.getAsync(attachmentID);

        // 只处理PDF附件
        if (attachment && attachment.isPDFAttachment()) {
          log("Processing PDF attachment: " + attachment.getDisplayTitle());

          // 获取PDF的标注
          const pdfAnnotations = await this.extractPDFAnnotations(attachment);
          annotations.push(...pdfAnnotations);
        }
      }

      log(`Extracted ${annotations.length} annotations from item`);
      return annotations;

    } catch (error) {
      log("Annotation extraction failed: " + error.message);
      return [];
    }
  }

  /**
   * 从PDF附件中提取标注
   */
  async extractPDFAnnotations(pdfAttachment) {
    try {
      const annotations = [];

      // 获取PDF的子项目（标注）
      const childItems = pdfAttachment.getAnnotations();

      for (const annotation of childItems) {
        if (annotation.isAnnotation()) {
          const annotationData = {
            id: annotation.key,
            type: annotation.annotationType,
            text: annotation.annotationText || '',
            comment: annotation.annotationComment || '',
            color: annotation.annotationColor || '#ffd400',
            pageLabel: annotation.annotationPageLabel || '',
            position: annotation.annotationPosition || null,
            dateAdded: annotation.dateAdded,
            dateModified: annotation.dateModified,
            tags: annotation.getTags().map(tag => tag.tag),
            parentItem: {
              title: pdfAttachment.getDisplayTitle(),
              key: pdfAttachment.key
            }
          };

          annotations.push(annotationData);
        }
      }

      log(`Extracted ${annotations.length} annotations from PDF: ${pdfAttachment.getDisplayTitle()}`);
      return annotations;

    } catch (error) {
      log("PDF annotation extraction failed: " + error.message);
      return [];
    }
  }

  /**
   * 格式化标注用于显示
   */
  formatAnnotationForDisplay(annotation) {
    const typeEmoji = {
      'highlight': '🟡',
      'note': '📝',
      'image': '🖼️',
      'ink': '✏️'
    };

    const emoji = typeEmoji[annotation.type] || '📌';
    const text = annotation.text ? annotation.text.substring(0, 100) + (annotation.text.length > 100 ? '...' : '') : '';
    const comment = annotation.comment ? ` - ${annotation.comment}` : '';
    const page = annotation.pageLabel ? ` (第${annotation.pageLabel}页)` : '';

    return `${emoji} ${text}${comment}${page}`;
  }

  /**
   * 上传标注到Supabase
   */
  async uploadAnnotations(item, annotations) {
    try {
      if (!this.authManager || !this.authManager.isAuthenticated) {
        throw new Error('用户未登录');
      }

      if (annotations.length === 0) {
        log('No annotations to upload');
        return { success: true, uploaded: 0 };
      }

      log(`Uploading ${annotations.length} annotations to Supabase...`);

      // 获取文献的基本信息
      const itemInfo = this.extractItemInfo(item);
      log(`Item info: ${JSON.stringify(itemInfo)}`);

      // 准备上传数据 - 简化版本用于测试
      const uploadData = annotations.map((annotation, index) => ({
        // 基本字段
        id: `${item.key}_${index}_${Date.now()}`, // 生成唯一ID
        annotation_type: annotation.type || 'highlight',
        annotation_text: (annotation.text || '').substring(0, 1000), // 限制长度
        annotation_comment: (annotation.comment || '').substring(0, 500),
        page_label: annotation.pageLabel || '1',

        // 文献信息
        item_title: (itemInfo.title || '').substring(0, 200),
        item_doi: itemInfo.doi || null,

        // 用户信息
        user_id: this.authManager.currentUser.id || 'demo_user',
        user_name: this.authManager.currentUser.name || '演示用户',

        // 时间信息
        created_at: new Date().toISOString(),

        // 简化的位置信息
        position_data: annotation.position ? JSON.stringify({
          pageIndex: annotation.position.pageIndex || 0,
          rects: annotation.position.rects ? annotation.position.rects.slice(0, 1) : []
        }) : null
      }));

      // 调试：输出第一条数据的结构
      if (uploadData.length > 0) {
        log(`Sample upload data: ${JSON.stringify(uploadData[0], null, 2)}`);
      }

      // 调用Supabase API
      const result = await this.callSupabaseAPI('annotations', 'POST', uploadData);

      log(`Successfully uploaded ${result.data ? result.data.length : uploadData.length} annotations`);
      return { success: true, uploaded: uploadData.length };

    } catch (error) {
      log('Annotation upload failed: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 从Supabase获取共享标注
   */
  async fetchSharedAnnotations(item) {
    try {
      log('Fetching shared annotations from Supabase...');

      const itemInfo = this.extractItemInfo(item);

      // 构建查询参数
      const queryParams = [];
      if (itemInfo.doi) queryParams.push(`item_doi=eq.${encodeURIComponent(itemInfo.doi)}`);
      if (itemInfo.arxiv) queryParams.push(`item_arxiv=eq.${encodeURIComponent(itemInfo.arxiv)}`);
      if (itemInfo.pmid) queryParams.push(`item_pmid=eq.${encodeURIComponent(itemInfo.pmid)}`);
      if (itemInfo.isbn) queryParams.push(`item_isbn=eq.${encodeURIComponent(itemInfo.isbn)}`);

      if (queryParams.length === 0) {
        // 如果没有标识符，使用标题匹配
        queryParams.push(`item_title=eq.${encodeURIComponent(itemInfo.title)}`);
      }

      const query = queryParams.join('&');
      const result = await this.callSupabaseAPI(`annotations?${query}`, 'GET');

      const sharedAnnotations = result.data || [];
      log(`Fetched ${sharedAnnotations.length} shared annotations`);

      return sharedAnnotations.map(annotation => ({
        id: annotation.annotation_id,
        type: annotation.annotation_type,
        text: annotation.annotation_text,
        comment: annotation.annotation_comment,
        color: annotation.annotation_color,
        pageLabel: annotation.page_label,
        position: annotation.position_data ? JSON.parse(annotation.position_data) : null,
        dateAdded: annotation.created_at,
        dateModified: annotation.updated_at,
        tags: annotation.tags || [],
        user: {
          id: annotation.user_id,
          name: annotation.user_name
        },
        isShared: true
      }));

    } catch (error) {
      log('Fetch shared annotations failed: ' + error.message);
      return [];
    }
  }

  /**
   * 提取文献标识信息
   */
  extractItemInfo(item) {
    return {
      title: item.getDisplayTitle() || '',
      doi: item.getField('DOI') || '',
      arxiv: item.getField('archiveID') || '',
      pmid: item.getField('extra')?.match(/PMID:\s*(\d+)/)?.[1] || '',
      isbn: item.getField('ISBN') || '',
      url: item.getField('url') || ''
    };
  }

  /**
   * 调用Supabase API
   */
  async callSupabaseAPI(endpoint, method = 'GET', data = null) {
    try {
      const SUPABASE_URL = 'https://obcblvdtqhwrihoddlez.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4';

      const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // 如果用户已登录，添加用户认证
      if (this.authManager && this.authManager.isAuthenticated && this.authManager.authToken) {
        headers['Authorization'] = `Bearer ${this.authManager.authToken}`;
      } else {
        // 尝试从Supabase存储获取token
        const supabaseToken = Zotero.Prefs.get('extensions.researchopia.supabaseToken');
        if (supabaseToken) {
          headers['Authorization'] = `Bearer ${supabaseToken}`;
        }
      }

      const options = {
        method: method,
        headers: headers
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
      }

      log(`Calling Supabase API: ${method} ${url}`);

      // 使用Zotero的HTTP客户端
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);

        // 设置请求头
        Object.keys(headers).forEach(key => {
          xhr.setRequestHeader(key, headers[key]);
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const responseData = xhr.responseText ? JSON.parse(xhr.responseText) : null;
              resolve({ data: responseData, status: xhr.status });
            } catch (parseError) {
              resolve({ data: xhr.responseText, status: xhr.status });
            }
          } else {
            // 详细的错误信息
            let errorMessage = `HTTP ${xhr.status}: ${xhr.statusText}`;
            let errorDetails = '';

            try {
              if (xhr.responseText) {
                const errorData = JSON.parse(xhr.responseText);
                if (errorData.message) {
                  errorDetails = errorData.message;
                } else if (errorData.error) {
                  errorDetails = errorData.error;
                } else if (errorData.details) {
                  errorDetails = errorData.details;
                } else {
                  errorDetails = xhr.responseText;
                }
              }
            } catch (parseError) {
              errorDetails = xhr.responseText || 'Unknown error';
            }

            if (errorDetails) {
              errorMessage += ` - ${errorDetails}`;
            }

            log(`Supabase API error: ${errorMessage}`);
            reject(new Error(errorMessage));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Request timeout'));

        xhr.timeout = 30000; // 30秒超时

        if (options.body) {
          xhr.send(options.body);
        } else {
          xhr.send();
        }
      });

      return response;

    } catch (error) {
      log('Supabase API call failed: ' + error.message);
      throw error;
    }
  }

  /**
   * 初始化PDF阅读器集成
   */
  initializePDFReaderIntegration() {
    try {
      log('Initializing PDF reader integration...');

      // 监听PDF阅读器打开事件
      if (Zotero.Reader) {
        // 重写PDF阅读器的初始化方法
        const originalInit = Zotero.Reader.prototype._initReader;
        if (originalInit) {
          Zotero.Reader.prototype._initReader = function() {
            const result = originalInit.call(this);

            // 在PDF阅读器初始化后添加我们的功能
            setTimeout(() => {
              try {
                this._researchopiaIntegration = new PDFReaderIntegration(this);
                this._researchopiaIntegration.initialize();
              } catch (error) {
                log('PDF reader integration failed: ' + error.message);
              }
            }, 1000);

            return result;
          };
        }
      }

      log('PDF reader integration initialized');
    } catch (error) {
      log('PDF reader integration initialization failed: ' + error.message);
    }
  }

  /**
   * 在PDF中显示共享标注
   */
  async displaySharedAnnotationsInPDF(pdfReader, sharedAnnotations) {
    try {
      if (!pdfReader || !pdfReader._iframeWindow) {
        log('PDF reader not available');
        return;
      }

      const pdfWindow = pdfReader._iframeWindow;
      const pdfDocument = pdfWindow.document;

      // 创建共享标注覆盖层
      let overlayContainer = pdfDocument.getElementById('researchopia-shared-annotations');
      if (!overlayContainer) {
        overlayContainer = pdfDocument.createElement('div');
        overlayContainer.id = 'researchopia-shared-annotations';
        overlayContainer.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1000;
        `;
        pdfDocument.body.appendChild(overlayContainer);
      }

      // 清除现有的共享标注
      overlayContainer.innerHTML = '';

      // 为每个共享标注创建视觉标记
      sharedAnnotations.forEach((annotation, index) => {
        if (annotation.position && annotation.pageLabel) {
          this.createSharedAnnotationMarker(pdfDocument, overlayContainer, annotation, index);
        }
      });

      log(`Displayed ${sharedAnnotations.length} shared annotations in PDF`);
    } catch (error) {
      log('Display shared annotations in PDF failed: ' + error.message);
    }
  }

  /**
   * 创建共享标注标记
   */
  createSharedAnnotationMarker(pdfDocument, container, annotation, index) {
    try {
      const marker = pdfDocument.createElement('div');
      marker.className = 'researchopia-shared-marker';
      marker.style.cssText = `
        position: absolute;
        background: rgba(139, 92, 246, 0.3);
        border: 2px solid #8b5cf6;
        border-radius: 4px;
        pointer-events: auto;
        cursor: pointer;
        z-index: 1001;
        min-width: 20px;
        min-height: 20px;
      `;

      // 根据标注位置设置标记位置
      if (annotation.position) {
        try {
          const position = typeof annotation.position === 'string'
            ? JSON.parse(annotation.position)
            : annotation.position;

          if (position.rects && position.rects.length > 0) {
            const rect = position.rects[0];
            marker.style.left = `${rect[0]}px`;
            marker.style.top = `${rect[1]}px`;
            marker.style.width = `${rect[2] - rect[0]}px`;
            marker.style.height = `${rect[3] - rect[1]}px`;
          }
        } catch (posError) {
          // 如果位置解析失败，使用默认位置
          marker.style.left = `${50 + index * 30}px`;
          marker.style.top = `${50 + index * 20}px`;
          marker.style.width = '100px';
          marker.style.height = '20px';
        }
      }

      // 添加标注内容提示
      const tooltip = pdfDocument.createElement('div');
      tooltip.className = 'researchopia-tooltip';
      tooltip.style.cssText = `
        position: absolute;
        background: #1f2937;
        color: white;
        padding: 8px;
        border-radius: 4px;
        font-size: 12px;
        max-width: 300px;
        z-index: 1002;
        display: none;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      `;

      const tooltipContent = [
        `👤 ${annotation.user ? annotation.user.name : '未知用户'}`,
        `📝 ${annotation.text || '无内容'}`,
        annotation.comment ? `💬 ${annotation.comment}` : '',
        `📄 第${annotation.pageLabel}页`
      ].filter(Boolean).join('\n');

      tooltip.textContent = tooltipContent;

      // 添加交互事件
      marker.onmouseenter = () => {
        tooltip.style.display = 'block';
        tooltip.style.left = '0px';
        tooltip.style.top = '-60px';
      };

      marker.onmouseleave = () => {
        tooltip.style.display = 'none';
      };

      marker.onclick = (e) => {
        e.stopPropagation();
        this.showSharedAnnotationDetails(annotation);
      };

      marker.appendChild(tooltip);
      container.appendChild(marker);

    } catch (error) {
      log('Create shared annotation marker failed: ' + error.message);
    }
  }

  /**
   * 显示共享标注详情
   */
  showSharedAnnotationDetails(annotation) {
    const details = [
      `分享者: ${annotation.user ? annotation.user.name : '未知用户'}`,
      `类型: ${annotation.type}`,
      `内容: ${annotation.text || '无'}`,
      `评论: ${annotation.comment || '无'}`,
      `页码: ${annotation.pageLabel || '未知'}`,
      `分享时间: ${annotation.dateAdded ? new Date(annotation.dateAdded).toLocaleString() : '未知'}`
    ];

    if (annotation.tags && annotation.tags.length > 0) {
      details.push(`标签: ${annotation.tags.join(', ')}`);
    }

    Zotero.alert(
      null,
      '共享标注详情',
      details.join('\n')
    );
  }

  /**
   * 启动演示模式
   */
  startDemoMode() {
    try {
      // 创建演示用户
      const demoUser = {
        id: 'demo-user',
        name: '演示用户',
        email: 'demo@researchopia.com',
        avatar: null
      };

      // 设置演示认证状态
      this.authManager.currentUser = demoUser;
      this.authManager.authToken = 'demo-token-' + Date.now();
      this.authManager.isAuthenticated = true;

      // 保存演示状态
      this.authManager.saveAuthState();

      Zotero.alert(
        null,
        'Researchopia 演示模式',
        '🎭 演示模式已启动！\n\n您现在可以体验标注共享功能\n注意：这只是演示，不会连接到真实服务器'
      );

      log('Demo mode activated');

    } catch (error) {
      log('Failed to start demo mode: ' + error.message);
      Zotero.alert(null, 'Researchopia 演示模式', '❌ 启动演示模式失败: ' + error.message);
    }
  }

  /**
   * 创建文献信息
   */
  createItemInfo(doc, item) {
    const infoContainer = doc.createElement('div');
    infoContainer.style.cssText = 'margin-bottom: 15px;';

    const doi = item.getField('DOI');
    const title = item.getField('title') || 'Unknown Title';
    const authors = item.getCreators().map(c => c.firstName + ' ' + c.lastName).join(', ');

    const infoHTML = `
      <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border: 1px solid #0ea5e9;">
        <div style="color: #0369a1; font-size: 14px; font-weight: 500; margin-bottom: 8px;">📄 文献信息</div>
        <div style="color: #0284c7; font-size: 12px; line-height: 1.5;">
          <div style="margin-bottom: 4px;"><strong>标题:</strong> ${title.substring(0, 80)}${title.length > 80 ? '...' : ''}</div>
          ${authors ? `<div style="margin-bottom: 4px;"><strong>作者:</strong> ${authors.substring(0, 60)}${authors.length > 60 ? '...' : ''}</div>` : ''}
          <div><strong>DOI:</strong> ${doi || '无'}</div>
        </div>
      </div>
    `;

    infoContainer.innerHTML = infoHTML;
    return infoContainer;
  }

  /**
   * 创建功能按钮
   */
  createActionButtons(doc, item) {
    const buttonContainer = doc.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';

    // 测试按钮
    const testBtn = this.createButton(doc, '测试连接', '#3b82f6', () => {
      Zotero.alert(null, 'Researchopia', '🎉 Item Pane 工作正常！\n\n准备开始标注共享功能开发...');
    });

    // 访问网站按钮
    const websiteBtn = this.createButton(doc, '访问研学港', '#10b981', () => {
      Zotero.launchURL('https://www.researchopia.com/');
    });

    buttonContainer.appendChild(testBtn);
    buttonContainer.appendChild(websiteBtn);

    return buttonContainer;
  }

  /**
   * 创建按钮
   */
  createButton(doc, text, color, onClick) {
    const button = doc.createElement('button');
    button.style.cssText = `
      padding: 10px 16px;
      background: ${color};
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: opacity 0.2s;
    `;
    button.textContent = text;
    button.onclick = onClick;

    // 添加悬停效果
    button.onmouseenter = () => button.style.opacity = '0.8';
    button.onmouseleave = () => button.style.opacity = '1';

    return button;
  }

  /**
   * 显示启动消息
   */
  showStartupMessage() {
    setTimeout(() => {
      try {
        Zotero.alert(
          null,
          'Researchopia v' + this.version,
          '🎉 研学港插件已启动！\n✨ 基础架构优化完成！\n\n📋 请选择一个文献项目开始使用\n� 准备开始标注共享功能开发\n📖 完全兼容Zotero 8 Beta'
        );
      } catch (alertError) {
        log("Alert failed: " + alertError.message);
      }
    }, 1000);
  }

  /**
   * 插件关闭
   */
  async shutdown() {
    try {
      log("Shutting down minimal plugin...");
      this.initialized = false;
      log("Minimal plugin shutdown completed");
    } catch (error) {
      log("Shutdown failed: " + error.message);
    }
  }
}

/**
 * PDF阅读器集成类
 */
class PDFReaderIntegration {
  constructor(pdfReader) {
    this.pdfReader = pdfReader;
    this.sharedAnnotations = [];
    this.isInitialized = false;
  }

  /**
   * 初始化PDF阅读器集成
   */
  async initialize() {
    try {
      log('Initializing PDF reader integration for: ' + (this.pdfReader._item ? this.pdfReader._item.getDisplayTitle() : 'Unknown'));

      // 等待PDF完全加载
      await this.waitForPDFLoad();

      // 创建控制面板
      this.createControlPanel();

      // 自动加载共享标注
      await this.loadSharedAnnotations();

      this.isInitialized = true;
      log('PDF reader integration initialized successfully');

    } catch (error) {
      log('PDF reader integration initialization failed: ' + error.message);
    }
  }

  /**
   * 等待PDF加载完成
   */
  async waitForPDFLoad() {
    return new Promise((resolve) => {
      const checkLoad = () => {
        if (this.pdfReader._iframeWindow && this.pdfReader._iframeWindow.document.readyState === 'complete') {
          setTimeout(resolve, 500); // 额外等待500ms确保完全加载
        } else {
          setTimeout(checkLoad, 100);
        }
      };
      checkLoad();
    });
  }

  /**
   * 创建控制面板
   */
  createControlPanel() {
    try {
      const pdfWindow = this.pdfReader._iframeWindow;
      const pdfDocument = pdfWindow.document;

      // 检查是否已存在控制面板
      let controlPanel = pdfDocument.getElementById('researchopia-pdf-controls');
      if (controlPanel) {
        controlPanel.remove();
      }

      // 创建控制面板
      controlPanel = pdfDocument.createElement('div');
      controlPanel.id = 'researchopia-pdf-controls';
      controlPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 2000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
      `;

      // 标题
      const title = pdfDocument.createElement('div');
      title.style.cssText = 'font-weight: 500; margin-bottom: 6px; color: #374151;';
      title.textContent = '🌐 研学港共享标注';

      // 按钮容器
      const buttonContainer = pdfDocument.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 4px; margin-bottom: 6px;';

      // 加载共享标注按钮
      const loadBtn = pdfDocument.createElement('button');
      loadBtn.style.cssText = 'padding: 4px 8px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
      loadBtn.textContent = '加载共享';
      loadBtn.onclick = () => this.loadSharedAnnotations();

      // 切换显示按钮
      const toggleBtn = pdfDocument.createElement('button');
      toggleBtn.style.cssText = 'padding: 4px 8px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
      toggleBtn.textContent = '显示/隐藏';
      toggleBtn.onclick = () => this.toggleSharedAnnotations();

      // 状态显示
      const status = pdfDocument.createElement('div');
      status.id = 'researchopia-pdf-status';
      status.style.cssText = 'color: #6b7280; font-size: 10px;';
      status.textContent = '准备就绪';

      buttonContainer.appendChild(loadBtn);
      buttonContainer.appendChild(toggleBtn);
      controlPanel.appendChild(title);
      controlPanel.appendChild(buttonContainer);
      controlPanel.appendChild(status);

      pdfDocument.body.appendChild(controlPanel);

    } catch (error) {
      log('Create PDF control panel failed: ' + error.message);
    }
  }

  /**
   * 加载共享标注
   */
  async loadSharedAnnotations() {
    try {
      const statusEl = this.pdfReader._iframeWindow.document.getElementById('researchopia-pdf-status');
      if (statusEl) statusEl.textContent = '加载中...';

      // 获取当前PDF对应的文献项目
      const item = this.pdfReader._item;
      if (!item) {
        if (statusEl) statusEl.textContent = '无法获取文献信息';
        return;
      }

      // 获取主插件实例
      const mainPlugin = globalThis.researchopiaPlugin;
      if (!mainPlugin) {
        if (statusEl) statusEl.textContent = '插件未初始化';
        return;
      }

      // 获取共享标注
      this.sharedAnnotations = await mainPlugin.fetchSharedAnnotations(item);

      // 显示共享标注
      await this.displaySharedAnnotations();

      if (statusEl) {
        statusEl.textContent = `已加载 ${this.sharedAnnotations.length} 条共享标注`;
      }

    } catch (error) {
      log('Load shared annotations in PDF failed: ' + error.message);
      const statusEl = this.pdfReader._iframeWindow.document.getElementById('researchopia-pdf-status');
      if (statusEl) statusEl.textContent = '加载失败';
    }
  }

  /**
   * 显示共享标注
   */
  async displaySharedAnnotations() {
    try {
      const mainPlugin = globalThis.researchopiaPlugin;
      if (mainPlugin) {
        await mainPlugin.displaySharedAnnotationsInPDF(this.pdfReader, this.sharedAnnotations);
      }
    } catch (error) {
      log('Display shared annotations failed: ' + error.message);
    }
  }

  /**
   * 切换共享标注显示
   */
  toggleSharedAnnotations() {
    try {
      const pdfDocument = this.pdfReader._iframeWindow.document;
      const overlayContainer = pdfDocument.getElementById('researchopia-shared-annotations');

      if (overlayContainer) {
        const isVisible = overlayContainer.style.display !== 'none';
        overlayContainer.style.display = isVisible ? 'none' : 'block';

        const statusEl = pdfDocument.getElementById('researchopia-pdf-status');
        if (statusEl) {
          statusEl.textContent = isVisible ? '共享标注已隐藏' : '共享标注已显示';
        }
      }
    } catch (error) {
      log('Toggle shared annotations failed: ' + error.message);
    }
  }
}

/**
 * 插件启动函数
 */
async function startup({ id, version, resourceURI, rootURI: pluginRootURI }) {
  try {
    // 设置全局变量
    rootURI = pluginRootURI;
    
    log("Starting up minimal plugin...");
    log("Plugin ID: " + id);
    log("Plugin Version: " + version);
    
    // 创建插件实例
    researchopiaPluginInstance = new ResearchopiaMain();

    // 初始化插件
    await researchopiaPluginInstance.init();

    // 设置全局引用供PDF阅读器集成使用
    globalThis.researchopiaPlugin = researchopiaPluginInstance;

    // 初始化PDF阅读器集成
    researchopiaPluginInstance.initializePDFReaderIntegration();

    log('Plugin startup completed successfully with PDF integration');
    
  } catch (error) {
    log("Startup failed: " + error.message);
    throw error;
  }
}

/**
 * 插件关闭函数
 */
async function shutdown() {
  try {
    if (researchopiaPluginInstance) {
      await researchopiaPluginInstance.shutdown();
      researchopiaPluginInstance = null;
    }
  } catch (error) {
    log("Shutdown failed: " + error.message);
  }
}
