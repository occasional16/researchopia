// Researchopia Preferences Script
// This file handles the preference panel UI interactions

// Use Zotero.debug instead of console.log for compatibility
if (typeof Zotero !== 'undefined' && Zotero.debug) {
  Zotero.debug("[Researchopia] Preferences.js loaded");
}

// Supabase configuration
const SUPABASE_URL = 'https://obcblvdtqhwrihoddlez.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4';

// Debug logging helper for preferences context
function debugLog(...args) {
  try {
    if (typeof Zotero !== 'undefined' && Zotero.debug) {
      Zotero.debug(args.join(' '));
    } else if (typeof console !== 'undefined' && console.log) {
      console.log(...args);
    }
  } catch (e) {
    // Silent fallback if both fail
  }
}

// Global preferences object
var researchopiaPrefs = {
  initialized: false,
  
  // Test connection function
  testSupabaseConnection: async function() {
    const startTime = Date.now();
    try {
      debugLog("[Researchopia] Testing Supabase connection...");
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      
      const responseTime = Date.now() - startTime;
      debugLog("[Researchopia] Connection test result:", response.status, responseTime + "ms");
      
      return {
        success: response.ok,
        responseTime: responseTime,
        error: response.ok ? null : `服务器响应错误 (${response.status})`
      };
    } catch (error) {
      debugLog("[Researchopia] Connection test error:", error);
      return {
        success: false,
        error: '网络连接失败，请检查网络设置'
      };
    }
  },
  
  // Supabase login function (now uses AuthManager for role fetching)
  testLogin: async function(email, password) {
    try {
      // 等待AuthManager初始化(最多5秒)
      debugLog("[Researchopia] Waiting for AuthManager to initialize...");
      let retries = 50; // 50 * 100ms = 5秒
      while (retries > 0) {
        const addon = Zotero.Researchopia;
        if (addon && addon.authManager) {
          debugLog("[Researchopia] ✅ AuthManager ready, calling signIn");
          const result = await addon.authManager.signIn(email, password);
          debugLog("[Researchopia] AuthManager.signIn result:", result.success, result.error || 'no error');
          
          if (result.success) {
            return {
              success: true,
              data: {
                access_token: addon.authManager.session?.access_token,
                user: result.user
              },
              error: null
            };
          } else {
            return {
              success: false,
              data: null,
              error: result.error || '登录失败'
            };
          }
        }
        
        // 等待100ms后重试
        await new Promise(resolve => setTimeout(resolve, 100));
        retries--;
      }
      
      // 超时后使用fallback
      debugLog("[Researchopia] ❌ AuthManager not available after 5s, falling back to direct login");
      return await this.directLogin(email, password);
      
    } catch (error) {
      debugLog("[Researchopia] Login error:", error);
      return {
        success: false,
        error: '网络错误,请检查网络连接'
      };
    }
  },
  
  // Direct login fallback (without role fetching)
  directLogin: async function(email, password) {
    try {
      debugLog("[Researchopia] Attempting direct login for:", email);
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });
      
      const data = await response.json();
      debugLog("[Researchopia] Login response:", response.status, data);
      
      // Check if login was successful
      if (response.ok && data.access_token) {
        return {
          success: true,
          data: data,
          error: null
        };
      } else {
        return {
          success: false,
          data: data,
          error: data.error_description || data.error || data.message || '登录失败'
        };
      }
    } catch (error) {
      debugLog("[Researchopia] Login error:", error);
      return {
        success: false,
        error: '网络错误，请检查网络连接'
      };
    }
  },
  
  // User registration function
  registerUser: async function(email, password) {
    try {
      debugLog("[Researchopia] Attempting registration for:", email);
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });
      
      const data = await response.json();
      debugLog("[Researchopia] Registration response:", response.status, data);
      
      return {
        success: response.ok,
        data: data,
        error: response.ok ? null : (data.error_description || data.message || '注册失败')
      };
    } catch (error) {
      debugLog("[Researchopia] Registration error:", error);
      return {
        success: false,
        error: '网络错误，请检查网络连接'
      };
    }
  },
  
  // Show message function
  showMessage: function(message, type) {
    // 尝试在登录表单区域显示消息
    let messageDiv = document.getElementById("login-message");
    
    // 如果登录表单不可见，尝试在已登录状态区域显示消息
    if (!messageDiv || messageDiv.closest('#login-form-section').style.display === 'none') {
      messageDiv = document.getElementById("status-message");
    }
    
    if (messageDiv) {
      messageDiv.textContent = message;
      messageDiv.className = `message ${type}`;
      
      if (type === "success" || type === "info") {
        setTimeout(() => {
          messageDiv.textContent = "";
          messageDiv.className = "message";
        }, 3000);
      }
    }
  },
  
  // Set button loading state
  setButtonLoading: function(button, loading) {
    if (!button) return;
    const textSpan = button.querySelector(".btn-text");
    const loadingSpan = button.querySelector(".btn-loading");
    
    if (textSpan && loadingSpan) {
      if (loading) {
        textSpan.style.display = "none";
        loadingSpan.style.display = "inline";
        button.disabled = true;
      } else {
        textSpan.style.display = "inline";
        loadingSpan.style.display = "none";
        button.disabled = false;
      }
    }
  },

  // 保存登录状态到Zotero偏好设置
  saveLoginState: function(loginData, email) {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        // 保存登录信息（不包含敏感的token）
        Zotero.Prefs.set("extensions.researchopia.userEmail", email);
        Zotero.Prefs.set("extensions.researchopia.isLoggedIn", true);
        Zotero.Prefs.set("extensions.researchopia.loginTime", new Date().toISOString());
        
        // 保存用户信息
        if (loginData.user) {
          const username = 
            loginData.user.username ||
            loginData.user.user_metadata?.username ||
            (loginData.user.email ? loginData.user.email.split("@")[0] : null) ||
            (email ? email.split("@")[0] : "用户");
          Zotero.Prefs.set("extensions.researchopia.userName", username);
          Zotero.Prefs.set("extensions.researchopia.userId", loginData.user.id || "");
        }
        
        // 可以选择保存token（注意安全性）
        if (loginData.access_token) {
          Zotero.Prefs.set("extensions.researchopia.accessToken", loginData.access_token);
          // 保存过期时间 - 计算绝对时间戳,保存为字符串避免整数溢出
          if (loginData.expires_in) {
            const expiresAt = Date.now() + (loginData.expires_in * 1000);
            Zotero.Prefs.set("extensions.researchopia.tokenExpires", String(expiresAt));
            console.log("[Researchopia] Token expires at:", expiresAt, "saved as string");
          }
        }
        
        debugLog("[Researchopia] Login state saved to preferences");
      }
    } catch (error) {
      debugLog("[Researchopia] Error saving login state:", error);
    }
  },

  // 显示已登录状态
  showLoggedInState: function(user, email) {
    const loginContainer = document.getElementById("login-form-section");
    const loggedInContainer = document.getElementById("logged-in-section");
    
    if (loginContainer && loggedInContainer) {
      // 隐藏登录表单，显示已登录状态
      loginContainer.style.display = "none";
      loggedInContainer.style.display = "block";
      
      // 更新用户信息显示
      const userNameDisplay = document.getElementById("user-name-display");
      const userEmailDisplay = document.getElementById("user-email-display");
      const loginTimeDisplay = document.getElementById("login-time-display");
      
      if (userNameDisplay) {
        // 优先显示username,如果没有则显示email前缀
        const displayName = user?.username || user?.email?.split('@')[0] || email.split('@')[0];
        userNameDisplay.textContent = displayName;
      }
      if (userEmailDisplay) {
        // 显示完整email
        userEmailDisplay.textContent = email;
      }
      if (loginTimeDisplay) {
        loginTimeDisplay.textContent = new Date().toLocaleString('zh-CN');
      }
    }
  },

  // 检查并恢复登录状态
  checkLoginState: function() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        const isLoggedIn = Zotero.Prefs.get("extensions.researchopia.isLoggedIn", false);
        const userEmail = Zotero.Prefs.get("extensions.researchopia.userEmail", "");
        let userName = Zotero.Prefs.get("extensions.researchopia.userName", "");
        const loginTime = Zotero.Prefs.get("extensions.researchopia.loginTime", "");
        // tokenExpires现在保存为字符串,需要转换为数字
        const tokenExpiresStr = Zotero.Prefs.get("extensions.researchopia.tokenExpires", "0");
        const tokenExpires = tokenExpiresStr ? parseInt(tokenExpiresStr, 10) : 0;

        // 若缓存的用户名缺失或等同邮箱，尝试从AuthManager获取最新用户名
        if (typeof Zotero !== "undefined") {
          const addon = Zotero.Researchopia;
          const authUser = addon?.authManager?.user;
          if (authUser?.username && (!userName || userName === userEmail)) {
            userName = authUser.username;
            Zotero.Prefs.set("extensions.researchopia.userName", userName);
          }
        }
        
        // 检查token是否过期 (tokenExpires是毫秒时间戳)
        const now = Date.now();
        
        // 详细日志查看数值
        console.log("[Researchopia] Token check - tokenExpires:", tokenExpires, 
                   "type:", typeof tokenExpires, 
                   "now:", now, 
                   "diff:", (tokenExpires - now), 
                   "comparison:", (tokenExpires > now));
        
        // 如果tokenExpires是0或无效,说明是刚登录还没设置,不应该清除
        // 如果tokenExpires是负数或NaN,说明是错误数据,应该清除
        // 如果tokenExpires > 0 但 < now,说明真的过期了,应该清除
        const tokenValid = !tokenExpires || isNaN(tokenExpires) || (tokenExpires > 0 && tokenExpires > now);
        
        console.log("[Researchopia] Checking login state:", 
                   "isLoggedIn=" + isLoggedIn, 
                   "userEmail=" + userEmail, 
                   "tokenValid=" + tokenValid, 
                   "tokenExpires=" + tokenExpires, 
                   "now=" + now);
        
        if (isLoggedIn && userEmail && tokenValid) {
          // 显示已登录状态
          const loginContainer = document.getElementById("login-form-section");
          const loggedInContainer = document.getElementById("logged-in-section");
          
          if (loginContainer && loggedInContainer) {
            loginContainer.style.display = "none";
            loggedInContainer.style.display = "block";
            
            // 更新用户信息显示
            const userNameDisplay = document.getElementById("user-name-display");
            const userEmailDisplay = document.getElementById("user-email-display");
            const loginTimeDisplay = document.getElementById("login-time-display");
            
            if (userNameDisplay) {
              const safeUserName = userName || (userEmail ? userEmail.split("@")[0] : "用户");
              userNameDisplay.textContent = safeUserName;
            }
            if (userEmailDisplay) {
              userEmailDisplay.textContent = userEmail;
            }
            if (loginTimeDisplay) {
              const loginDate = new Date(loginTime);
              loginTimeDisplay.textContent = loginDate.toLocaleString('zh-CN');
            }
            
            debugLog("[Researchopia] Login state restored");
          }
        } else if (isLoggedIn && (!tokenValid)) {
          // Token过期，清除登录状态
          debugLog("[Researchopia] Token expired, clearing login state");
          this.clearLoginState();
        }
      }
    } catch (error) {
      debugLog("[Researchopia] Error checking login state:", error);
    }
  },

  // 清除登录状态
  clearLoginState: function() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        Zotero.Prefs.clear("extensions.researchopia.userEmail");
        Zotero.Prefs.clear("extensions.researchopia.isLoggedIn");
        Zotero.Prefs.clear("extensions.researchopia.loginTime");
        Zotero.Prefs.clear("extensions.researchopia.userName");
        Zotero.Prefs.clear("extensions.researchopia.userId");
        Zotero.Prefs.clear("extensions.researchopia.accessToken");
        Zotero.Prefs.clear("extensions.researchopia.tokenExpires");
        
        debugLog("[Researchopia] Login state cleared");
      }
      
      // 恢复登录界面显示
      const loginContainer = document.getElementById("login-form-section");
      const loggedInContainer = document.getElementById("logged-in-section");
      
      if (loginContainer && loggedInContainer) {
        loginContainer.style.display = "block";
        loggedInContainer.style.display = "none";
      }
      
      // 清空输入框
      const emailInput = document.getElementById("email-input");
      const passwordInput = document.getElementById("password-input");
      if (emailInput) emailInput.value = "";
      if (passwordInput) passwordInput.value = "";
      
    } catch (error) {
      debugLog("[Researchopia] Error clearing login state:", error);
    }
  },

  // 获取当前选中的论文项目
  getCurrentItem: function() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.getActiveZoteroPane) {
        const zoteroPane = Zotero.getActiveZoteroPane();
        if (zoteroPane) {
          const selectedItems = zoteroPane.getSelectedItems();
          if (selectedItems && selectedItems.length > 0) {
            return selectedItems[0];
          }
        }
      }
      return null;
    } catch (error) {
      debugLog("[Researchopia] Error getting current item:", error);
      return null;
    }
  },

  // 获取指定论文的所有标注
  getItemAnnotations: async function(item) {
    try {
      if (!item) return [];

      debugLog("[Researchopia] Getting annotations for item:", item.getField('title'));      // 获取附件
      const attachments = await item.getAttachments();
      let allAnnotations = [];
      
      for (let attachmentID of attachments) {
        const attachment = Zotero.Items.get(attachmentID);
        if (attachment && attachment.isPDFAttachment()) {
          // 获取此附件的所有标注
          const annotations = attachment.getAnnotations();
          for (let annotationID of annotations) {
            const annotation = Zotero.Items.get(annotationID);
            if (annotation) {
              // 收集标注的详细信息
              const annotationData = {
                id: annotation.id,
                key: annotation.key,
                type: annotation.annotationType,
                text: annotation.annotationText || '',
                comment: annotation.annotationComment || '',
                color: annotation.annotationColor || '',
                pageLabel: annotation.annotationPageLabel || '',
                position: annotation.annotationPosition,
                sortIndex: annotation.annotationSortIndex,
                dateAdded: annotation.dateAdded,
                dateModified: annotation.dateModified,
                tags: annotation.getTags().map(tag => tag.tag),
                attachmentTitle: attachment.getField('title'),
                attachmentID: attachment.id
              };
              allAnnotations.push(annotationData);
            }
          }
        }
      }
      
      // 按页码和位置排序
      allAnnotations.sort((a, b) => {
        if (a.pageLabel !== b.pageLabel) {
          return (parseInt(a.pageLabel) || 0) - (parseInt(b.pageLabel) || 0);
        }
        return (a.sortIndex || 0) - (b.sortIndex || 0);
      });
      
      debugLog(`[Researchopia] Found ${allAnnotations.length} annotations`);
      return allAnnotations;
      
    } catch (error) {
      console.error("[Researchopia] Error getting annotations:", error);
      return [];
    }
  },

  // 从Supabase获取标注的共享状态
  getAnnotationShareStatus: async function(annotationKey) {
    try {
      const accessToken = Zotero.Prefs.get("extensions.researchopia.accessToken", "");
      if (!accessToken) return null;
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/annotations?annotation_key=eq.${annotationKey}&select=*`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.length > 0 ? data[0] : null;
      }
      
      return null;
    } catch (error) {
      console.error("[Researchopia] Error getting annotation share status:", error);
      return null;
    }
  },

  // 更新标注的共享状态到Supabase
  updateAnnotationShareStatus: async function(annotation, isShared, isAnonymous = false) {
    try {
      const accessToken = Zotero.Prefs.get("extensions.researchopia.accessToken", "");
      const userEmail = Zotero.Prefs.get("extensions.researchopia.userEmail", "");
      
      if (!accessToken || !userEmail) {
        throw new Error("请先登录");
      }
      
      const annotationData = {
        annotation_key: annotation.key,
        user_email: userEmail,
        is_shared: isShared,
        is_anonymous: isAnonymous,
        annotation_type: annotation.type,
        annotation_text: annotation.text || '',
        annotation_comment: annotation.comment || '',
        annotation_color: annotation.color || '',
        page_label: annotation.pageLabel || '',
        position_data: JSON.stringify(annotation.position || {}),
        tags: annotation.tags || [],
        date_created: new Date().toISOString(),
        date_modified: new Date().toISOString()
      };
      
      // 检查是否已存在
      const existing = await this.getAnnotationShareStatus(annotation.key);
      let response;
      
      if (existing) {
        // 更新现有记录
        response = await fetch(`${SUPABASE_URL}/rest/v1/annotations?annotation_key=eq.${annotation.key}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            is_shared: isShared,
            is_anonymous: isAnonymous,
            date_modified: new Date().toISOString()
          })
        });
      } else if (isShared) {
        // 创建新记录（只有在要共享时才创建）
        response = await fetch(`${SUPABASE_URL}/rest/v1/annotations`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(annotationData)
        });
      }
      
      if (response && !response.ok) {
        throw new Error(`数据库操作失败: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error("[Researchopia] Error updating annotation share status:", error);
      throw error;
    }
  }
};

// Event handler functions
function onTestConnection() {
  console.log("[Researchopia] Test connection button clicked");
  
  const btn = document.getElementById("test-connection-btn");
  if (!btn) {
    console.error("[Researchopia] Test connection button not found");
    return;
  }
  
  researchopiaPrefs.setButtonLoading(btn, true);
  researchopiaPrefs.showMessage("正在测试与Supabase的连接...", "info");
  
  researchopiaPrefs.testSupabaseConnection().then(result => {
    if (result.success) {
      researchopiaPrefs.showMessage(`连接成功！响应时间: ${result.responseTime}ms`, "success");
    } else {
      researchopiaPrefs.showMessage(`连接失败: ${result.error}`, "error");
    }
    researchopiaPrefs.setButtonLoading(btn, false);
  }).catch(error => {
    console.error("[Researchopia] Test connection error:", error);
    researchopiaPrefs.showMessage("测试连接时发生错误", "error");
    researchopiaPrefs.setButtonLoading(btn, false);
  });
}

function onLogin() {
  console.log("[Researchopia] Login button clicked");
  
  const emailInput = document.getElementById("email-input");
  const passwordInput = document.getElementById("password-input");
  const loginBtn = document.getElementById("login-btn");
  
  if (!emailInput || !passwordInput) {
    console.log("[Researchopia] Input elements not found");
    researchopiaPrefs.showMessage("找不到输入框", "error");
    return;
  }
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  console.log("[Researchopia] Login values:", { email, passwordLength: password ? password.length : 0 });
  
  if (!email || !password) {
    console.log("[Researchopia] Missing email or password");
    researchopiaPrefs.showMessage("请输入邮箱和密码", "error");
    return;
  }
  
  console.log("[Researchopia] Setting button loading and calling testLogin");
  researchopiaPrefs.setButtonLoading(loginBtn, true);
  researchopiaPrefs.showMessage("正在登录...", "info");
  
  console.log("[Researchopia] About to call testLogin with email:", email);
  researchopiaPrefs.testLogin(email, password).then(result => {
    console.log("[Researchopia] testLogin resolved with result:", result.success);
    if (result.success) {
      researchopiaPrefs.showMessage("登录成功！", "success");
      // 先清空旧状态再保存新状态
      researchopiaPrefs.clearLoginState();
      // 保存登录信息
      researchopiaPrefs.saveLoginState(result.data, email);
      // 显示登录状态
      researchopiaPrefs.showLoggedInState(result.data.user, email);
    } else {
      researchopiaPrefs.showMessage(`登录失败: ${result.error}`, "error");
    }
    researchopiaPrefs.setButtonLoading(loginBtn, false);
  }).catch(error => {
    console.error("[Researchopia] Login error:", error);
    researchopiaPrefs.showMessage("登录时发生错误", "error");
    researchopiaPrefs.setButtonLoading(loginBtn, false);
  });
}

// onSignup function removed - users should register on website

// 处理外部链接
function openExternalLink(url) {
  try {
    if (typeof Components !== 'undefined' && Components.classes) {
      // Zotero 7/8 方式
      const externalLinkSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
        .getService(Components.interfaces.nsIExternalProtocolService);
      const ioService = Components.classes["@mozilla.org/network/io-service;1"]
        .getService(Components.interfaces.nsIIOService);
      const uri = ioService.newURI(url, null, null);
      externalLinkSvc.loadURI(uri);
    } else if (typeof Zotero !== 'undefined' && Zotero.launchURL) {
      // 备选方式
      Zotero.launchURL(url);
    } else if (typeof window !== 'undefined' && window.open) {
      // 最后备选
      window.open(url, '_blank');
    }
    debugLog("[Researchopia] Opened external link:", url);
  } catch (error) {
    debugLog("[Researchopia] Error opening external link:", error);
  }
}

// 登出按钮事件处理
function onLogout() {
  console.log("[Researchopia] Logout button clicked");
  
  researchopiaPrefs.clearLoginState();
  researchopiaPrefs.showMessage("已成功登出", "success");
}

// 检查状态按钮事件处理  
function onCheckStatus() {
  console.log("[Researchopia] Check status button clicked");
  
  const btn = document.getElementById("check-status-btn");
  researchopiaPrefs.setButtonLoading(btn, true);
  
  // 重新检查登录状态
  setTimeout(() => {
    researchopiaPrefs.checkLoginState();
    researchopiaPrefs.showMessage("状态检查完成", "info");
    researchopiaPrefs.setButtonLoading(btn, false);
  }, 500);
}

// 同步数据按钮事件处理
function onSync() {
  console.log("[Researchopia] Sync button clicked");
  
  const btn = document.getElementById("sync-btn");
  researchopiaPrefs.setButtonLoading(btn, true);
  
  // 模拟同步操作
  setTimeout(() => {
    researchopiaPrefs.showMessage("数据同步功能开发中", "info");
    researchopiaPrefs.setButtonLoading(btn, false);
  }, 1000);
}

// Ensure functions are globally accessible - CRITICAL for Zotero 8
// Multiple strategies for maximum compatibility
function ensureGlobalAccess() {
  try {
    // Strategy 1: window object
    if (typeof window !== 'undefined') {
      window.onTestConnection = onTestConnection;
      window.onLogin = onLogin;
      window.onLogout = onLogout;
      window.onCheckStatus = onCheckStatus;
      window.onSync = onSync;
      window.openExternalLink = openExternalLink;

      window.researchopiaPrefs = researchopiaPrefs;
      debugLog("[Researchopia] Functions assigned to window object");
    }
  } catch (e) {
    debugLog("[Researchopia] Error assigning to window:", e);
  }
  
  try {
    // Strategy 2: globalThis
    globalThis.onTestConnection = onTestConnection;
    globalThis.onLogin = onLogin;
    globalThis.onLogout = onLogout;
    globalThis.onCheckStatus = onCheckStatus;
    globalThis.onSync = onSync;
    globalThis.openExternalLink = openExternalLink;

    globalThis.researchopiaPrefs = researchopiaPrefs;
    debugLog("[Researchopia] Functions assigned to globalThis");
  } catch (e) {
    debugLog("[Researchopia] Error assigning to globalThis:", e);
  }
  
  try {
    // Strategy 3: this context
    this.onTestConnection = onTestConnection;
    this.onLogin = onLogin;
    this.onLogout = onLogout;
    this.onCheckStatus = onCheckStatus;
    this.onSync = onSync;
    this.openExternalLink = openExternalLink;

    this.researchopiaPrefs = researchopiaPrefs;
    debugLog("[Researchopia] Functions assigned to this context");
  } catch (e) {
    debugLog("[Researchopia] Error assigning to this:", e);
  }
}

// Initialize immediately
ensureGlobalAccess();

// Also try on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    ensureGlobalAccess();
    // 检查登录状态
    setTimeout(() => researchopiaPrefs.checkLoginState(), 200);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      ensureGlobalAccess();
      // 检查登录状态
      setTimeout(() => researchopiaPrefs.checkLoginState(), 200);
    });
  }
}

// Fallback timeout
setTimeout(ensureGlobalAccess, 100);


// 延迟检查登录状态
setTimeout(() => researchopiaPrefs.checkLoginState(), 500);

debugLog("[Researchopia] Preferences script initialization complete");
debugLog("[Researchopia] Function types:", {
  onTestConnection: typeof onTestConnection,
  onLogin: typeof onLogin,
  onLogout: typeof onLogout,
  onCheckStatus: typeof onCheckStatus,
  onSync: typeof onSync,

  windowOnTestConnection: typeof (window && window.onTestConnection),
  globalThisOnTestConnection: typeof globalThis.onTestConnection
});