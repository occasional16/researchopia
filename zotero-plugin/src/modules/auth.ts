/**
 * 认证管理模块
 * 负责用户登录、注销、会话管理等功能
 */

import { logger } from "../utils/logger";

// Supabase 配置
const SUPABASE_URL = 'https://obcblvdtqhwrihoddlez.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4';

export class AuthManager {
  private static instance: AuthManager | null = null;
  private isInitialized = false;
  private user: any = null;
  private session: any = null;
  private supabase: any = null;

  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = AuthManager.getInstance();
    if (instance.isInitialized) {
      return;
    }

    logger.log("[AuthManager] 🚀 Initializing with Supabase...");
    
    try {
      // 初始化 Supabase 客户端
      await instance.initializeSupabase();
      
      // 加载存储的会话
      await instance.loadStoredSession();
      
      instance.isInitialized = true;
      logger.log("[AuthManager] ✅ Initialized successfully");
    } catch (error) {
      logger.error("[AuthManager] ❌ Initialization error:", error);
      throw error;
    }
  }

  private async initializeSupabase(): Promise<void> {
    try {
      // 在 Zotero 插件环境中，我们需要通过 HTTP 请求来与 Supabase 交互
      this.supabase = {
        url: SUPABASE_URL,
        key: SUPABASE_ANON_KEY,
        
        async makeRequest(path: string, options: any = {}) {
          const url = `${SUPABASE_URL}${path}`;
          const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            ...options.headers
          };
          
          const response = await fetch(url, {
            ...options,
            headers
          });
          
          return response;
        }
      };
      
      logger.log("[AuthManager] 🔧 Supabase client initialized");
    } catch (error) {
      logger.error("[AuthManager] Failed to initialize Supabase:", error);
      throw error;
    }
  }

  public static async signIn(email: string, password: string): Promise<{ success: boolean; error?: string; user?: any }> {
    const instance = AuthManager.getInstance();
    
    try {
      logger.log("[AuthManager] 🔐 Signing in user:", email);
      
      if (!instance.supabase) {
        throw new Error("Supabase not initialized");
      }
      
      // 使用 Supabase Auth API 进行登录
      const response = await instance.supabase.makeRequest('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        logger.error("[AuthManager] Sign in failed:", data);
        return { 
          success: false, 
          error: data.error_description || data.message || '登录失败，请检查邮箱和密码'
        };
      }
      
      // 保存会话信息
      // 注意: 将expires_in延长为30天(2592000秒)以支持长期登录
      const expiresIn = data.expires_in || 3600; // 默认1小时
      const extendedExpiresIn = Math.max(expiresIn, 2592000); // 至少30天
      
      instance.session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (extendedExpiresIn * 1000),
        expires_in: extendedExpiresIn,
        token_type: data.token_type
      };
      
      // 获取用户角色和用户名
      let userRole = 'user'; // 默认角色
      let username = ''; // 用户名
      try {
        logger.log("[AuthManager] 🔍 Fetching user role and username for user ID:", data.user.id);
        const roleResponse = await instance.supabase.makeRequest(`/rest/v1/users?id=eq.${data.user.id}&select=role,username`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${data.access_token}`
          }
        });
        
        if (!roleResponse.ok) {
          logger.error("[AuthManager] ❌ User data fetch failed with status:", roleResponse.status);
          const errorText = await roleResponse.text();
          logger.error("[AuthManager] ❌ User data fetch error:", errorText);
        } else {
          const userData = await roleResponse.json();
          logger.log("[AuthManager] 📥 User data received:", JSON.stringify(userData));
          
          if (userData && userData.length > 0) {
            if (userData[0].role) {
              userRole = userData[0].role;
              logger.log("[AuthManager] ✅ User role set to:", userRole);
            }
            if (userData[0].username) {
              username = userData[0].username;
              logger.log("[AuthManager] ✅ Username set to:", username);
            }
          } else {
            logger.log("[AuthManager] ⚠️ No user data found in response, using defaults");
          }
        }
      } catch (error) {
        logger.error("[AuthManager] ❌ Failed to fetch user data:", error);
      }
      
      // 保存用户信息(包含角色和用户名)
      instance.user = {
        id: data.user.id,
        email: data.user.email,
        username: username, // 🆕 添加username字段
        created_at: data.user.created_at,
        email_confirmed_at: data.user.email_confirmed_at,
        last_sign_in_at: new Date().toISOString(),
        role: userRole
      };
      
      await instance.saveSession();
      logger.log("[AuthManager] ✅ Sign in successful for:", email, "with role:", userRole);
      
      // 触发登录事件,通知UI更新
      try {
        const win = (Zotero as any).getMainWindow();
        if (win && win.document) {
          const event = win.document.createEvent('CustomEvent');
          event.initCustomEvent('researchopia:login', true, false, { user: instance.user });
          win.document.dispatchEvent(event);
          logger.log("[AuthManager] 📢 Login event dispatched on main window");
          
          // 通知所有打开的窗口
          const windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
            .getService(Components.interfaces.nsIWindowMediator);
          const enumerator = windowMediator.getEnumerator(null);
          
          while (enumerator.hasMoreElements()) {
            try {
              const w = enumerator.getNext();
              if (w && w.document) {
                const evt = w.document.createEvent('CustomEvent');
                evt.initCustomEvent('researchopia:login', true, false, { user: instance.user });
                w.document.dispatchEvent(evt);
                logger.log("[AuthManager] 📢 Login event dispatched on window:", w.location?.href);
              }
            } catch (winError) {
              logger.error("[AuthManager] ⚠️ Error dispatching to window:", winError instanceof Error ? winError.message : String(winError));
            }
          }
        } else {
          logger.warn("[AuthManager] ⚠️ Main window or document not available for event dispatch");
        }
      } catch (eventError) {
        logger.error("[AuthManager] ❌ Error dispatching login event:", eventError instanceof Error ? eventError.message : String(eventError));
      }
      
      return { success: true, user: instance.user };
      
    } catch (error) {
      logger.error("[AuthManager] ❌ Sign in error:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '网络错误，请检查网络连接'
      };
    }
  }

  public static async signUp(email: string, password: string): Promise<{ success: boolean; error?: string; user?: any }> {
    const instance = AuthManager.getInstance();
    
    try {
      logger.log("[AuthManager] 📝 Signing up user:", email);
      
      if (!instance.supabase) {
        throw new Error("Supabase not initialized");
      }
      
      // 使用 Supabase Auth API 进行注册
      const response = await instance.supabase.makeRequest('/auth/v1/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        logger.error("[AuthManager] Sign up failed:", data);
        return { 
          success: false, 
          error: data.error_description || data.message || '注册失败，请重试'
        };
      }
      
      logger.log("[AuthManager] ✅ Sign up successful for:", email);
      return { 
        success: true, 
        user: data.user
      };
      
    } catch (error) {
      logger.error("[AuthManager] ❌ Sign up error:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '网络错误，请检查网络连接'
      };
    }
  }

  public static async signOut(): Promise<void> {
    const instance = AuthManager.getInstance();
    
    try {
      logger.log("[AuthManager] 🚪 Signing out user");
      
      // 通知 ReadingSessionManager 用户即将登出
      try {
        const { ReadingSessionManager } = await import('./readingSessionManager');
        const sessionMgr = ReadingSessionManager.getInstance();
        if (sessionMgr.isInSession()) {
          await sessionMgr.handleUserLogout();
        }
      } catch (sessionError) {
        logger.error("[AuthManager] Error handling session logout:", sessionError);
      }
      
      // 如果有有效的会话，向 Supabase 发送登出请求
      if (instance.session?.access_token && instance.supabase) {
        try {
          await instance.supabase.makeRequest('/auth/v1/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${instance.session.access_token}`
            }
          });
        } catch (logoutError) {
          logger.error("[AuthManager] Remote logout failed:", logoutError);
          // 即使远程登出失败，也要清除本地会话
        }
      }
      
      instance.user = null;
      instance.session = null;
      await instance.clearSession();
      
      logger.log("[AuthManager] ✅ Sign out successful");
    } catch (error) {
      logger.error("[AuthManager] ❌ Sign out error:", error);
      throw error;
    }
  }

  public static async isLoggedIn(): Promise<boolean> {
    const instance = AuthManager.getInstance();
    
    // 每次都重新从prefs读取最新状态,因为preferences.js可能在运行时更新了登录状态
    const isLoggedIn = Zotero.Prefs.get('extensions.researchopia.isLoggedIn');
    const accessToken = Zotero.Prefs.get('extensions.researchopia.accessToken');
    const tokenExpiresStr = Zotero.Prefs.get('extensions.researchopia.tokenExpires');
    
    // 如果prefs中有登录状态,但内存中没有,需要重新加载
    if (isLoggedIn && accessToken && (!instance.user || !instance.session)) {
      logger.log("[AuthManager] 🔄 Detected login in prefs, reloading session");
      await instance.loadStoredSession();
    }
    
    if (!instance.user || !instance.session) {
      return false;
    }

    // 检查会话是否过期(tokenExpires现在是字符串)
    if (tokenExpiresStr) {
      const tokenExpires = parseInt(tokenExpiresStr, 10);
      if (!isNaN(tokenExpires) && tokenExpires > 0 && Date.now() > tokenExpires) {
        logger.log("[AuthManager] ⚠️ Session expired, attempting to refresh token");
        
        // 尝试使用refresh_token刷新会话
        if (instance.session?.refresh_token) {
          const refreshed = await instance.refreshSession();
          if (refreshed) {
            logger.log("[AuthManager] ✅ Session refreshed successfully");
            return true;
          }
        }
        
        logger.log("[AuthManager] ❌ Session refresh failed, signing out");
        await AuthManager.signOut();
        return false;
      }
    }

    return true;
  }

  public static async checkSession(): Promise<{ isValid: boolean; user?: any; error?: string }> {
    const instance = AuthManager.getInstance();
    
    try {
      if (!instance.session?.access_token || !instance.supabase) {
        return { isValid: false, error: '未登录' };
      }
      
      // 向 Supabase 验证当前会话
      const response = await instance.supabase.makeRequest('/auth/v1/user', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${instance.session.access_token}`
        }
      });
      
      if (!response.ok) {
        logger.log("[AuthManager] Session validation failed, signing out");
        await AuthManager.signOut();
        return { isValid: false, error: '会话已失效，请重新登录' };
      }
      
      const userData = await response.json();
      
      // 更新用户信息
      instance.user = {
        ...instance.user,
        ...userData,
        last_check_at: new Date().toISOString()
      };
      
      await instance.saveSession();
      return { isValid: true, user: instance.user };
      
    } catch (error) {
      logger.error("[AuthManager] Session check error:", error);
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : '网络错误' 
      };
    }
  }

  public static getCurrentUser(): any {
    const instance = AuthManager.getInstance();
    return instance.user;
  }

  public static getSession(): any {
    const instance = AuthManager.getInstance();
    return instance.session;
  }

  private async loadStoredSession(): Promise<void> {
    const ztoolkit = (Zotero as any).Researchopia?.data?.ztoolkit;
    if (ztoolkit) {
      ztoolkit.log("[AuthManager] 🔄 loadStoredSession called");
    }
    logger.log("[AuthManager] 🔄 loadStoredSession called");
    try {
      // 从preferences.js保存的位置读取
      // preferences.js使用 Zotero.Prefs.set("extensions.researchopia.xxx")
      // Zotero.Prefs 内部会添加 "extensions.zotero." 前缀
      // 所以实际存储的key是: extensions.zotero.extensions.researchopia.xxx
      // 读取时也需要使用 "extensions.researchopia.xxx"
      const isLoggedIn = Zotero.Prefs.get('extensions.researchopia.isLoggedIn');
      const accessToken = Zotero.Prefs.get('extensions.researchopia.accessToken');
      const userEmail = Zotero.Prefs.get('extensions.researchopia.userEmail');
      const userId = Zotero.Prefs.get('extensions.researchopia.userId');
      const tokenExpiresStr = Zotero.Prefs.get('extensions.researchopia.tokenExpires');
      
      // tokenExpires现在是字符串,需要转换为数字
      const tokenExpires = tokenExpiresStr ? parseInt(tokenExpiresStr, 10) : 0;
      
      if (ztoolkit) {
        ztoolkit.log(`[AuthManager] 🔍 Reading prefs - isLoggedIn: ${isLoggedIn}, hasToken: ${!!accessToken}, email: ${userEmail}, expires: ${tokenExpires}`);
      }
      logger.log(`[AuthManager] 🔍 Reading prefs - isLoggedIn: ${isLoggedIn}, hasToken: ${!!accessToken}, email: ${userEmail}, expires: ${tokenExpires}`);
      
      // 检查tokenExpires是否有效(必须是正数且大于当前时间)
      if (tokenExpires && !isNaN(tokenExpires) && (tokenExpires < 0 || tokenExpires < Date.now())) {
        if (ztoolkit) {
          ztoolkit.log(`[AuthManager] ⚠️ Invalid or expired token (${tokenExpires}), clearing session`);
        }
        await this.clearSession();
        return;
      }
      
      // 优先尝试从AuthManager自己保存的位置读取(包含完整的user对象,含role)
      const storedUser = Zotero.Prefs.get('extensions.zotero.researchopia.user', true);
      const storedSession = Zotero.Prefs.get('extensions.zotero.researchopia.session', true);
      
      if (storedUser && storedSession) {
        this.user = JSON.parse(storedUser as string);
        this.session = JSON.parse(storedSession as string);
        
        logger.log("[AuthManager] 📥 Loaded stored session for user:", this.user?.email, "with role:", this.user?.role);
        
        // 检查存储的会话是否过期
        if (this.session.expires_at && Date.now() > this.session.expires_at) {
          logger.log("[AuthManager] Stored session expired, clearing");
          await this.clearSession();
          return;
        }
        
        return;
      }
      
      // 如果上面没有找到,尝试从preferences.js的格式读取(兼容旧版)
      if (isLoggedIn && accessToken && userEmail) {
        logger.log("[AuthManager] 📥 Loading session from preferences.js format (legacy)");
        
        this.user = {
          id: userId || '',
          email: userEmail,
          created_at: '',
          email_confirmed_at: '',
          last_sign_in_at: new Date().toISOString(),
          role: 'user' // 旧版本没有保存角色,默认为user
        };
        
        this.session = {
          access_token: accessToken,
          refresh_token: '',
          expires_at: tokenExpires || (Date.now() + 3600000), // 默认1小时
          token_type: 'bearer'
        };
        
        // 检查会话是否过期
        if (this.session.expires_at && Date.now() > this.session.expires_at) {
          logger.log("[AuthManager] Stored session expired, clearing");
          await this.clearSession();
          return;
        }
        
        logger.log("[AuthManager] 📥 Loaded stored session from preferences.js for user:", this.user?.email);
        return;
      }
    } catch (error) {
      logger.error("[AuthManager] ❌ Error loading stored session:", error);
      // 清理可能损坏的数据
      await this.clearSession();
    }
  }

  private async saveSession(): Promise<void> {
    try {
      if (this.user && this.session) {
        // 添加保存时间戳
        const sessionWithTimestamp = {
          ...this.session,
          saved_at: new Date().toISOString()
        };
        
        const userWithTimestamp = {
          ...this.user,
          saved_at: new Date().toISOString()
        };
        
        Zotero.Prefs.set('extensions.zotero.researchopia.user', JSON.stringify(userWithTimestamp), true);
        Zotero.Prefs.set('extensions.zotero.researchopia.session', JSON.stringify(sessionWithTimestamp), true);
        logger.log("[AuthManager] 💾 Session saved for user:", this.user.email);
      }
    } catch (error) {
      logger.error("[AuthManager] ❌ Error saving session:", error);
    }
  }

  private async clearSession(): Promise<void> {
    try {
      // 清除AuthManager自己保存的session
      Zotero.Prefs.clear('extensions.zotero.researchopia.user', true);
      Zotero.Prefs.clear('extensions.zotero.researchopia.session', true);
      
      // 也清除preferences.js保存的登录状态
      Zotero.Prefs.clear('extensions.researchopia.isLoggedIn');
      Zotero.Prefs.clear('extensions.researchopia.accessToken');
      Zotero.Prefs.clear('extensions.researchopia.userEmail');
      Zotero.Prefs.clear('extensions.researchopia.userId');
      Zotero.Prefs.clear('extensions.researchopia.userName');
      Zotero.Prefs.clear('extensions.researchopia.tokenExpires');
      Zotero.Prefs.clear('extensions.researchopia.loginTime');
      
      // 触发登出事件,通知UI更新
      try {
        const win = (Zotero as any).getMainWindow();
        if (win && win.document) {
          // 使用 document.createEvent 代替 CustomEvent (兼容 Firefox/Zotero)
          const event = win.document.createEvent('CustomEvent');
          event.initCustomEvent('researchopia:logout', true, false, null);
          win.document.dispatchEvent(event);
          logger.log("[AuthManager] 📢 Logout event dispatched on main window");
          
          // 通知所有打开的窗口 (包括偏好设置窗口)
          const windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"]
            .getService(Components.interfaces.nsIWindowMediator);
          const enumerator = windowMediator.getEnumerator(null);
          
          while (enumerator.hasMoreElements()) {
            try {
              const w = enumerator.getNext();
              if (w && w.document) {
                const evt = w.document.createEvent('CustomEvent');
                evt.initCustomEvent('researchopia:logout', true, false, null);
                w.document.dispatchEvent(evt);
                logger.log("[AuthManager] 📢 Logout event dispatched on window:", w.location?.href);
              }
            } catch (winError) {
              logger.error("[AuthManager] ⚠️ Error dispatching to window:", winError instanceof Error ? winError.message : String(winError));
            }
          }
        } else {
          logger.warn("[AuthManager] ⚠️ Main window or document not available for event dispatch");
        }
      } catch (eventError) {
        logger.error("[AuthManager] ❌ Error dispatching logout event:", eventError instanceof Error ? eventError.message : String(eventError));
      }
      
      logger.log("[AuthManager] 🧹 Session cleared");
    } catch (error) {
      logger.error("[AuthManager] ❌ Error clearing session:", error);
    }
  }

  public static async testConnection(): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      logger.log("[AuthManager] 🔍 Testing Supabase connection...");
      
      // 简单的健康检查请求
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        logger.log("[AuthManager] ✅ Connection test successful, response time:", responseTime + "ms");
        return { success: true, responseTime };
      } else {
        logger.error("[AuthManager] ❌ Connection test failed with status:", response.status);
        return { success: false, error: `服务器响应错误 (${response.status})` };
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error("[AuthManager] ❌ Connection test error:", error);
      
      if (error instanceof Error) {
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          return { success: false, error: '网络连接失败，请检查网络设置' };
        }
        return { success: false, error: `连接错误: ${error.message}` };
      }
      
      return { success: false, error: '未知连接错误' };
    }
  }

  /**
   * 刷新会话token
   */
  public async refreshSession(): Promise<boolean> {
    try {
      if (!this.session?.refresh_token || !this.supabase) {
        logger.error("[AuthManager] No refresh_token available");
        return false;
      }
      
      logger.log("[AuthManager] 🔄 Refreshing session token...");
      
      const response = await this.supabase.makeRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({
          refresh_token: this.session.refresh_token
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        logger.error("[AuthManager] ❌ Token refresh failed:", data);
        return false;
      }
      
      // 更新会话信息
      const expiresIn = data.expires_in || 3600;
      const extendedExpiresIn = Math.max(expiresIn, 2592000); // 至少30天
      
      this.session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || this.session.refresh_token, // 保留旧的refresh_token以防万一
        expires_at: Date.now() + (extendedExpiresIn * 1000),
        expires_in: extendedExpiresIn,
        token_type: data.token_type
      };
      
      // 更新用户信息
      if (data.user) {
        this.user = {
          ...this.user,
          ...data.user,
          last_refresh_at: new Date().toISOString()
        };
      }
      
      await this.saveSession();
      logger.log("[AuthManager] ✅ Session refreshed successfully");
      return true;
      
    } catch (error) {
      logger.error("[AuthManager] ❌ Session refresh error:", error);
      return false;
    }
  }

  public static cleanup(): void {
    const instance = AuthManager.getInstance();
    instance.user = null;
    instance.session = null;
    instance.isInitialized = false;
    AuthManager.instance = null;
    logger.log("[AuthManager] Cleanup completed");
  }
}