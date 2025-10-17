import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { AuthManager } from "./auth";
import { getPref, setPref } from "../utils/prefs";
import { logger } from "../utils/logger";

export async function registerPrefsScripts(_window: Window) {
  try {
    logger.log("[Researchopia] 🔧 registerPrefsScripts called with window:", !!_window);
    
    // Get addon safely
    const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
    
    if (!addon) {
      logger.error("[Researchopia] ❌ Addon not available");
      console.warn("[PreferenceScript] Addon not available");
      return;
    }
    
    logger.log("[Researchopia] ✅ Addon found, setting up preferences...");
  } catch (error) {
    logger.error("[Researchopia] ❌ registerPrefsScripts error:", error);
    console.error("[PreferenceScript] Error:", error);
    return;
  }
  
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
      columns: [],
      rows: [],
    };
  } else {
    addon.data.prefs.window = _window;
  }
  updatePrefsUI();
  bindPrefEvents();
}

async function updatePrefsUI() {
  const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
  logger.log("[Researchopia] 🔧 updatePrefsUI called, addon:", !!addon, "prefs window:", !!addon?.data.prefs?.window);
  
  if (!addon || !addon.data.prefs?.window) {
    logger.error("[Researchopia] ❌ No addon or prefs window available");
    return;
  }

  const doc = addon.data.prefs.window.document;
  
  logger.log("[Researchopia] 🔧 Updating login status...");
  // Update login status display
  await updateLoginStatus(doc);
}

async function updateLoginStatus(doc: Document) {
  const loginFormSection = doc.getElementById("login-form-section");
  const loggedInSection = doc.getElementById("logged-in-section");
  
  if (!loginFormSection || !loggedInSection) {
    console.error("[Researchopia] Could not find login form or logged-in sections");
    return;
  }

  const isLoggedIn = await AuthManager.isLoggedIn();
  
  if (isLoggedIn) {
    const user = AuthManager.getCurrentUser();
    const loginTime = user?.last_sign_in_at || user?.saved_at;
    const formattedTime = loginTime ? new Date(loginTime).toLocaleString('zh-CN') : '未知';
    
    // 更新用户信息显示
    const userNameDisplay = doc.getElementById("user-name-display");
    const userEmailDisplay = doc.getElementById("user-email-display");
    const loginTimeDisplay = doc.getElementById("login-time-display");
    
    if (userNameDisplay) userNameDisplay.textContent = user?.email?.split('@')[0] || '未知用户';
    if (userEmailDisplay) userEmailDisplay.textContent = user?.email || '未知邮箱';
    if (loginTimeDisplay) loginTimeDisplay.textContent = formattedTime;
    
    // 切换显示状态
    loginFormSection.style.display = "none";
    loggedInSection.style.display = "block";
    
    // 重新绑定已登录状态的事件
    bindLoggedInEvents(doc);
  } else {
    // 显示登录表单
    loginFormSection.style.display = "block";
    loggedInSection.style.display = "none";
  }
}

function bindLoggedInEvents(doc: Document) {
  // Add check status event listener
  const checkStatusBtn = doc.getElementById("check-status-btn");
  checkStatusBtn?.addEventListener("click", async () => {
    setButtonLoading(checkStatusBtn, true);
    const statusMessage = doc.getElementById("status-message");
    if (statusMessage) statusMessage.textContent = "正在检测登录状态...";
    
    try {
      const result = await AuthManager.checkSession();
      if (result.isValid) {
        if (statusMessage) {
          statusMessage.textContent = "✅ 登录状态有效";
          statusMessage.className = "message success";
        }
        updateLoginStatus(doc); // 刷新用户信息显示
      } else {
        if (statusMessage) {
          statusMessage.textContent = `❌ ${result.error || '登录状态无效'}`;
          statusMessage.className = "message error";
        }
        updateLoginStatus(doc); // 可能需要切换到登录界面
      }
    } catch (error) {
      if (statusMessage) {
        statusMessage.textContent = "检测失败，请重试";
        statusMessage.className = "message error";
      }
    } finally {
      setButtonLoading(checkStatusBtn, false);
    }
  });

  // Add logout event listener
  const logoutBtn = doc.getElementById("logout-btn");
  logoutBtn?.addEventListener("click", async () => {
    if (confirm("确定要退出登录吗？")) {
      setButtonLoading(logoutBtn, true);
      try {
        await AuthManager.signOut();
        updateLoginStatus(doc);
        const statusMessage = doc.getElementById("status-message");
        if (statusMessage) {
          statusMessage.textContent = "✅ 已成功退出登录";
          statusMessage.className = "message success";
        }
      } catch (error) {
        const statusMessage = doc.getElementById("status-message");
        if (statusMessage) {
          statusMessage.textContent = "退出登录时发生错误";
          statusMessage.className = "message error";
        }
      } finally {
        setButtonLoading(logoutBtn, false);
      }
    }
  });

  // Add sync event listener
  const syncBtn = doc.getElementById("sync-btn");
  syncBtn?.addEventListener("click", async () => {
    setButtonLoading(syncBtn, true);
    const statusMessage = doc.getElementById("status-message");
    if (statusMessage) {
      statusMessage.textContent = "正在同步数据...";
      statusMessage.className = "message info";
    }
    
    try {
      // TODO: 实现实际的数据同步逻辑
      await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟同步
      if (statusMessage) {
        statusMessage.textContent = "✅ 数据同步成功";
        statusMessage.className = "message success";
      }
    } catch (error) {
      if (statusMessage) {
        statusMessage.textContent = "❌ 数据同步失败";
        statusMessage.className = "message error";
      }
    } finally {
      setButtonLoading(syncBtn, false);
    }
  });
}

