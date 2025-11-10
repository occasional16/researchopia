import { config, version as packageVersion } from "../../package.json";
import { getString } from "../utils/locale";
import { AuthManager } from "./auth";
import { getPref, setPref } from "../utils/prefs";
import { logger } from "../utils/logger";
import { ServicesAdapter } from "../adapters/services-adapter";

export async function registerPrefsScripts(_window: Window) {
  try {
    logger.log("[Researchopia] 🔧 registerPrefsScripts called with window:", !!_window);
    logger.log("[Researchopia] 🔍 Window readyState:", _window.document.readyState);
    
    // Get addon safely
    const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
    
    if (!addon) {
      logger.error("[Researchopia] ❌ Addon not available");
      return;
    }
    
    logger.log("[Researchopia] ✅ Addon found, setting up preferences...");
  } catch (error) {
    logger.error("[Researchopia] ❌ registerPrefsScripts error:", error);
    return;
  }
  
  // Get addon from Zotero namespace
  const addon = (globalThis as any).Zotero?.Researchopia;
  if (!addon) {
    logger.error("[Researchopia] ❌ Addon not found in Zotero namespace");
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
  
  // Wait for DOM elements to be available
  // In Zotero 8, preferences pane content might not be immediately available
  const doc = _window.document;
  let retries = 0;
  const maxRetries = 50;
  
  logger.log("[Researchopia] 🔍 Waiting for login-form-section element...");
  
  while (!doc.getElementById('login-form-section') && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
    if (retries % 10 === 0) {
      logger.log(`[Researchopia] ⏳ Retry ${retries}/${maxRetries}...`);
    }
  }
  
  if (doc.getElementById('login-form-section')) {
    logger.log("[Researchopia] ✅ DOM elements ready after", retries * 100, "ms");
    await updatePrefsUI();
    bindPrefEvents();
  } else {
    logger.error("[Researchopia] ❌ Timeout waiting for DOM elements");
  }
}

async function updatePrefsUI() {
  const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
  logger.log("[Researchopia] 🔧 updatePrefsUI called, addon:", !!addon, "prefs window:", !!addon?.data.prefs?.window);
  
  if (!addon || !addon.data.prefs?.window) {
    logger.error("[Researchopia] ❌ No addon or prefs window available");
    return;
  }

  const doc = addon.data.prefs.window.document;
  
  logger.log("[Researchopia] 🔧 Updating version display...");
  // Update version display from package.json
  updateVersionDisplay(doc);
  
  logger.log("[Researchopia] 🔧 Updating login status...");
  // Update login status display
  await updateLoginStatus(doc);
}

function updateVersionDisplay(doc: Document) {
  // Use version imported from package.json at build time
  const version = packageVersion;
  
  // Update title header
  const titleHeader = doc.getElementById("researchopia-title-header");
  if (titleHeader) {
    titleHeader.textContent = `🔬 研学港 Researchopia v${version}`;
    logger.log(`[Researchopia] Title header updated: v${version}`);
  } else {
    logger.warn("[Researchopia] Title header element not found");
  }
  
  // Update about section version
  const versionSpan = doc.getElementById("researchopia-version");
  if (versionSpan) {
    versionSpan.textContent = version;
    logger.log(`[Researchopia] Version span updated: ${version}`);
  } else {
    logger.warn("[Researchopia] Version span element not found");
  }
}

async function updateLoginStatus(doc: Document) {
  const loginFormSection = doc.getElementById("login-form-section");
  const loggedInSection = doc.getElementById("logged-in-section");
  
  if (!loginFormSection || !loggedInSection) {
    logger.error("Could not find login form or logged-in sections");
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
    
    if (userNameDisplay) userNameDisplay.textContent = user?.username || user?.email?.split('@')[0] || '未知用户';
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
    setButtonLoading(logoutBtn, true);
    try {
      await AuthManager.signOut();
      
      // 检查是否勾选了"记住密码"
      const rememberCredentials = getPref("rememberCredentials") as boolean;
      
      // 只有在未勾选"记住密码"时才清除凭证和输入框
      if (!rememberCredentials) {
        clearSavedCredentials();
        // 清空输入框
        const emailInput = doc.getElementById("email-input") as HTMLInputElement;
        const passwordInput = doc.getElementById("password-input") as HTMLInputElement;
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
      }
      
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
  logger.log("[Researchopia] 🔍 Document URL:", doc.URL);
  logger.log("[Researchopia] 🔍 Document has getElementById:", typeof doc.getElementById);
  
  // 加载保存的账号密码
  loadSavedCredentials(doc);
  
  // Add login event listeners
  const loginBtn = doc.getElementById("login-btn");
  const signupBtn = doc.getElementById("signup-btn");
  const forgotPasswordLink = doc.getElementById("forgot-password");
  
  // Try querySelector as fallback
  if (!loginBtn) {
    logger.warn("[Researchopia] 🔍 Trying querySelector for #login-btn");
    const qsLoginBtn = doc.querySelector("#login-btn");
    logger.log("[Researchopia] 🔍 querySelector result:", !!qsLoginBtn);
  }

  logger.log("[Researchopia] 🔧 Found buttons:", {
    login: !!loginBtn,
    signup: !!signupBtn,
    forgotPassword: !!forgotPasswordLink
  });

  loginBtn?.addEventListener("click", async () => {
    const email = (doc.getElementById("email-input") as HTMLInputElement)?.value.trim();
    const password = (doc.getElementById("password-input") as HTMLInputElement)?.value;
    const rememberCredentials = (doc.getElementById("remember-credentials") as HTMLInputElement)?.checked;

    if (!email || !password) {
      showMessage(doc, "请输入邮箱和密码", "error");
      return;
    }

    if (!isValidEmail(email)) {
      showMessage(doc, "请输入有效的邮箱地址", "error");
      return;
    }
    
    // No need to pre-check development environment - let the login request fail naturally if server is down
    // The API client will show appropriate error messages

    setButtonLoading(loginBtn, true);
    showMessage(doc, "正在登录...", "info");

    try {
      const result = await AuthManager.signIn(email, password);
      if (result.success) {
        // 保存或清除凭证
        if (rememberCredentials) {
          saveCredentials(email, password);
        } else {
          clearSavedCredentials();
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
      logger.error("Login error:", error);
      showMessage(doc, "❌ 网络连接错误,请检查网络设置后重试", "error");
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
      logger.error("Signup error:", error);
      showMessage(doc, "❌ 网络连接错误,请检查网络设置后重试", "error");
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
  
  // Diagnostic Report button
  const diagnosticReportBtn = doc.querySelector("#generate-diagnostic-report-btn") as HTMLButtonElement;
  if (diagnosticReportBtn) {
    logger.log("[Researchopia] 🔧 Binding diagnostic report button");
    diagnosticReportBtn.addEventListener("click", async () => {
      setButtonLoading(diagnosticReportBtn, true);
      showMessage(doc, "正在生成诊断报告...", "info");
      
      try {
        const { UIManager } = await import("./ui-manager");
        await UIManager.generateDiagnosticReport();
        showMessage(doc, "✅ 诊断报告已生成并复制到剪贴板", "success");
      } catch (error) {
        logger.error("[Researchopia] Diagnostic report generation failed:", error);
        showMessage(doc, "❌ 生成诊断报告失败", "error");
      } finally {
        setButtonLoading(diagnosticReportBtn, false);
      }
    });
  }
  
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

  // Development environment API checkbox
  const useDevEnvCheckbox = doc.querySelector("#use-dev-environment") as HTMLInputElement;
  if (useDevEnvCheckbox) {
    // Load current setting from prefs
    const currentApiUrl = (Zotero as any).Prefs.get('extensions.researchopia.apiBaseUrl', true) as string;
    useDevEnvCheckbox.checked = currentApiUrl === 'http://localhost:3000';
    
    logger.log("[Researchopia] 🔧 Development API checkbox initialized, checked:", useDevEnvCheckbox.checked);
    
    useDevEnvCheckbox.addEventListener("change", async (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      
      // Check if user is currently logged in
      const isLoggedIn = await AuthManager.isLoggedIn();
      
      if (checked) {
        // Warn user about switching to localhost
        if (isLoggedIn) {
          const confirmed = ServicesAdapter.confirm(
            '切换到开发环境',
            '切换到开发环境 API 后，你将登出当前账号。\n\n请确保本地开发服务器正在运行 (http://localhost:3000)，否则所有功能将不可用。\n\n是否继续？'
          );
          
          if (!confirmed) {
            // User cancelled, uncheck the box
            (e.target as HTMLInputElement).checked = false;
            return;
          }
          
          // Force logout before switching
          await AuthManager.signOut();
          updateLoginStatus(doc);
        }
        
        // Switch to development environment
        (Zotero as any).Prefs.set('extensions.researchopia.apiBaseUrl', 'http://localhost:3000', true);
        showMessage(doc, "✅ 已切换到开发环境 API (localhost:3000)", "success");
        logger.log("[Researchopia] 🔧 Switched to development API: http://localhost:3000");
      } else {
        // Warn user about switching back to production
        if (isLoggedIn) {
          const confirmed = ServicesAdapter.confirm(
            '切换到生产环境',
            '切换回生产环境后，你将登出当前账号。\n\n需要使用生产环境的账号重新登录。\n\n是否继续？'
          );
          
          if (!confirmed) {
            // User cancelled, keep the box checked
            (e.target as HTMLInputElement).checked = true;
            return;
          }
          
          // Force logout before switching
          await AuthManager.signOut();
          updateLoginStatus(doc);
        }
        
        // Clear preference to use production environment
        (Zotero as any).Prefs.clear('extensions.researchopia.apiBaseUrl', true);
        showMessage(doc, "✅ 已切换回生产环境 API (researchopia.com)", "success");
        logger.log("[Researchopia] 🔧 Switched to production API");
      }
      
      // Update API display
      updateCurrentApiDisplay(doc);
    });
  }

  // Custom API URL input
  const customApiUrlInput = doc.querySelector("#custom-api-url") as HTMLInputElement;
  if (customApiUrlInput) {
    const currentApiUrl = (Zotero as any).Prefs.get('extensions.researchopia.apiBaseUrl', true) as string;
    // Only show custom URL if it's not the default or localhost
    if (currentApiUrl && currentApiUrl !== 'http://localhost:3000') {
      customApiUrlInput.value = currentApiUrl;
    }
    
    customApiUrlInput.addEventListener("change", (e) => {
      const url = (e.target as HTMLInputElement).value.trim();
      if (url) {
        try {
          // Validate URL format
          new URL(url);
          (Zotero as any).Prefs.set('extensions.researchopia.apiBaseUrl', url, true);
          showMessage(doc, "✅ 自定义 API 地址已保存", "success");
          updateCurrentApiDisplay(doc);
        } catch (error) {
          showMessage(doc, "❌ 无效的 URL 格式", "error");
          (e.target as HTMLInputElement).value = currentApiUrl || '';
        }
      }
    });
  }

  // Display current API URL
  updateCurrentApiDisplay(doc);

  // Reset API URL button
  const resetApiUrlBtn = doc.querySelector("#reset-api-url-btn") as HTMLButtonElement;
  if (resetApiUrlBtn) {
    resetApiUrlBtn.addEventListener("click", () => {
      // Clear custom API URL preference
      (Zotero as any).Prefs.clear('extensions.researchopia.apiBaseUrl', true);
      
      // Also uncheck the development checkbox if it's checked
      if (useDevEnvCheckbox) {
        useDevEnvCheckbox.checked = false;
      }
      
      // Clear custom API input
      if (customApiUrlInput) {
        customApiUrlInput.value = '';
      }
      
      showMessage(doc, "✅ API URL 已重置为默认值", "success");
      logger.log("[Researchopia] 🔧 API URL reset to default");
      updateCurrentApiDisplay(doc);
    });
  }
}

function updateCurrentApiDisplay(doc: Document) {
  const currentApiDisplay = doc.getElementById("current-api-display");
  if (currentApiDisplay) {
    const currentApiUrl = (Zotero as any).Prefs.get('extensions.researchopia.apiBaseUrl', true) as string;
    currentApiDisplay.textContent = currentApiUrl ? `当前: ${currentApiUrl}` : '当前: https://www.researchopia.com (默认)';
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

// 简单的加密/解密函数 (仅用于混淆，不是真正的安全加密)
function simpleEncrypt(text: string): string {
  // 使用Base64编码并添加简单的字符替换
  const encoded = btoa(text);
  return encoded.split('').reverse().join('');
}

function simpleDecrypt(text: string): string {
  try {
    const decoded = text.split('').reverse().join('');
    return atob(decoded);
  } catch (e) {
    return '';
  }
}

// 保存凭证到偏好设置
function saveCredentials(email: string, password: string): void {
  try {
    logger.log("[Researchopia] 🔧 saveCredentials called with email:", email);
    setPref("savedEmail", email);
    setPref("savedPassword", simpleEncrypt(password));
    setPref("rememberCredentials", true);
    logger.log("[Researchopia] ✅ 凭证已保存");
  } catch (error) {
    logger.error("[Researchopia] 保存凭证失败:", error);
  }
}

// 加载保存的凭证
function loadSavedCredentials(doc: Document): void {
  try {
    logger.log("[Researchopia] 🔧 loadSavedCredentials called");
    const rememberCredentials = getPref("rememberCredentials") as boolean;
    logger.log("[Researchopia] 🔧 rememberCredentials:", rememberCredentials);
    
    if (rememberCredentials) {
      const savedEmail = getPref("savedEmail") as string;
      const savedPassword = getPref("savedPassword") as string;
      
      logger.log("[Researchopia] 🔧 savedEmail:", savedEmail, "savedPassword:", !!savedPassword);
      
      if (savedEmail && savedPassword) {
        const emailInput = doc.getElementById("email-input") as HTMLInputElement;
        const passwordInput = doc.getElementById("password-input") as HTMLInputElement;
        const rememberCheckbox = doc.getElementById("remember-credentials") as HTMLInputElement;
        
        logger.log("[Researchopia] 🔧 Found inputs:", { emailInput: !!emailInput, passwordInput: !!passwordInput, rememberCheckbox: !!rememberCheckbox });
        
        if (emailInput) emailInput.value = savedEmail;
        if (passwordInput) passwordInput.value = simpleDecrypt(savedPassword);
        if (rememberCheckbox) rememberCheckbox.checked = true;
        
        logger.log("[Researchopia] ✅ 凭证已加载");
      }
    }
  } catch (error) {
    logger.error("[Researchopia] 加载凭证失败:", error);
  }
}

// 清除保存的凭证
function clearSavedCredentials(): void {
  try {
    setPref("savedEmail", "");
    setPref("savedPassword", "");
    setPref("rememberCredentials", false);
    logger.log("[Researchopia] 凭证已清除");
  } catch (error) {
    logger.error("[Researchopia] 清除凭证失败:", error);
  }
}
