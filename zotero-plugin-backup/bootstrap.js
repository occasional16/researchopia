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
 * Supabase配置管理器
 * 统一管理Supabase配置，与.env.local保持一致
 */
class SupabaseConfig {
  static getConfig() {
    // 这些配置应该与.env.local文件中的配置保持一致
    return {
      url: 'https://obcblvdtqhwrihoddlez.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4',
      serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ5ODIzNSwiZXhwIjoyMDczMDc0MjM1fQ.ywlXk4IOZ-eyGhJXmVve-zSNHo5fUnOK0fwJf32EjCE'
    };
  }

  static getAuthUrl() {
    const config = this.getConfig();
    return `${config.url}/auth/v1/token?grant_type=password`;
  }

  static getUserUrl() {
    const config = this.getConfig();
    return `${config.url}/auth/v1/user`;
  }

  static getRestUrl(endpoint) {
    const config = this.getConfig();
    return `${config.url}/rest/v1/${endpoint}`;
  }
}

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
      const savedUserInfo = Zotero.Prefs.get('extensions.researchopia.userInfo', '');

      log('Attempting to restore auth state...');
      log('Saved token: ' + (savedToken ? 'exists' : 'none'));
      log('Saved user info: ' + (savedUserInfo ? 'exists' : 'none'));

      if (savedToken && savedUserInfo) {
        this.authToken = savedToken;
        try {
          this.currentUser = JSON.parse(savedUserInfo);
          this.isAuthenticated = true;

          log('✅ Auth state restored successfully: ' + (this.currentUser.name || this.currentUser.email));
          log('🔍 User info: ' + JSON.stringify(this.currentUser));

          // 刷新UI以反映登录状态
          setTimeout(() => {
            if (Zotero && Zotero.ResearchopiaPlugin && Zotero.ResearchopiaPlugin.refreshUI) {
              Zotero.ResearchopiaPlugin.refreshUI();
              log('🔄 UI refreshed after auth state restoration');
            }
          }, 1000);
        } catch (parseError) {
          log('❌ Failed to parse saved user info: ' + parseError.message);
          // 清除无效的用户数据
          this.clearAuthState();
        }
      } else {
        log('ℹ️ No saved auth state found');
        this.isAuthenticated = false;
        this.currentUser = null;
        this.authToken = null;
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
   * Supabase认证系统 - 基于Zotero.HTTP API的简化实现
   */
  async showInternalLoginForm() {
    try {
      log('Starting Zotero-native Supabase authentication...');

      // 检查现有token
      const existingToken = Zotero.Prefs.get('extensions.researchopia.authToken');
      if (existingToken && await this.validateSupabaseToken(existingToken)) {
        log('Using existing valid token');
        this.isAuthenticated = true;
        this.authToken = existingToken;

        // 获取用户信息
        const userInfo = await this.getSupabaseUserInfo(existingToken);
        if (userInfo) {
          this.currentUser = userInfo;
          this.refreshUI();
          return;
        }
      }

      // 需要重新登录
      const credentials = await this.promptForCredentials();
      if (!credentials) {
        log('User cancelled login');
        return;
      }

      // 使用Zotero.HTTP API进行Supabase认证
      await this.authenticateWithSupabaseHTTP(credentials.email, credentials.password);

    } catch (error) {
      log('Supabase authentication failed: ' + error.message);

      // 显示用户友好的错误信息
      Zotero.alert(
        null,
        'Researchopia 登录失败',
        '❌ 登录失败：' + error.message + '\n\n请检查您的邮箱和密码是否正确。'
      );

      throw error;
    }
  }

  /**
   * 使用Zotero.HTTP API进行Supabase认证
   */
  async authenticateWithSupabaseHTTP(email, password) {
    try {
      log('Authenticating with Supabase using Zotero.HTTP...');

      // 使用统一的Supabase配置管理器
      const config = SupabaseConfig.getConfig();
      const authUrl = SupabaseConfig.getAuthUrl();

      // 使用Zotero.HTTP.request调用Supabase API
      const response = await Zotero.HTTP.request(
        'POST',
        authUrl,
        {
          headers: {
            'apikey': config.anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email,
            password: password
          }),
          responseType: 'json'
        }
      );

      if (response.status >= 200 && response.status < 300 && response.response) {
        const authData = response.response;

        if (authData.access_token && authData.user) {
          // 认证成功，保存用户信息和token
          const user = {
            id: authData.user.id,
            name: authData.user.user_metadata?.username || authData.user.email?.split('@')[0] || '用户',
            email: authData.user.email
          };

          this.isAuthenticated = true;
          this.currentUser = user;
          this.authToken = authData.access_token;

          // 保存到Zotero偏好设置
          Zotero.Prefs.set('extensions.researchopia.authToken', authData.access_token);
          Zotero.Prefs.set('extensions.researchopia.userInfo', JSON.stringify(user));

          log('Supabase authentication successful via Zotero.HTTP!');

          Zotero.alert(
            null,
            'Researchopia 登录',
            '✅ 登录成功！\n\n欢迎回来，' + user.name + '！\n标注共享功能现已可用。'
          );

          // 刷新UI
          this.refreshUI();
        } else {
          throw new Error('Invalid authentication response format');
        }
      } else {
        // 根据HTTP状态码和响应内容提供友好的错误消息
        let errorMessage = '登录失败';

        if (response.status === 400) {
          if (response.response && response.response.error_description) {
            const desc = response.response.error_description.toLowerCase();
            if (desc.includes('invalid') && desc.includes('credentials')) {
              errorMessage = '邮箱或密码错误，请检查后重试';
            } else if (desc.includes('email')) {
              errorMessage = '邮箱格式不正确';
            } else if (desc.includes('password')) {
              errorMessage = '密码格式不正确';
            } else {
              errorMessage = '输入信息有误，请检查邮箱和密码';
            }
          } else {
            errorMessage = '输入信息有误，请检查邮箱和密码';
          }
        } else if (response.status === 401) {
          errorMessage = '邮箱或密码错误，请检查后重试';
        } else if (response.status === 403) {
          errorMessage = '账户被禁用或无权限访问';
        } else if (response.status === 429) {
          errorMessage = '登录尝试过于频繁，请稍后再试';
        } else if (response.status >= 500) {
          errorMessage = '服务器暂时不可用，请稍后再试';
        } else if (response.response && response.response.error_description) {
          errorMessage = response.response.error_description;
        } else if (response.response && response.response.message) {
          errorMessage = response.response.message;
        } else {
          errorMessage = `登录失败 (错误代码: ${response.status})`;
        }

        throw new Error(errorMessage);
      }

    } catch (error) {
      log('Supabase HTTP authentication failed: ' + error.message);

      // 处理网络错误和其他异常
      let friendlyMessage = error.message;

      if (error.message.includes('NetworkError') || error.message.includes('network')) {
        friendlyMessage = '网络连接失败，请检查网络设置后重试';
      } else if (error.message.includes('timeout')) {
        friendlyMessage = '连接超时，请检查网络后重试';
      } else if (error.message.includes('DNS') || error.message.includes('resolve')) {
        friendlyMessage = '无法连接到服务器，请检查网络设置';
      } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
        friendlyMessage = '安全连接失败，请检查系统时间和网络设置';
      }

      throw new Error(friendlyMessage);
    }
  }

  /**
   * 验证Supabase token有效性
   */
  async validateSupabaseToken(token) {
    try {
      log('Validating Supabase token...');

      // 使用统一的Supabase配置管理器
      const config = SupabaseConfig.getConfig();
      const userUrl = SupabaseConfig.getUserUrl();

      const response = await Zotero.HTTP.request(
        'GET',
        userUrl,
        {
          headers: {
            'apikey': config.anonKey,
            'Authorization': 'Bearer ' + token
          },
          responseType: 'json'
        }
      );

      if (response.status === 200 && response.response) {
        log('Token validation successful');
        return true;
      } else {
        log('Token validation failed: ' + response.status);
        return false;
      }
    } catch (error) {
      log('Token validation error: ' + error.message);
      return false;
    }
  }

  /**
   * 获取Supabase用户信息
   */
  async getSupabaseUserInfo(token) {
    try {
      log('Getting Supabase user info...');

      const response = await Zotero.HTTP.request(
        'GET',
        'https://obcblvdtqhwrihoddlez.supabase.co/auth/v1/user',
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4',
            'Authorization': 'Bearer ' + token
          },
          responseType: 'json'
        }
      );

      if (response.status === 200 && response.response) {
        const userData = response.response;
        const user = {
          id: userData.id,
          name: userData.user_metadata?.username || userData.email?.split('@')[0] || '用户',
          email: userData.email
        };

        log('User info retrieved successfully');
        return user;
      } else {
        log('Failed to get user info: ' + response.status);
        return null;
      }
    } catch (error) {
      log('Get user info error: ' + error.message);
      return null;
    }
  }

  /**
   * 选择登录方式 - Mozilla标准版本
   */
  async chooseLoginMethod() {
    try {
      log('Showing Mozilla-standard login method selection...');

      // 使用Services.prompt的多选对话框
      const prompts = Services.prompt;
      const selected = {};

      const result = prompts.select(
        null,
        'Researchopia 登录方式',
        '🔐 请选择最适合的登录方式：\n\n' +
        '• 密码管理器 - 使用Firefox保存的密码（推荐）\n' +
        '• 安全输入 - 使用系统安全对话框\n' +
        '• HTML界面 - 在浏览器中输入\n' +
        '• 测试账户 - 快速体验功能',
        4,
        ['密码管理器（推荐）', '安全输入', 'HTML界面', '测试账户'],
        selected
      );

      if (!result) {
        log('User cancelled login method selection');
        return null;
      }

      const methods = ['password-manager', 'secure-prompt', 'html', 'test'];
      const selectedMethod = methods[selected.value];

      log('User selected login method: ' + selectedMethod);
      return selectedMethod;

    } catch (error) {
      log('Choose login method failed: ' + error.message);
      // 回退到HTML登录
      return 'html';
    }
  }

  /**
   * 使用Firefox密码管理器
   */
  async usePasswordManager() {
    try {
      log('Attempting to use Firefox Password Manager...');

      // 获取nsILoginManager服务
      const loginManager = Services.logins;

      // 查找保存的登录信息
      const hostname = 'https://researchopia.com';
      const logins = loginManager.findLogins(hostname, '', null);

      if (logins.length > 0) {
        // 找到保存的登录信息
        const login = logins[0];
        log('Found saved credentials in Password Manager');

        return {
          email: login.username,
          password: login.password
        };
      } else {
        // 没有保存的登录信息，提示用户输入并保存
        log('No saved credentials found, prompting for new credentials...');

        const credentials = await this.promptForCredentials();

        if (credentials) {
          // 保存到密码管理器
          const loginInfo = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                                      .createInstance(Components.interfaces.nsILoginInfo);

          loginInfo.init(hostname, '', null, credentials.email, credentials.password, '', '');

          try {
            loginManager.addLogin(loginInfo);
            log('Credentials saved to Password Manager');
          } catch (e) {
            log('Failed to save credentials: ' + e.message);
          }
        }

        return credentials;
      }

    } catch (error) {
      log('Password Manager failed: ' + error.message);
      // 回退到安全输入
      return await this.useSecurePrompt();
    }
  }

  /**
   * 使用安全输入对话框
   */
  async useSecurePrompt() {
    try {
      log('Using secure prompt for credentials...');
      return await this.promptForCredentials();
    } catch (error) {
      log('Secure prompt failed: ' + error.message);
      return null;
    }
  }

  /**
   * 提示用户输入凭据
   */
  async promptForCredentials() {
    try {
      const prompts = Services.prompt;

      // 输入邮箱
      const emailInput = { value: '' };
      const emailResult = prompts.prompt(
        null,
        'Researchopia 登录',
        '请输入您的研学港邮箱地址：',
        emailInput,
        null,
        {}
      );

      if (!emailResult || !emailInput.value) {
        return null;
      }

      // 输入密码
      const passwordInput = { value: '' };
      const passwordResult = prompts.promptPassword(
        null,
        'Researchopia 登录',
        '请输入您的研学港密码：',
        passwordInput,
        null,
        {}
      );

      if (!passwordResult || !passwordInput.value) {
        return null;
      }

      return {
        email: emailInput.value,
        password: passwordInput.value
      };

    } catch (error) {
      log('Prompt for credentials failed: ' + error.message);
      return null;
    }
  }





  /**
   * 直接调用Supabase认证API - 支持多种认证方式
   */
  async authenticateWithSupabase(email, password, existingToken = null, existingUser = null) {
    try {
      log('Authenticating with Supabase API...');

      // 如果已有token和用户信息（来自HTML登录），直接使用
      if (existingToken && existingUser) {
        log('Using existing token from HTML login');

        this.isAuthenticated = true;
        this.currentUser = existingUser;
        this.authToken = existingToken;

        // 保存认证状态
        await this.saveSupabaseAuthState(existingUser, existingToken);
        await this.saveAuthState();

        log('HTML login authentication successful!');

        Zotero.alert(
          null,
          'Researchopia 登录',
          '✅ 登录成功！\n\n欢迎回来，' + existingUser.name + '！\n标注共享功能现已可用。'
        );

        // 刷新UI
        this.refreshUI();
        return;
      }

      // 传统密码认证
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
   * 显示HTML登录表单 - 全新实现
   */
  async showHTMLLoginForm() {
    try {
      log('Starting HTML login form...');

      // 创建临时HTML文件
      const htmlContent = this.createLoginHTML();
      const tempFile = await this.createTempHTMLFile(htmlContent);

      if (!tempFile) {
        log('Failed to create temp HTML file, falling back to prompt');
        return await this.fallbackToPromptLogin();
      }

      // 打开HTML登录页面
      const fileURI = 'file:///' + tempFile.path.replace(/\\/g, '/');
      log('Opening login HTML at: ' + fileURI);

      Zotero.launchURL(fileURI);

      // 显示说明
      Zotero.alert(
        null,
        'Researchopia HTML登录',
        '🌐 登录页面已在浏览器中打开\n\n' +
        '请在浏览器中：\n' +
        '1️⃣ 输入您的研学港邮箱和密码\n' +
        '2️⃣ 点击"登录"按钮\n' +
        '3️⃣ 复制显示的认证信息\n' +
        '4️⃣ 返回此对话框粘贴\n\n' +
        '点击"确定"继续...'
      );

      // 获取用户粘贴的认证信息
      const authData = await this.getAuthDataFromUser();

      // 清理临时文件
      try {
        tempFile.remove(false);
      } catch (e) {
        log('Failed to remove temp file: ' + e.message);
      }

      return authData;

    } catch (error) {
      log('HTML login form failed: ' + error.message);
      return await this.fallbackToPromptLogin();
    }
  }

  /**
   * 创建登录HTML内容
   */
  createLoginHTML() {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Researchopia 登录</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 400px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .login-container {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo h1 {
            color: #333;
            margin: 0;
            font-size: 24px;
        }
        .logo p {
            color: #666;
            margin: 5px 0 0 0;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            color: #333;
            font-weight: 500;
        }
        input[type="email"], input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 6px;
            font-size: 16px;
            transition: border-color 0.3s;
            box-sizing: border-box;
        }
        input[type="email"]:focus, input[type="password"]:focus {
            outline: none;
            border-color: #667eea;
        }
        .login-btn {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.3s;
        }
        .login-btn:hover {
            background: #5a6fd8;
        }
        .login-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 6px;
            display: none;
        }
        .result.success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .result.error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .auth-data {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            word-break: break-all;
            margin-top: 10px;
        }
        .copy-btn {
            margin-top: 10px;
            padding: 8px 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .instructions {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 14px;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>🔐 Researchopia</h1>
            <p>研学港账户登录</p>
        </div>

        <div class="instructions">
            <strong>📋 使用说明：</strong><br>
            1. 输入您的研学港邮箱和密码<br>
            2. 点击登录按钮<br>
            3. 复制下方显示的认证信息<br>
            4. 返回Zotero粘贴认证信息
        </div>

        <form id="loginForm">
            <div class="form-group">
                <label for="email">📧 邮箱地址</label>
                <input type="email" id="email" name="email" required placeholder="your.email@university.edu">
            </div>

            <div class="form-group">
                <label for="password">🔒 密码</label>
                <input type="password" id="password" name="password" required placeholder="请输入密码">
            </div>

            <button type="submit" class="login-btn" id="loginBtn">登录研学港</button>
        </form>

        <div id="result" class="result">
            <div id="resultMessage"></div>
            <div id="authData" class="auth-data" style="display: none;"></div>
            <button id="copyBtn" class="copy-btn" style="display: none;" onclick="copyAuthData()">复制认证信息</button>
        </div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const loginBtn = document.getElementById('loginBtn');
            const result = document.getElementById('result');
            const resultMessage = document.getElementById('resultMessage');
            const authData = document.getElementById('authData');
            const copyBtn = document.getElementById('copyBtn');

            if (!email || !password) {
                showResult('error', '请输入邮箱和密码');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.textContent = '登录中...';

            try {
                const response = await fetch('https://obcblvdtqhwrihoddlez.supabase.co/auth/v1/token?grant_type=password', {
                    method: 'POST',
                    headers: {
                        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok && data.access_token) {
                    const authInfo = {
                        email: email,
                        token: data.access_token,
                        user: {
                            id: data.user.id,
                            name: data.user.user_metadata?.username || data.user.email?.split('@')[0] || '用户',
                            email: data.user.email
                        }
                    };

                    const authString = JSON.stringify(authInfo);
                    authData.textContent = authString;
                    authData.style.display = 'block';
                    copyBtn.style.display = 'inline-block';

                    showResult('success', '✅ 登录成功！请复制下方的认证信息，然后返回Zotero粘贴。');
                } else {
                    let errorMsg = '登录失败';
                    if (data.error_description) {
                        if (data.error_description.includes('Invalid login credentials')) {
                            errorMsg = '邮箱或密码错误';
                        } else if (data.error_description.includes('Email not confirmed')) {
                            errorMsg = '请先验证您的邮箱';
                        } else {
                            errorMsg = data.error_description;
                        }
                    }
                    showResult('error', '❌ ' + errorMsg);
                }
            } catch (error) {
                showResult('error', '❌ 网络错误：' + error.message);
            }

            loginBtn.disabled = false;
            loginBtn.textContent = '登录研学港';
        });

        function showResult(type, message) {
            const result = document.getElementById('result');
            const resultMessage = document.getElementById('resultMessage');

            result.className = 'result ' + type;
            result.style.display = 'block';
            resultMessage.innerHTML = message;
        }

        function copyAuthData() {
            const authData = document.getElementById('authData');
            navigator.clipboard.writeText(authData.textContent).then(() => {
                const copyBtn = document.getElementById('copyBtn');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '已复制！';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            });
        }
    </script>
</body>
</html>`;
  }

  /**
   * 创建登录对话框 - 大幅改进版本
   */
  createLoginDialog() {
    try {
      return {
        getCredentials: () => {
          log('Starting improved login dialog...');

          // 第一步：显示登录说明并获取确认
          const proceed = Zotero.alert(
            null,
            'Researchopia 登录',
            '🔐 登录研学港账户\n\n' +
            '接下来将分两步输入您的账户信息：\n' +
            '1️⃣ 输入注册邮箱地址\n' +
            '2️⃣ 输入账户密码\n\n' +
            '💡 提示：请确保您已注册研学港账户',
            2, // 显示两个按钮
            '开始登录',
            '取消'
          );

          if (proceed !== 0) {
            log('User cancelled login at intro step');
            return null;
          }

          // 第二步：获取邮箱地址
          log('Prompting for email...');
          const email = this.getEmailInput();
          if (!email) {
            log('Email input failed or cancelled');
            return null;
          }

          // 第三步：获取密码
          log('Prompting for password...');
          const password = this.getPasswordInput();
          if (!password) {
            log('Password input failed or cancelled');
            return null;
          }

          log('Login credentials collected successfully');
          return { email: email.trim(), password: password.trim() };
        }
      };
    } catch (error) {
      log('Create login dialog failed: ' + error.message);
      throw error;
    }
  }

  /**
   * 创建临时HTML文件
   */
  async createTempHTMLFile(htmlContent) {
    try {
      const tempDir = Zotero.getTempDirectory();
      const tempFile = tempDir.clone();
      tempFile.append('researchopia_login_' + Date.now() + '.html');

      await Zotero.File.putContentsAsync(tempFile, htmlContent);

      log('Created temp HTML file: ' + tempFile.path);
      return tempFile;
    } catch (error) {
      log('Failed to create temp HTML file: ' + error.message);
      return null;
    }
  }

  /**
   * 从用户获取认证数据
   */
  async getAuthDataFromUser() {
    try {
      // 使用Services.prompt获取用户粘贴的认证信息
      if (typeof Services !== 'undefined' && Services.prompt) {
        const result = { value: '' };
        const success = Services.prompt.prompt(
          null,
          'Researchopia 认证信息',
          '📋 请粘贴从浏览器复制的认证信息：\n\n' +
          '(应该是一段JSON格式的文本)',
          result,
          null,
          {}
        );

        if (success && result.value && result.value.trim()) {
          try {
            const authData = JSON.parse(result.value.trim());
            if (authData.email && authData.token && authData.user) {
              log('Valid auth data received from user');
              return {
                email: authData.email,
                password: 'html-login-token', // 占位符，实际使用token
                token: authData.token,
                user: authData.user
              };
            }
          } catch (parseError) {
            log('Failed to parse auth data: ' + parseError.message);
          }
        }
      }

      // 备用方案：使用alert引导
      Zotero.alert(
        null,
        'Researchopia 认证信息',
        '❌ 无法获取认证信息\n\n' +
        '请确保：\n' +
        '1. 在浏览器中成功登录\n' +
        '2. 复制了完整的认证信息\n' +
        '3. 认证信息格式正确\n\n' +
        '建议使用其他登录方式'
      );

      return null;
    } catch (error) {
      log('Get auth data from user failed: ' + error.message);
      return null;
    }
  }

  /**
   * 回退到提示登录
   */
  async fallbackToPromptLogin() {
    try {
      log('Falling back to prompt login...');

      const loginDialog = this.createLoginDialog();
      const result = await this.showLoginDialog(loginDialog);

      if (result.success) {
        return { email: result.email, password: result.password };
      }

      return null;
    } catch (error) {
      log('Fallback to prompt login failed: ' + error.message);
      return null;
    }
  }

  /**
   * 获取邮箱输入 - 多种方法尝试
   */
  getEmailInput() {
    try {
      log('Attempting to get email input...');

      // 方法1: 尝试使用Services.prompt
      if (typeof Services !== 'undefined' && Services.prompt) {
        const result = { value: '' };
        const success = Services.prompt.prompt(
          null,
          'Researchopia 登录',
          '📧 请输入您的研学港邮箱地址：\n\n例如：your.email@university.edu',
          result,
          null,
          {}
        );

        if (success && result.value && result.value.trim()) {
          log('Email obtained via Services.prompt: ' + result.value.trim());
          return result.value.trim();
        }
      }

      // 方法2: 使用Zotero.prompt (如果可用)
      if (typeof Zotero.prompt === 'function') {
        const email = Zotero.prompt(
          'Researchopia 登录',
          '📧 请输入您的研学港邮箱地址：\n\n例如：your.email@university.edu',
          ''
        );

        if (email && email.trim()) {
          log('Email obtained via Zotero.prompt: ' + email.trim());
          return email.trim();
        }
      }

      // 方法3: 使用简化的alert方式引导用户
      const proceed = Zotero.alert(
        null,
        'Researchopia 登录',
        '📧 邮箱输入\n\n' +
        '由于技术限制，请使用以下方式之一输入邮箱：\n\n' +
        '方式1：在下一个对话框中手动输入\n' +
        '方式2：使用测试邮箱（仅用于测试）\n\n' +
        '请选择您的操作：',
        3,
        '手动输入',
        '使用测试邮箱',
        '取消'
      );

      if (proceed === 1) {
        // 使用测试邮箱
        log('Using test email for demonstration');
        return 'test@researchopia.com';
      } else if (proceed === 0) {
        // 尝试手动输入引导
        Zotero.alert(
          null,
          'Researchopia 登录',
          '📧 请在接下来的输入框中输入您的邮箱地址\n\n' +
          '如果没有出现输入框，请重启Zotero后重试'
        );
        return null;
      }

      return null;

    } catch (error) {
      log('Email input failed: ' + error.message);
      return null;
    }
  }

  /**
   * 获取密码输入 - 多种方法尝试
   */
  getPasswordInput() {
    try {
      log('Attempting to get password input...');

      // 方法1: 尝试使用Services.prompt
      if (typeof Services !== 'undefined' && Services.prompt) {
        const result = { value: '' };
        const success = Services.prompt.promptPassword(
          null,
          'Researchopia 登录',
          '🔒 请输入您的研学港密码：',
          result,
          null,
          {}
        );

        if (success && result.value && result.value.trim()) {
          log('Password obtained via Services.prompt');
          return result.value.trim();
        }
      }

      // 方法2: 使用简化的alert方式引导用户
      const proceed = Zotero.alert(
        null,
        'Researchopia 登录',
        '🔒 密码输入\n\n' +
        '由于技术限制，请使用以下方式之一输入密码：\n\n' +
        '方式1：在下一个对话框中手动输入\n' +
        '方式2：使用测试密码（仅用于测试）\n\n' +
        '请选择您的操作：',
        3,
        '手动输入',
        '使用测试密码',
        '取消'
      );

      if (proceed === 1) {
        // 使用测试密码
        log('Using test password for demonstration');
        return 'test123456';
      } else if (proceed === 0) {
        // 尝试手动输入引导
        Zotero.alert(
          null,
          'Researchopia 登录',
          '🔒 请在接下来的输入框中输入您的密码\n\n' +
          '如果没有出现输入框，请重启Zotero后重试'
        );
        return null;
      }

      return null;

    } catch (error) {
      log('Password input failed: ' + error.message);
      return null;
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
   * 简化输入方法 - 备用方案
   */
  getSimpleInput(title, message, defaultValue, isPassword = false) {
    try {
      // 这是一个备用方案，正常情况下应该使用Services.prompt
      log('Using fallback input method for: ' + message);

      // 显示输入说明
      Zotero.alert(
        null,
        title,
        message + '\n\n⚠️ 请注意：由于技术限制，无法直接输入。\n建议重启Zotero后重试，或联系技术支持。'
      );

      return null;

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
        Zotero.Prefs.set('extensions.researchopia.userInfo', JSON.stringify(this.currentUser));
        log('✅ Auth state saved: ' + (this.currentUser.name || this.currentUser.email));
      } else {
        this.clearAuthState();
      }
    } catch (error) {
      log('❌ Failed to save auth state: ' + error.message);
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
      Zotero.Prefs.clear('extensions.researchopia.userInfo');
      // 也清除旧的键名以确保完全清理
      Zotero.Prefs.clear('extensions.researchopia.currentUser');

      log('✅ Auth state cleared');
    } catch (error) {
      log('❌ Failed to clear auth state: ' + error.message);
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
    this.annotationManager = null;
    this.annotationUI = null;
  }

  /**
   * 初始化插件
   */
  async init() {
    try {
      log("🚀 Starting modular plugin v" + this.version);
      log("🔄 Plugin startup initiated...");

      // 等待Zotero完全加载
      log("🔄 Waiting for Zotero to load...");
      await this.waitForZotero();
      log("✅ Zotero loaded successfully");

      // 初始化内置认证管理器
      log("🔄 Initializing auth manager...");
      this.authManager = new BuiltinAuthManager();
      await this.authManager.initialize();
      log("✅ Auth manager initialized");

      // 初始化Supabase API管理器
      try {
        await this.initializeSupabaseAPI();
        if (this.supabaseAPI) {
          log('✅ Supabase API successfully initialized in startup');
        } else {
          log('❌ Supabase API is null after initialization');
        }
      } catch (error) {
        log('❌ Error during Supabase API initialization: ' + error.message);
        log('❌ Stack: ' + error.stack);
      }

      // 暂时禁用标注管理器，先确保基本功能正常
      this.annotationManager = null;
      this.annotationUI = null;
      log('⚠️ Annotation components disabled for debugging');

      // 初始化模块加载器
      this.moduleLoader = new ModuleLoader(rootURI);

      // 尝试加载专业模块
      await this.loadModules();

      // 注册Item Pane
      await this.registerItemPane();

      // 注册偏好设置面板
      this.registerPreferencesPane();

      // 设置全局引用供偏好设置页面使用
      if (!Zotero.ResearchopiaPlugin) {
        Zotero.ResearchopiaPlugin = this;
        log("✅ Set Zotero.ResearchopiaPlugin global reference");
      }

      // 也设置到window对象以便HTML onclick访问
      try {
        const activeWindow = Zotero.getActiveZoteroPane().document.defaultView;
        if (activeWindow) {
          activeWindow.ResearchopiaPlugin = this;
          log("✅ Set window.ResearchopiaPlugin global reference");
        }
      } catch (error) {
        log("⚠️ Could not set window global reference: " + error.message);
      }

      this.initialized = true;
      log("✅ Plugin initialized successfully" + (this.fallbackMode ? " (fallback mode)" : " (full mode)"));
      log("🔍 Debug: fallbackMode = " + this.fallbackMode);
      log("🔍 Debug: authManager = " + (this.authManager ? "initialized" : "null"));
      log("🔍 Debug: Zotero.ResearchopiaPlugin = " + (Zotero.ResearchopiaPlugin ? "set" : "null"));

      // 显示启动消息
      this.showStartupMessage();

    } catch (error) {
      log("❌ Initialization failed: " + error.message);
      throw error;
    }
  }

  /**
   * 登录方法 - 供偏好设置页面调用
   */
  async login(email, password) {
    try {
      log('ResearchopiaMain: Starting login process for: ' + email);

      if (!this.authManager) {
        throw new Error('认证管理器未初始化');
      }

      // 调用认证管理器的登录方法
      await this.authManager.authenticateWithSupabaseHTTP(email, password);

      log('ResearchopiaMain: Login successful');
      return true;

    } catch (error) {
      log('ResearchopiaMain: Login failed: ' + error.message);
      throw error;
    }
  }

  /**
   * 退出登录方法
   */
  async logout() {
    try {
      log('ResearchopiaMain: Starting logout process');

      if (this.authManager && this.authManager.logout) {
        await this.authManager.logout();
      }

      // 清除偏好设置中的认证信息
      Zotero.Prefs.clear('extensions.researchopia.authToken');
      Zotero.Prefs.clear('extensions.researchopia.userInfo');

      log('ResearchopiaMain: Logout successful');
      return true;

    } catch (error) {
      log('ResearchopiaMain: Logout failed: ' + error.message);
      throw error;
    }
  }

  /**
   * 获取当前登录状态
   */
  getLoginStatus() {
    try {
      const authToken = Zotero.Prefs.get('extensions.researchopia.authToken');
      const userInfoJson = Zotero.Prefs.get('extensions.researchopia.userInfo');

      if (authToken && userInfoJson) {
        try {
          const userInfo = JSON.parse(userInfoJson);
          return {
            isLoggedIn: true,
            userInfo: userInfo
          };
        } catch (parseError) {
          return { isLoggedIn: false };
        }
      }

      return { isLoggedIn: false };

    } catch (error) {
      log('ResearchopiaMain: Failed to get login status: ' + error.message);
      return { isLoggedIn: false };
    }
  }

  /**
   * 刷新UI - 委托给认证管理器
   */
  refreshUI() {
    try {
      if (this.authManager && this.authManager.refreshUI) {
        this.authManager.refreshUI();
        log('ResearchopiaMain: UI refresh delegated to auth manager');
      } else {
        log('ResearchopiaMain: No auth manager or refreshUI method available');
      }
    } catch (error) {
      log('ResearchopiaMain: Failed to refresh UI: ' + error.message);
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
   * 初始化标注组件
   */
  initializeAnnotationComponents() {
    try {
      // 加载标注管理器脚本
      Services.scriptloader.loadSubScript(rootURI + 'content/annotation-manager.js', this);

      // 加载标注UI脚本
      Services.scriptloader.loadSubScript(rootURI + 'content/annotation-ui.js', this);

      // 初始化标注管理器
      if (typeof AnnotationManager !== 'undefined') {
        this.annotationManager = new AnnotationManager(this.authManager);
        log('✅ AnnotationManager initialized');
      } else {
        log('❌ AnnotationManager class not found');
      }

      // 初始化标注UI组件
      if (typeof AnnotationUI !== 'undefined' && this.annotationManager) {
        this.annotationUI = new AnnotationUI(this.annotationManager, this.authManager);
        log('✅ AnnotationUI initialized');
      } else {
        log('❌ AnnotationUI class not found or AnnotationManager not available');
      }

    } catch (error) {
      log('❌ Failed to initialize annotation components: ' + error.message);
      // 设置为null以便使用降级方案
      this.annotationManager = null;
      this.annotationUI = null;
    }
  }

  /**
   * 初始化Supabase API管理器
   */
  async initializeSupabaseAPI() {
    try {
      log('🔄 Loading Supabase API script...');
      log('📍 Script path: ' + rootURI + "content/supabase-api.js");

      // 检查脚本文件是否存在
      const scriptPath = rootURI + "content/supabase-api.js";

      // 加载Supabase API脚本
      Services.scriptloader.loadSubScript(scriptPath, this);
      log('✅ Supabase API script loaded');

      // 检查类是否可用
      if (typeof SupabaseAnnotationAPI === 'undefined') {
        throw new Error('SupabaseAnnotationAPI class not found after script load');
      }

      // 创建API实例
      this.supabaseAPI = new SupabaseAnnotationAPI(this.authManager);
      log('✅ Supabase API instance created');

      // 初始化配置
      const initialized = await this.supabaseAPI.initialize();

      if (initialized) {
        log('✅ Supabase API fully initialized');
        return true;
      } else {
        log('❌ Supabase API initialization failed');
        this.supabaseAPI = null;
        return false;
      }
    } catch (error) {
      log('❌ Failed to initialize Supabase API: ' + error.message);
      log('❌ Stack trace: ' + (error.stack || 'No stack trace available'));
      this.supabaseAPI = null;
      return false;
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
   * 注册偏好设置面板
   */
  registerPreferencesPane() {
    try {
      log("Registering preferences pane...");

      Zotero.PreferencePanes.register({
        pluginID: this.id,
        src: rootURI + "content/preferences.xhtml",
        scripts: [rootURI + "content/preferences.js"],
        stylesheets: [rootURI + "content/preferences.css"], // 重新启用CSS文件
        label: "研学港 (Researchopia)"
      });

      log("✅ Preferences pane registered successfully");
    } catch (error) {
      log("❌ Failed to register preferences pane: " + error.message);
    }
  }

  /**
   * 偏好设置变化处理
   */
  onPreferencesChanged(pref) {
    try {
      log('Preference changed: ' + pref);

      switch (pref) {
        case 'extensions.researchopia.autoSync':
          // 处理自动同步设置变化
          break;
        case 'extensions.researchopia.realtimeUpdates':
          // 处理实时更新设置变化
          break;
        case 'extensions.researchopia.showSharedAnnotations':
        case 'extensions.researchopia.showPrivateAnnotations':
          // 刷新UI显示
          this.refreshUI();
          break;
      }
    } catch (error) {
      log('Failed to handle preference change: ' + error.message);
    }
  }

  /**
   * 渲染面板
   */
  renderPane(body, item, editable, tabType) {
    try {
      // 调试：检查插件实例状态
      log('🔍 Rendering pane - Plugin instance debug:');
      log('   - this.id: ' + this.id);
      log('   - this.version: ' + this.version);
      log('   - this.initialized: ' + this.initialized);
      log('   - this.authManager: ' + (this.authManager ? 'exists' : 'null'));
      log('   - this.supabaseAPI: ' + (this.supabaseAPI ? 'exists' : 'null'));
      log('   - Global instance: ' + (researchopiaPluginInstance ? 'exists' : 'null'));
      log('   - Same instance?: ' + (this === researchopiaPluginInstance));

      // 调试：检查Supabase API状态
      log('🔍 Rendering pane - Supabase API status: ' + (this.supabaseAPI ? 'initialized' : 'null'));
      if (this.supabaseAPI) {
        log('✅ Supabase API is available in renderPane');
      } else {
        log('❌ Supabase API is null in renderPane - this may be the problem!');
      }

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
            <div style="color: #92400e; font-size: 14px; font-weight: 500; margin-bottom: 8px;">需要登录</div>
            <div style="color: #a16207; font-size: 12px; margin-bottom: 12px;">请先登录研学港账户以使用标注共享功能</div>
            <button id="researchopia-settings-btn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              打开设置
            </button>
          </div>
        `;

        // 添加登录按钮事件 - 使用DOM创建避免安全限制
        setTimeout(() => {
          this.addLoginButtons(doc, annotationsArea);
        }, 100);
      } else {
        // 已登录状态 - 使用新的标注共享界面
        log('User is authenticated, creating annotation sharing interface');
        this.createAnnotationSharingInterface(doc, annotationsArea, item);
      }
    }

    return annotationsArea;
  }

  /**
   * 创建标注共享界面
   */
  createAnnotationSharingInterface(doc, container, item) {
    try {
      log('Creating annotation sharing interface...');
      // 暂时直接使用基本界面，确保功能正常
      this.createBasicAnnotationInterface(container, item);
      log('✅ Annotation sharing interface created successfully');
    } catch (error) {
      log('❌ Failed to create annotation sharing interface: ' + error.message);
      // 降级到最简单的界面
      container.innerHTML = `
        <div style="padding: 15px; text-align: center; color: #dc3545;">
          <div style="font-size: 14px; margin-bottom: 10px;">❌ 标注功能加载失败</div>
          <div style="font-size: 12px;">${error.message}</div>
        </div>
      `;
    }
  }

  /**
   * 加载标注相关脚本
   */
  loadAnnotationScripts(doc) {
    try {
      // 在Zotero插件环境中，脚本已经通过Services.scriptloader加载
      // 这里只需要确保组件已初始化
      if (!this.annotationManager || !this.annotationUI) {
        this.initializeAnnotationComponents();
      }
    } catch (error) {
      log('Failed to load annotation scripts: ' + error.message);
    }
  }

  /**
   * 创建基本标注界面（降级方案）
   */
  createBasicAnnotationInterface(container, item) {
    try {
      log('Creating basic annotation interface...');
      const doi = item.getField('DOI');
      log('DOI: ' + (doi || 'none'));

      // 创建基本的HTML结构，避免复杂的模板字符串
      const doc = Zotero.getActiveZoteroPane().document;
      const mainDiv = doc.createElement('div');
      mainDiv.style.padding = '15px';

      // 标题栏
      const titleDiv = doc.createElement('div');
      titleDiv.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;';

      const titleH3 = doc.createElement('h3');
      titleH3.style.cssText = 'margin: 0; font-size: 16px; color: #2c3e50;';
      titleH3.textContent = '📝 标注管理';

      const doiDiv = doc.createElement('div');
      doiDiv.style.cssText = 'font-size: 11px; color: #666;';
      doiDiv.textContent = doi ? 'DOI: ' + doi : '无DOI';

      titleDiv.appendChild(titleH3);
      titleDiv.appendChild(doiDiv);
      mainDiv.appendChild(titleDiv);

      if (doi) {
        // 功能按钮组
        const buttonDiv = doc.createElement('div');
        buttonDiv.style.cssText = 'display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;';

        // 提取按钮
        const extractBtn = doc.createElement('button');
        extractBtn.id = 'extract-annotations-btn';
        extractBtn.style.cssText = 'flex: 1; min-width: 120px; padding: 8px 12px; background: #17a2b8; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;';
        extractBtn.textContent = '📋 提取我的标注';

        // 共享按钮
        const shareBtn = doc.createElement('button');
        shareBtn.id = 'share-annotations-btn';
        shareBtn.style.cssText = 'flex: 1; min-width: 120px; padding: 8px 12px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;';
        shareBtn.textContent = '📤 共享我的标注';
        shareBtn.disabled = true;

        // 查看按钮
        const viewBtn = doc.createElement('button');
        viewBtn.id = 'view-shared-btn';
        viewBtn.style.cssText = 'flex: 1; min-width: 120px; padding: 8px 12px; background: #6f42c1; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;';
        viewBtn.textContent = '👥 查看共享标注';

        buttonDiv.appendChild(extractBtn);
        buttonDiv.appendChild(shareBtn);
        buttonDiv.appendChild(viewBtn);
        mainDiv.appendChild(buttonDiv);

        // 状态显示区域
        const statusDiv = doc.createElement('div');
        statusDiv.id = 'annotation-status';
        statusDiv.style.cssText = 'background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #6c757d;';

        const statusText = doc.createElement('div');
        statusText.style.cssText = 'font-size: 12px; color: #495057;';
        statusText.textContent = '💡 点击"提取我的标注"开始使用标注管理功能';

        statusDiv.appendChild(statusText);
        mainDiv.appendChild(statusDiv);

        // 标注内容区域
        const contentDiv = doc.createElement('div');
        contentDiv.id = 'annotation-content';
        contentDiv.style.cssText = 'min-height: 200px;';

        mainDiv.appendChild(contentDiv);

      } else {
        // 无DOI提示
        const nodoiDiv = doc.createElement('div');
        nodoiDiv.style.cssText = 'text-align: center; padding: 40px; color: #666;';

        const iconDiv = doc.createElement('div');
        iconDiv.style.cssText = 'font-size: 48px; margin-bottom: 15px;';
        iconDiv.textContent = '📄';

        const titleDiv = doc.createElement('div');
        titleDiv.style.cssText = 'font-size: 14px; margin-bottom: 8px;';
        titleDiv.textContent = '此文献没有DOI';

        const descDiv = doc.createElement('div');
        descDiv.style.cssText = 'font-size: 12px;';
        descDiv.textContent = '标注共享功能需要DOI来识别论文';

        nodoiDiv.appendChild(iconDiv);
        nodoiDiv.appendChild(titleDiv);
        nodoiDiv.appendChild(descDiv);
        mainDiv.appendChild(nodoiDiv);
      }

      // 清空容器并添加新内容
      container.innerHTML = '';
      container.appendChild(mainDiv);

    // 绑定新的按钮功能
    if (doi) {
      this.bindAnnotationButtons(container, item);

      // 初始化时显示基本信息
      setTimeout(() => {
        this.updateAnnotationStatus('📊 准备就绪，点击按钮开始使用标注功能');
      }, 100);
    }

    log('✅ Basic annotation interface created successfully');

    } catch (error) {
      log('❌ Failed to create basic annotation interface: ' + error.message);
      container.innerHTML = `
        <div style="padding: 15px; text-align: center; color: #dc3545;">
          <div style="font-size: 14px; margin-bottom: 10px;">❌ 界面创建失败</div>
          <div style="font-size: 12px;">${error.message}</div>
        </div>
      `;
    }
  }

  /**
   * 绑定标注按钮事件
   */
  bindAnnotationButtons(container, item) {
    try {
      // 提取我的标注按钮
      const extractBtn = container.querySelector('#extract-annotations-btn');
      if (extractBtn) {
        extractBtn.addEventListener('click', () => this.handleExtractAnnotations(item));
      }

      // 共享我的标注按钮
      const shareBtn = container.querySelector('#share-annotations-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => this.handleShareAnnotations(item));
      }

      // 查看共享标注按钮
      const viewBtn = container.querySelector('#view-shared-btn');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => this.handleViewSharedAnnotations(item));
      }

      log('✅ Annotation buttons bound successfully');
    } catch (error) {
      log('❌ Failed to bind annotation buttons: ' + error.message);
    }
  }

  /**
   * 更新状态显示
   */
  updateAnnotationStatus(message, type = 'info') {
    try {
      // 在Zotero环境中，需要从当前文档查找元素
      const statusElement = Zotero.getActiveZoteroPane().document.getElementById('annotation-status');
      if (statusElement) {
        const colors = {
          info: { bg: '#f8f9fa', border: '#6c757d', text: '#495057' },
          success: { bg: '#d4edda', border: '#28a745', text: '#155724' },
          warning: { bg: '#fff3cd', border: '#ffc107', text: '#856404' },
          error: { bg: '#f8d7da', border: '#dc3545', text: '#721c24' }
        };

        const color = colors[type] || colors.info;

        statusElement.style.background = color.bg;
        statusElement.style.borderLeftColor = color.border;
        statusElement.innerHTML = `
          <div style="font-size: 12px; color: ${color.text}; white-space: pre-line;">
            ${message}
          </div>
        `;
      }
    } catch (error) {
      log('Failed to update annotation status: ' + error.message);
    }
  }

  /**
   * 处理提取我的标注
   */
  async handleExtractAnnotations(item) {
    try {
      log('Extracting user annotations...');
      this.updateAnnotationStatus('🔄 正在提取标注...', 'info');

      const extractBtn = Zotero.getActiveZoteroPane().document.getElementById('extract-annotations-btn');
      if (extractBtn) {
        extractBtn.disabled = true;
        extractBtn.textContent = '🔄 提取中...';
      }

      // 获取标注
      const annotations = await this.extractBasicAnnotations(item);

      if (annotations.length === 0) {
        this.updateAnnotationStatus('📊 此文献没有找到标注\n\n💡 在PDF阅读器中添加高亮或笔记后再试', 'warning');
        this.displayAnnotationContent('empty');
        return;
      }

      // 分析标注类型
      const stats = this.analyzeAnnotations(annotations);

      // 更新状态显示
      this.updateAnnotationStatus(`✅ 成功提取 ${annotations.length} 个标注\n• 高亮：${stats.highlight} 个\n• 笔记：${stats.note} 个\n• 图片：${stats.image} 个\n• 其他：${stats.other} 个`, 'success');

      // 显示标注内容
      this.displayAnnotationContent('my-annotations', annotations);

      // 启用共享按钮
      const shareBtn = Zotero.getActiveZoteroPane().document.getElementById('share-annotations-btn');
      if (shareBtn) {
        shareBtn.disabled = false;
      }

    } catch (error) {
      log('Failed to extract annotations: ' + error.message);
      this.updateAnnotationStatus('❌ 提取标注失败：' + error.message, 'error');
    } finally {
      const extractBtn = Zotero.getActiveZoteroPane().document.getElementById('extract-annotations-btn');
      if (extractBtn) {
        extractBtn.disabled = false;
        extractBtn.textContent = '📋 提取我的标注';
      }
    }
  }

  /**
   * 处理共享我的标注
   */
  async handleShareAnnotations(item) {
    try {
      if (!this.authManager.isAuthenticated) {
        Zotero.alert(null, 'Researchopia', '请先登录后再共享标注');
        return;
      }

      if (!this.supabaseAPI) {
        this.updateAnnotationStatus('❌ Supabase API未初始化\n\n请检查配置文件或网络连接', 'error');
        log('❌ Supabase API is null - initialization failed');
        return;
      }

      log('Sharing user annotations...');
      this.updateAnnotationStatus('🔄 正在共享标注...', 'info');

      const shareBtn = Zotero.getActiveZoteroPane().document.getElementById('share-annotations-btn');
      if (shareBtn) {
        shareBtn.disabled = true;
        shareBtn.textContent = '🔄 共享中...';
      }

      // 获取已选择的标注（这里简化为所有标注）
      const annotations = await this.extractBasicAnnotations(item);

      if (annotations.length === 0) {
        this.updateAnnotationStatus('❌ 没有可共享的标注\n请先提取标注', 'error');
        return;
      }

      // 真实上传到Supabase
      const uploadedAnnotations = await this.supabaseAPI.uploadAnnotations(item, annotations);

      this.updateAnnotationStatus(`✅ 成功共享 ${uploadedAnnotations.length} 个标注\n\n🌐 您的标注现在可以被其他用户查看`, 'success');

      // 显示成功消息
      Zotero.alert(
        null,
        'Researchopia',
        `✅ 标注共享成功！\n\n共享了 ${uploadedAnnotations.length} 个标注\n其他用户现在可以查看您的标注`
      );

    } catch (error) {
      log('Failed to share annotations: ' + error.message);
      this.updateAnnotationStatus('❌ 共享标注失败：' + error.message, 'error');

      // 显示详细错误信息
      Zotero.alert(null, 'Researchopia', `❌ 共享失败：\n\n${error.message}\n\n请检查网络连接和登录状态`);
    } finally {
      const shareBtn = Zotero.getActiveZoteroPane().document.getElementById('share-annotations-btn');
      if (shareBtn) {
        shareBtn.disabled = false;
        shareBtn.textContent = '📤 共享我的标注';
      }
    }
  }

  /**
   * 处理查看共享标注
   */
  async handleViewSharedAnnotations(item) {
    try {
      log('Loading shared annotations...');
      this.updateAnnotationStatus('🔄 正在加载共享标注...', 'info');

      const viewBtn = Zotero.getActiveZoteroPane().document.getElementById('view-shared-btn');
      if (viewBtn) {
        viewBtn.disabled = true;
        viewBtn.textContent = '🔄 加载中...';
      }

      if (!this.supabaseAPI) {
        this.updateAnnotationStatus('❌ Supabase API未初始化', 'error');
        return;
      }

      // 从Supabase加载真实的共享标注
      const sharedAnnotations = await this.supabaseAPI.getSharedAnnotations(item, {
        sortBy: 'likes_count',
        sortOrder: 'desc',
        limit: 50
      });

      if (sharedAnnotations.length === 0) {
        this.updateAnnotationStatus('📊 此文献暂无共享标注\n\n💡 成为第一个分享标注的用户吧！', 'warning');
        this.displayAnnotationContent('empty');
        return;
      }

      // 转换数据格式以适配现有UI
      const formattedAnnotations = sharedAnnotations.map(annotation => ({
        id: annotation.id,
        user: annotation.users?.display_name || annotation.users?.username || '匿名用户',
        type: annotation.annotation_type,
        text: annotation.text_content,
        comment: annotation.comment,
        page: annotation.page_label || (annotation.page_number ? `第${annotation.page_number}页` : '未知页'),
        likes: annotation.likes_count || 0,
        comments: annotation.comments_count || 0,
        created: this.formatRelativeTime(annotation.created_at),
        color: annotation.color,
        // 保留原始数据用于交互
        _raw: annotation
      }));

      const uniqueUsers = new Set(formattedAnnotations.map(a => a.user)).size;
      this.updateAnnotationStatus(`✅ 加载了 ${formattedAnnotations.length} 个共享标注\n\n👥 来自 ${uniqueUsers} 位用户`, 'success');

      // 显示共享标注内容
      this.displayAnnotationContent('shared-annotations', formattedAnnotations);

    } catch (error) {
      log('Failed to load shared annotations: ' + error.message);
      this.updateAnnotationStatus('❌ 加载共享标注失败：' + error.message, 'error');

      // 显示详细错误信息
      if (error.message.includes('No DOI found')) {
        this.updateAnnotationStatus('❌ 此文献没有DOI\n无法加载共享标注', 'error');
      }
    } finally {
      const viewBtn = Zotero.getActiveZoteroPane().document.getElementById('view-shared-btn');
      if (viewBtn) {
        viewBtn.disabled = false;
        viewBtn.textContent = '👥 查看共享标注';
      }
    }
  }

  /**
   * 格式化相对时间
   */
  formatRelativeTime(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffDays > 7) {
        return date.toLocaleDateString('zh-CN');
      } else if (diffDays > 0) {
        return `${diffDays}天前`;
      } else if (diffHours > 0) {
        return `${diffHours}小时前`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes}分钟前`;
      } else {
        return '刚刚';
      }
    } catch (error) {
      return '未知时间';
    }
  }

  /**
   * 显示标注内容
   */
  displayAnnotationContent(type, annotations = []) {
    try {
      // 在Zotero环境中，需要从当前文档查找元素
      const doc = Zotero.getActiveZoteroPane().document;
      const contentElement = doc.getElementById('annotation-content');
      if (!contentElement) return;

      // 清空内容
      contentElement.innerHTML = '';

      if (type === 'empty') {
        const emptyDiv = doc.createElement('div');
        emptyDiv.style.cssText = 'text-align: center; padding: 40px; color: #666;';

        const iconDiv = doc.createElement('div');
        iconDiv.style.cssText = 'font-size: 48px; margin-bottom: 15px;';
        iconDiv.textContent = '📝';

        const titleDiv = doc.createElement('div');
        titleDiv.style.cssText = 'font-size: 14px; margin-bottom: 8px;';
        titleDiv.textContent = '暂无标注';

        const descDiv = doc.createElement('div');
        descDiv.style.cssText = 'font-size: 12px;';
        descDiv.textContent = '在PDF阅读器中添加标注后再试';

        emptyDiv.appendChild(iconDiv);
        emptyDiv.appendChild(titleDiv);
        emptyDiv.appendChild(descDiv);
        contentElement.appendChild(emptyDiv);
        return;
      }

      if (type === 'my-annotations') {
        // 使用DOM操作而不是innerHTML来避免字符串解析问题
        const headerDiv = doc.createElement('div');
        headerDiv.style.cssText = 'margin-bottom: 15px;';

        const titleH4 = doc.createElement('h4');
        titleH4.style.cssText = 'margin: 0 0 10px 0; font-size: 14px; color: #2c3e50;';
        titleH4.textContent = `📋 我的标注 (${annotations.length})`;

        const descDiv = doc.createElement('div');
        descDiv.style.cssText = 'font-size: 11px; color: #666; margin-bottom: 10px;';
        descDiv.textContent = '选择要共享的标注，然后点击"共享我的标注"按钮';

        headerDiv.appendChild(titleH4);
        headerDiv.appendChild(descDiv);
        contentElement.appendChild(headerDiv);

        const listDiv = doc.createElement('div');
        listDiv.id = 'my-annotations-list';

        annotations.forEach((annotation, index) => {
          const annotationElement = this.createMyAnnotationElement(doc, annotation, index);
          listDiv.appendChild(annotationElement);
        });

        contentElement.appendChild(listDiv);

      } else if (type === 'shared-annotations') {
        // 使用DOM操作而不是innerHTML
        const headerDiv = doc.createElement('div');
        headerDiv.style.cssText = 'margin-bottom: 15px;';

        const titleH4 = doc.createElement('h4');
        titleH4.style.cssText = 'margin: 0 0 10px 0; font-size: 14px; color: #2c3e50;';
        titleH4.textContent = `👥 共享标注 (${annotations.length})`;

        const descDiv = doc.createElement('div');
        descDiv.style.cssText = 'font-size: 11px; color: #666; margin-bottom: 10px;';
        descDiv.textContent = '来自其他用户的标注和见解';

        headerDiv.appendChild(titleH4);
        headerDiv.appendChild(descDiv);
        contentElement.appendChild(headerDiv);

        const listDiv = doc.createElement('div');
        listDiv.id = 'shared-annotations-list';

        annotations.forEach((annotation, index) => {
          const annotationElement = this.createSharedAnnotationElement(doc, annotation, index);
          listDiv.appendChild(annotationElement);
        });

        contentElement.appendChild(listDiv);
      }

      log('✅ Annotation content displayed: ' + type);
    } catch (error) {
      log('Failed to display annotation content: ' + error.message);
    }
  }

  /**
   * 创建我的标注DOM元素
   */
  createMyAnnotationElement(doc, annotation, index) {
    const typeIcon = {
      'highlight': '🖍️',
      'note': '📝',
      'image': '🖼️',
      'ink': '✏️'
    }[annotation.type] || '📝';

    const container = doc.createElement('div');
    container.style.cssText = 'margin-bottom: 12px; padding: 10px; border: 1px solid #e9ecef; border-radius: 6px; background: #f8f9fa;';

    // 顶部信息行
    const topDiv = doc.createElement('div');
    topDiv.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;';

    const leftDiv = doc.createElement('div');
    leftDiv.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `annotation-${index}`;
    checkbox.checked = true;
    checkbox.style.margin = '0';

    const label = doc.createElement('label');
    label.htmlFor = `annotation-${index}`;
    label.style.cssText = 'font-size: 12px; color: #495057;';
    label.textContent = `${typeIcon} ${annotation.page ? annotation.page : '未知页'}`;

    leftDiv.appendChild(checkbox);
    leftDiv.appendChild(label);
    topDiv.appendChild(leftDiv);

    if (annotation.color) {
      const colorDiv = doc.createElement('div');
      colorDiv.style.cssText = 'font-size: 10px; color: #6c757d;';
      const colorSpan = doc.createElement('span');
      colorSpan.style.cssText = `display: inline-block; width: 12px; height: 12px; background: ${annotation.color}; border-radius: 2px; margin-left: 4px;`;
      colorDiv.appendChild(colorSpan);
      topDiv.appendChild(colorDiv);
    }

    container.appendChild(topDiv);

    // 标注文本
    if (annotation.text) {
      const textDiv = doc.createElement('div');
      textDiv.style.cssText = `margin-bottom: 6px; padding: 6px; background: rgba(255,255,255,0.8); border-radius: 4px; font-size: 12px; line-height: 1.4; border-left: 2px solid ${annotation.color || '#ffd400'};`;
      textDiv.textContent = `"${annotation.text}"`;
      container.appendChild(textDiv);
    }

    // 评论
    if (annotation.comment) {
      const commentDiv = doc.createElement('div');
      commentDiv.style.cssText = 'font-size: 12px; color: #495057; line-height: 1.3;';
      commentDiv.textContent = `💭 ${annotation.comment}`;
      container.appendChild(commentDiv);
    }

    return container;
  }

  /**
   * 创建共享标注DOM元素
   */
  createSharedAnnotationElement(doc, annotation, index) {
    const typeIcon = {
      'highlight': '🖍️',
      'note': '📝',
      'image': '🖼️',
      'ink': '✏️'
    }[annotation.type] || '📝';

    const container = doc.createElement('div');
    container.style.cssText = 'margin-bottom: 15px; padding: 12px; border: 1px solid #e3f2fd; border-radius: 8px; background: #f8faff;';

    // 用户信息行
    const userDiv = doc.createElement('div');
    userDiv.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;';

    const userInfoDiv = doc.createElement('div');
    userInfoDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // 用户头像
    const avatarDiv = doc.createElement('div');
    avatarDiv.style.cssText = 'width: 24px; height: 24px; border-radius: 50%; background: #e9ecef; display: flex; align-items: center; justify-content: center; font-size: 12px;';
    avatarDiv.textContent = annotation.user ? annotation.user.charAt(0).toUpperCase() : '?';

    const userDetailsDiv = doc.createElement('div');

    const userNameDiv = doc.createElement('div');
    userNameDiv.style.cssText = 'font-size: 13px; font-weight: 500; color: #2c3e50;';
    userNameDiv.textContent = annotation.user || '匿名用户';

    const metaDiv = doc.createElement('div');
    metaDiv.style.cssText = 'font-size: 11px; color: #6c757d;';
    metaDiv.textContent = `${typeIcon} ${annotation.created || '未知时间'} ${annotation.page ? `· ${annotation.page}` : ''}`;

    userDetailsDiv.appendChild(userNameDiv);
    userDetailsDiv.appendChild(metaDiv);

    userInfoDiv.appendChild(avatarDiv);
    userInfoDiv.appendChild(userDetailsDiv);

    // 点赞数
    const likesDiv = doc.createElement('div');
    likesDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    const likesSpan = doc.createElement('span');
    likesSpan.style.cssText = 'font-size: 11px; color: #6c757d;';
    likesSpan.textContent = `👍 ${annotation.likes || 0}`;
    likesDiv.appendChild(likesSpan);

    userDiv.appendChild(userInfoDiv);
    userDiv.appendChild(likesDiv);
    container.appendChild(userDiv);

    // 标注文本
    if (annotation.text) {
      const textDiv = doc.createElement('div');
      textDiv.style.cssText = 'margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.7); border-radius: 4px; font-size: 13px; line-height: 1.4; border-left: 2px solid #2196f3;';
      textDiv.textContent = `"${annotation.text}"`;
      container.appendChild(textDiv);
    }

    // 评论
    if (annotation.comment) {
      const commentDiv = doc.createElement('div');
      commentDiv.style.cssText = 'margin-bottom: 8px; font-size: 13px; color: #495057; line-height: 1.4;';
      commentDiv.textContent = `💭 ${annotation.comment}`;
      container.appendChild(commentDiv);
    }

    // 操作按钮
    const actionsDiv = doc.createElement('div');
    actionsDiv.style.cssText = 'display: flex; align-items: center; gap: 15px; margin-top: 10px;';

    // 点赞按钮
    const likeBtn = doc.createElement('button');
    likeBtn.style.cssText = 'background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6c757d;';
    likeBtn.textContent = `👍 点赞 ${annotation.likes > 0 ? `(${annotation.likes})` : ''}`;
    likeBtn.onclick = () => {
      if (window.ResearchopiaPlugin) {
        window.ResearchopiaPlugin.handleLikeAnnotation(annotation.id);
      }
    };

    // 评论按钮
    const commentBtn = doc.createElement('button');
    commentBtn.style.cssText = 'background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6c757d;';
    commentBtn.textContent = `💬 评论 ${annotation.comments > 0 ? `(${annotation.comments})` : ''}`;
    commentBtn.onclick = () => {
      if (window.ResearchopiaPlugin) {
        window.ResearchopiaPlugin.handleCommentAnnotation(annotation.id);
      }
    };

    // 分享按钮
    const shareBtn = doc.createElement('button');
    shareBtn.style.cssText = 'background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6c757d;';
    shareBtn.textContent = '🔗 分享';
    shareBtn.onclick = () => {
      if (window.ResearchopiaPlugin) {
        window.ResearchopiaPlugin.handleShareAnnotation(annotation.id);
      }
    };

    actionsDiv.appendChild(likeBtn);
    actionsDiv.appendChild(commentBtn);
    actionsDiv.appendChild(shareBtn);
    container.appendChild(actionsDiv);

    return container;
  }

  /**
   * 创建我的标注HTML
   */
  createMyAnnotationHTML(annotation, index) {
    const typeIcon = {
      'highlight': '🖍️',
      'note': '📝',
      'image': '🖼️',
      'ink': '✏️'
    }[annotation.type] || '📝';

    return `
      <div style="margin-bottom: 12px; padding: 10px; border: 1px solid #e9ecef; border-radius: 6px; background: #f8f9fa;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="annotation-${index}" checked style="margin: 0;">
            <label for="annotation-${index}" style="font-size: 12px; color: #495057;">
              ${typeIcon} ${annotation.page ? annotation.page : '未知页'}
            </label>
          </div>
          <div style="font-size: 10px; color: #6c757d;">
            ${annotation.color ? `<span style="display: inline-block; width: 12px; height: 12px; background: ${annotation.color}; border-radius: 2px; margin-left: 4px;"></span>` : ''}
          </div>
        </div>

        ${annotation.text ? `
          <div style="margin-bottom: 6px; padding: 6px; background: rgba(255,255,255,0.8); border-radius: 4px; font-size: 12px; line-height: 1.4; border-left: 2px solid ${annotation.color || '#ffd400'};">
            "${annotation.text}"
          </div>
        ` : ''}

        ${annotation.comment ? `
          <div style="font-size: 12px; color: #495057; line-height: 1.3;">
            💭 ${annotation.comment}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 创建共享标注HTML
   */
  createSharedAnnotationHTML(annotation, index) {
    const typeIcon = {
      'highlight': '🖍️',
      'note': '📝',
      'image': '🖼️',
      'ink': '✏️'
    }[annotation.type] || '📝';

    return `
      <div style="margin-bottom: 15px; padding: 12px; border: 1px solid #e3f2fd; border-radius: 8px; background: #f8faff;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #e9ecef; display: flex; align-items: center; justify-content: center; font-size: 12px;">
              ${annotation.user ? annotation.user.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 500; color: #2c3e50;">
                ${annotation.user || '匿名用户'}
              </div>
              <div style="font-size: 11px; color: #6c757d;">
                ${typeIcon} ${annotation.created || '未知时间'} ${annotation.page ? `· ${annotation.page}` : ''}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; color: #6c757d;">👍 ${annotation.likes || 0}</span>
          </div>
        </div>

        ${annotation.text ? `
          <div style="margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.7); border-radius: 4px; font-size: 13px; line-height: 1.4; border-left: 2px solid #2196f3;">
            "${annotation.text}"
          </div>
        ` : ''}

        ${annotation.comment ? `
          <div style="margin-bottom: 8px; font-size: 13px; color: #495057; line-height: 1.4;">
            💭 ${annotation.comment}
          </div>
        ` : ''}

        <div style="display: flex; align-items: center; gap: 15px; margin-top: 10px;">
          <button onclick="window.ResearchopiaPlugin.handleLikeAnnotation('${annotation.id}')" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6c757d;">
            👍 点赞 ${annotation.likes > 0 ? `(${annotation.likes})` : ''}
          </button>
          <button onclick="window.ResearchopiaPlugin.handleCommentAnnotation('${annotation.id}')" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6c757d;">
            💬 评论 ${annotation.comments > 0 ? `(${annotation.comments})` : ''}
          </button>
          <button onclick="window.ResearchopiaPlugin.handleShareAnnotation('${annotation.id}')" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6c757d;">
            🔗 分享
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 处理标注点赞
   */
  async handleLikeAnnotation(annotationId) {
    try {
      if (!this.authManager.isAuthenticated) {
        Zotero.alert(null, 'Researchopia', '请先登录后再点赞');
        return;
      }

      if (!this.supabaseAPI) {
        Zotero.alert(null, 'Researchopia', 'API未初始化');
        return;
      }

      log(`Liking annotation: ${annotationId}`);

      const result = await this.supabaseAPI.likeAnnotation(annotationId);

      if (result.liked) {
        log('✅ Annotation liked');
        // 可以在这里更新UI显示
      } else {
        log('✅ Annotation unliked');
        // 可以在这里更新UI显示
      }

      // 刷新共享标注显示
      const currentItem = Zotero.getActiveZoteroPane().getSelectedItems()[0];
      if (currentItem) {
        // 延迟刷新以确保数据库更新完成
        setTimeout(() => {
          this.handleViewSharedAnnotations(currentItem);
        }, 500);
      }

    } catch (error) {
      log('Failed to like annotation: ' + error.message);
      Zotero.alert(null, 'Researchopia', `点赞失败：${error.message}`);
    }
  }

  /**
   * 处理标注评论
   */
  async handleCommentAnnotation(annotationId) {
    try {
      if (!this.authManager.isAuthenticated) {
        Zotero.alert(null, 'Researchopia', '请先登录后再评论');
        return;
      }

      if (!this.supabaseAPI) {
        Zotero.alert(null, 'Researchopia', 'API未初始化');
        return;
      }

      // 使用简单的输入对话框获取评论内容
      const comment = Services.prompt.prompt(
        null,
        'Researchopia - 添加评论',
        '请输入您的评论：',
        { value: '' },
        null,
        {}
      );

      if (!comment || !comment.value || !comment.value.trim()) {
        return; // 用户取消或输入为空
      }

      log(`Adding comment to annotation: ${annotationId}`);

      await this.supabaseAPI.addComment(annotationId, comment.value.trim());

      log('✅ Comment added');
      Zotero.alert(null, 'Researchopia', '评论添加成功！');

      // 刷新共享标注显示
      const currentItem = Zotero.getActiveZoteroPane().getSelectedItems()[0];
      if (currentItem) {
        setTimeout(() => {
          this.handleViewSharedAnnotations(currentItem);
        }, 500);
      }

    } catch (error) {
      log('Failed to add comment: ' + error.message);
      Zotero.alert(null, 'Researchopia', `评论失败：${error.message}`);
    }
  }

  /**
   * 处理标注分享
   */
  async handleShareAnnotation(annotationId) {
    try {
      log(`Sharing annotation: ${annotationId}`);

      // 简单的分享功能 - 复制链接到剪贴板
      const shareUrl = `https://researchopia.com/annotation/${annotationId}`;

      // 在Zotero环境中复制到剪贴板
      const clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Components.interfaces.nsIClipboardHelper);
      clipboard.copyString(shareUrl);

      Zotero.alert(null, 'Researchopia', '标注链接已复制到剪贴板！\n\n您可以将链接分享给其他人。');

    } catch (error) {
      log('Failed to share annotation: ' + error.message);
      Zotero.alert(null, 'Researchopia', `分享失败：${error.message}`);
    }
  }

  /**
   * 提取基本标注信息
   */
  async extractBasicAnnotations(item) {
    try {
      const annotations = [];

      // 获取PDF附件
      const attachments = item.getAttachments();
      const pdfAttachments = attachments.filter(id => {
        const attachment = Zotero.Items.get(id);
        return attachment && attachment.isPDFAttachment();
      });

      // 遍历PDF附件的标注
      for (const attachmentID of pdfAttachments) {
        const attachment = Zotero.Items.get(attachmentID);
        const itemAnnotations = attachment.getAnnotations();

        for (const annotationItem of itemAnnotations) {
          const annotationData = {
            key: annotationItem.key,
            type: annotationItem.annotationType,
            text: annotationItem.annotationText || '',
            comment: annotationItem.annotationComment || '',
            color: annotationItem.annotationColor || '#ffd400',
            page: annotationItem.annotationPageLabel || '',
            pageNumber: this.extractPageNumber(annotationItem.annotationPageLabel),
            position: annotationItem.annotationPosition || null,
            dateAdded: annotationItem.dateAdded,
            dateModified: annotationItem.dateModified,

            // 添加用于精确定位的信息
            textBefore: this.extractContextBefore(annotationItem),
            textAfter: this.extractContextAfter(annotationItem),
            paragraphHash: this.generateParagraphHash(annotationItem.annotationText),
            sentenceIndex: this.extractSentenceIndex(annotationItem)
          };

          annotations.push(annotationData);
        }
      }

      return annotations;

    } catch (error) {
      log('Failed to extract basic annotations: ' + error.message);
      return [];
    }
  }

  /**
   * 提取页码数字
   */
  extractPageNumber(pageLabel) {
    if (!pageLabel) return null;
    const match = pageLabel.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  /**
   * 提取前文上下文（简化版）
   */
  extractContextBefore(annotation) {
    const text = annotation.annotationText || '';
    return text.length > 50 ? text.substring(0, 50) : text;
  }

  /**
   * 提取后文上下文（简化版）
   */
  extractContextAfter(annotation) {
    const text = annotation.annotationText || '';
    return text.length > 50 ? text.substring(text.length - 50) : text;
  }

  /**
   * 生成段落哈希
   */
  generateParagraphHash(text) {
    if (!text) return null;

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 提取句子索引（简化版）
   */
  extractSentenceIndex(annotation) {
    return 0;
  }

  /**
   * 分析标注类型统计
   */
  analyzeAnnotations(annotations) {
    const stats = {
      highlight: 0,
      note: 0,
      image: 0,
      other: 0
    };

    annotations.forEach(annotation => {
      switch (annotation.type) {
        case 'highlight':
          stats.highlight++;
          break;
        case 'note':
          stats.note++;
          break;
        case 'image':
          stats.image++;
          break;
        default:
          stats.other++;
          break;
      }
    });

    return stats;
  }

  /**
   * 更新标注统计显示
   */
  updateAnnotationStats(message) {
    try {
      const statsElement = document.getElementById('annotation-stats');
      if (statsElement) {
        statsElement.innerHTML = `
          <div style="font-size: 12px; color: #495057; white-space: pre-line;">
            ${message}
          </div>
        `;
      }
    } catch (error) {
      log('Failed to update annotation stats: ' + error.message);
    }
  }

  /**
   * 初始化标注信息显示
   */
  async initializeAnnotationInfo(item) {
    try {
      // 快速检查是否有标注
      const annotations = await this.extractBasicAnnotations(item);

      if (annotations.length > 0) {
        const stats = this.analyzeAnnotations(annotations);
        this.updateAnnotationStats(`📊 检测到 ${annotations.length} 个标注\n• 高亮：${stats.highlight} 个\n• 笔记：${stats.note} 个\n• 图片：${stats.image} 个\n• 其他：${stats.other} 个\n\n💡 点击"分享标注"查看详细信息`);
      } else {
        this.updateAnnotationStats(`📊 此文献暂无标注\n\n💡 在PDF阅读器中添加高亮或笔记后，\n   可以使用标注共享功能`);
      }
    } catch (error) {
      log('Failed to initialize annotation info: ' + error.message);
      this.updateAnnotationStats('📊 正在检测标注信息...');
    }
  }

  /**
   * 创建已认证界面（保留原有功能）
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
    // 使用DOM API创建选项，避免安全警告
    const typeOptions = [
      { value: '', text: '所有类型' },
      { value: 'highlight', text: '高亮' },
      { value: 'note', text: '笔记' },
      { value: 'image', text: '图片' },
      { value: 'ink', text: '手绘' }
    ];

    typeOptions.forEach(opt => {
      const option = doc.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      typeFilter.appendChild(option);
    });

    // 排序选择
    const sortSelect = doc.createElement('select');
    sortSelect.style.cssText = 'padding: 2px 4px; font-size: 10px; border: 1px solid #d1d5db; border-radius: 3px;';
    // 使用DOM API创建选项，避免安全警告
    const sortOptions = [
      { value: 'date_desc', text: '最新优先' },
      { value: 'date_asc', text: '最旧优先' },
      { value: 'page_asc', text: '页码升序' },
      { value: 'page_desc', text: '页码降序' },
      { value: 'type', text: '按类型' }
    ];

    sortOptions.forEach(opt => {
      const option = doc.createElement('option');
      option.value = opt.value;
      option.textContent = opt.text;
      sortSelect.appendChild(option);
    });

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
   * 添加设置按钮 - 使用DOM API避免安全限制
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

    // 创建设置按钮
    const settingsBtn = doc.createElement('button');
    settingsBtn.style.cssText = 'padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';
    settingsBtn.textContent = '打开设置';
    settingsBtn.onclick = () => {
      try {
        // 获取主窗口
        const win = Services.wm.getMostRecentWindow('zotero:main');
        if (win && win.ZoteroPane_Local && win.ZoteroPane_Local.openPreferences) {
          // 使用ZoteroPane_Local.openPreferences方法
          win.ZoteroPane_Local.openPreferences();
        } else if (win && win.openPreferences) {
          // 备用方法1
          win.openPreferences();
        } else {
          // 备用方法2：通过菜单命令
          const command = win.document.getElementById('menu_preferences');
          if (command) {
            command.doCommand();
          } else {
            throw new Error('无法找到偏好设置命令');
          }
        }
      } catch (error) {
        log('Failed to open preferences: ' + error.message);
        // 最后的备用方案：显示提示
        Zotero.alert(
          null,
          'Researchopia',
          '请手动打开Zotero偏好设置：\n编辑 → 偏好设置 → 研学港'
        );
      }
    };

    buttonContainer.appendChild(settingsBtn);
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
      // 使用统一的Supabase配置管理器
      const config = SupabaseConfig.getConfig();
      const url = SupabaseConfig.getRestUrl(endpoint);

      const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`,
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
        // 移除启动提示框 - 用户要求
        // Zotero.alert(
        //   null,
        //   'Researchopia v' + this.version,
        //   '🎉 研学港插件已启动！\n✨ 基础架构优化完成！\n\n📋 请选择一个文献项目开始使用\n� 准备开始标注共享功能开发\n📖 完全兼容Zotero 8 Beta'
        // );
        log('Researchopia v' + this.version + ' started successfully');
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

    log("🚀 Starting up minimal plugin...");
    log("📍 Plugin ID: " + id);
    log("📍 Plugin Version: " + version);
    log("📍 Root URI: " + rootURI);

    // 创建插件实例
    log("🔄 Creating plugin instance...");
    researchopiaPluginInstance = new ResearchopiaMain();
    log("✅ Plugin instance created");

    // 初始化插件
    log("🔄 Initializing plugin...");
    await researchopiaPluginInstance.init();
    log("✅ Plugin initialization completed");

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