function bindLoginFormEvents(doc: Document) {
  logger.log("[Researchopia] 🔧 bindLoginFormEvents called");
  
  // Add login event listeners
  const testConnectionBtn = doc.getElementById("test-connection-btn");
  const loginBtn = doc.getElementById("login-btn");
  const signupBtn = doc.getElementById("signup-btn");
  const forgotPasswordLink = doc.getElementById("forgot-password");

  logger.log("[Researchopia] 🔧 Found buttons:", {
    testConnection: !!testConnectionBtn,
    login: !!loginBtn,
    signup: !!signupBtn,
    forgotPassword: !!forgotPasswordLink
  });

  // Connection test event listener
  testConnectionBtn?.addEventListener("click", async () => {
    logger.log("[Researchopia] 🔧 Test connection button clicked");
    setButtonLoading(testConnectionBtn, true);
    showMessage(doc, "正在测试与Supabase的连接...", "info");

    try {
      logger.log("[Researchopia] 🔧 Calling AuthManager.testConnection...");
      const result = await AuthManager.testConnection();
      logger.log("[Researchopia] 🔧 Test connection result:", result);
      
      if (result.success) {
        const responseTime = result.responseTime || 0;
        showMessage(doc, `✅ 连接成功！响应时间: ${responseTime}ms`, "success");
      } else {
        showMessage(doc, `❌ 连接失败: ${result.error}`, "error");
      }
    } catch (error) {
      logger.error("[Researchopia] ❌ Connection test error:", error);
      showMessage(doc, "❌ 连接测试时发生错误", "error");
    } finally {
      setButtonLoading(testConnectionBtn, false);
    }
  });

  loginBtn?.addEventListener("click", async () => {
    const email = (doc.getElementById("email-input") as HTMLInputElement)?.value.trim();
    const password = (doc.getElementById("password-input") as HTMLInputElement)?.value;
    const rememberMe = (doc.getElementById("remember-me") as HTMLInputElement)?.checked;

    if (!email || !password) {
      showMessage(doc, "请输入邮箱和密码", "error");
      return;
    }

    if (!isValidEmail(email)) {
      showMessage(doc, "请输入有效的邮箱地址", "error");
      return;
    }

    setButtonLoading(loginBtn, true);
    showMessage(doc, "正在登录...", "info");

    try {
      const result = await AuthManager.signIn(email, password);
      if (result.success) {
        if (rememberMe) {
          setPref("rememberLogin", true);
        }
        showMessage(doc, "✅ 登录成功！正在加载用户信息...", "success");
        
        // 延迟一秒让用户看到成功消息，然后更新界面
        setTimeout(() => {
          updateLoginStatus(doc);
          showMessage(doc, "🎉 欢迎回来！", "success");
        }, 1000);
      } else {
        // 根据错误类型提供具体的错误信息
        const errorMsg = getDetailedErrorMessage(result.error || '');
        showMessage(doc, `❌ ${errorMsg}`, "error");
      }
    } catch (error) {
      console.error("[Researchopia] Login error:", error);
      showMessage(doc, "❌ 网络连接错误，请检查网络设置后重试", "error");
    } finally {
      setButtonLoading(loginBtn, false);
    }
  });

  signupBtn?.addEventListener("click", async () => {
    const email = (doc.getElementById("email-input") as HTMLInputElement)?.value.trim();
    const password = (doc.getElementById("password-input") as HTMLInputElement)?.value;

    if (!email || !password) {
      showMessage(doc, "请输入邮箱和密码", "error");
      return;
    }

    if (!isValidEmail(email)) {
      showMessage(doc, "请输入有效的邮箱地址", "error");
      return;
    }

    if (password.length < 6) {
      showMessage(doc, "密码至少需要6位字符", "error");
      return;
    }

    setButtonLoading(signupBtn, true);
    showMessage(doc, "正在创建账户...", "info");

    try {
      const result = await AuthManager.signUp(email, password);
      if (result.success) {
        showMessage(doc, "✅ 账户创建成功！请检查邮箱进行验证后再登录。", "success");
        // 清空表单
        (doc.getElementById("email-input") as HTMLInputElement).value = '';
        (doc.getElementById("password-input") as HTMLInputElement).value = '';
      } else {
        const errorMsg = getSignupErrorMessage(result.error || '');
        showMessage(doc, `❌ ${errorMsg}`, "error");
      }
    } catch (error) {
      console.error("[Researchopia] Signup error:", error);
      showMessage(doc, "❌ 网络连接错误，请检查网络设置后重试", "error");
    } finally {
      setButtonLoading(signupBtn, false);
    }
  });

  forgotPasswordLink?.addEventListener("click", (e) => {
    e.preventDefault();
    showMessage(doc, "密码重置功能即将推出！", "info");
  });
}

function bindPrefEvents() {
  const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
  if (!addon?.data.prefs?.window) return;
  
  const doc = addon.data.prefs.window.document;
  
  // 绑定登录表单事件
  bindLoginFormEvents(doc);
  
  // Auto-upload annotations checkbox
  const autoUploadCheckbox = doc.querySelector("#auto-upload-annotations") as HTMLInputElement;
  if (autoUploadCheckbox) {
    autoUploadCheckbox.checked = getPref("autoUploadAnnotations") as boolean || false;
    autoUploadCheckbox.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      setPref("autoUploadAnnotations", checked);
    });
  }

  // Show notifications checkbox
  const showNotificationsCheckbox = doc.querySelector("#show-notifications") as HTMLInputElement;
  if (showNotificationsCheckbox) {
    showNotificationsCheckbox.checked = getPref("showNotifications") as boolean || true;
    showNotificationsCheckbox.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      setPref("showNotifications", checked);
    });
  }
}

// Helper functions
function showMessage(doc: Document, message: string, type: "success" | "error" | "info") {
  const messageDiv = doc.getElementById("login-message");
  if (!messageDiv) return;

  messageDiv.textContent = message;
  messageDiv.className = `message ${type}`;

  // Auto-hide success and info messages after 3 seconds
  if (type === "success" || type === "info") {
    setTimeout(() => {
      if (messageDiv.textContent === message) {
        messageDiv.textContent = "";
        messageDiv.className = "message";
      }
    }, 3000);
  }
}

function setButtonLoading(button: HTMLElement | null, loading: boolean) {
  if (!button) return;

  const textSpan = button.querySelector(".btn-text") as HTMLElement;
  const loadingSpan = button.querySelector(".btn-loading") as HTMLElement;

  if (textSpan && loadingSpan) {
    if (loading) {
      textSpan.style.display = "none";
      loadingSpan.style.display = "inline";
      button.setAttribute("disabled", "true");
    } else {
      textSpan.style.display = "inline";
      loadingSpan.style.display = "none";
      button.removeAttribute("disabled");
    }
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function getDetailedErrorMessage(error: string): string {
  if (!error) return '登录失败，请检查邮箱和密码';
  
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('invalid login credentials') || 
      lowerError.includes('invalid_credentials') || 
      lowerError.includes('unauthorized')) {
    return '邮箱或密码错误，请重新输入';
  }
  
  if (lowerError.includes('email not confirmed') || 
      lowerError.includes('email_not_confirmed')) {
    return '邮箱尚未验证，请检查您的邮箱并点击验证链接';
  }
  
  if (lowerError.includes('too many requests') || 
      lowerError.includes('rate_limit')) {
    return '登录尝试过于频繁，请稍后再试';
  }
  
  if (lowerError.includes('network') || 
      lowerError.includes('fetch') || 
      lowerError.includes('connection')) {
    return '网络连接失败，请检查网络设置';
  }
  
  if (lowerError.includes('timeout')) {
    return '连接超时，请重试';
  }
  
  // 返回原错误信息，但确保是中文友好的
  return `登录失败: ${error}`;
}

function getSignupErrorMessage(error: string): string {
  if (!error) return '注册失败，请重试';
  
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('user already registered') || 
      lowerError.includes('email_already_in_use') ||
      lowerError.includes('already exists')) {
    return '该邮箱已被注册，请使用其他邮箱或尝试登录';
  }
  
  if (lowerError.includes('password') && lowerError.includes('weak')) {
    return '密码强度不够，请使用至少8位字符，包含字母和数字';
  }
  
  if (lowerError.includes('email') && lowerError.includes('invalid')) {
    return '邮箱格式不正确，请输入有效的邮箱地址';
  }
  
  if (lowerError.includes('rate_limit') || lowerError.includes('too many')) {
    return '注册请求过于频繁，请稍后再试';
  }
  
  if (lowerError.includes('network') || 
      lowerError.includes('fetch') || 
      lowerError.includes('connection')) {
    return '网络连接失败，请检查网络设置';
  }
  
  return `注册失败: ${error}`;
}
