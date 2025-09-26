import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { AuthManager } from "./auth";
import { getPref, setPref } from "../utils/prefs";

export async function registerPrefsScripts(_window: Window) {
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
  if (addon.data.prefs?.window == undefined) return;

  const doc = addon.data.prefs.window.document;
  
  // Update login status display
  updateLoginStatus(doc);
}

function updateLoginStatus(doc: Document) {
  const loginContainer = doc.getElementById("researchopia-login-container");
  if (!loginContainer) return;

  if (AuthManager.isLoggedIn()) {
    const user = AuthManager.getCurrentUser();
    loginContainer.innerHTML = `
      <div class="login-status">
        <div class="logged-in">
          <div class="user-info">
            <span class="user-email">✅ ${user?.email || 'Unknown User'}</span>
            <span class="login-time">Logged in at ${new Date().toLocaleString()}</span>
          </div>
          <div class="user-actions">
            <button id="logout-btn" class="researchopia-btn">Logout</button>
            <button id="sync-btn" class="researchopia-btn secondary">Sync Data</button>
          </div>
        </div>
      </div>
    `;

    // Add logout event listener
    const logoutBtn = doc.getElementById("logout-btn");
    logoutBtn?.addEventListener("click", async () => {
      if (confirm("Are you sure you want to logout?")) {
        await AuthManager.signOut();
        updateLoginStatus(doc);
        showMessage(doc, "Logged out successfully", "success");
      }
    });

    // Add sync event listener
    const syncBtn = doc.getElementById("sync-btn");
    syncBtn?.addEventListener("click", async () => {
      showMessage(doc, "Syncing data...", "info");
      // TODO: Implement data sync
      setTimeout(() => {
        showMessage(doc, "Data synced successfully", "success");
      }, 2000);
    });
  } else {
    loginContainer.innerHTML = `
      <div class="login-status">
        <div class="login-form">
          <h3>Connect to Researchopia</h3>
          <p class="login-description">Login to share and access community annotations</p>
          <div class="form-group">
            <label for="email-input">Email Address:</label>
            <input type="email" id="email-input" placeholder="your.email@example.com" />
          </div>
          <div class="form-group">
            <label for="password-input">Password:</label>
            <input type="password" id="password-input" placeholder="Enter your password" />
          </div>
          <div class="form-options">
            <label class="checkbox-label">
              <input type="checkbox" id="remember-me"> Remember me
            </label>
          </div>
          <div class="form-actions">
            <button id="login-btn" class="researchopia-btn primary">
              <span class="btn-text">Login</span>
              <span class="btn-loading" style="display: none;">Logging in...</span>
            </button>
            <button id="signup-btn" class="researchopia-btn secondary">
              <span class="btn-text">Create Account</span>
              <span class="btn-loading" style="display: none;">Creating...</span>
            </button>
          </div>
          <div id="login-message" class="message"></div>
          <div class="help-links">
            <a href="#" id="forgot-password">Forgot password?</a>
          </div>
        </div>
      </div>
    `;

    // Add login event listeners
    const loginBtn = doc.getElementById("login-btn");
    const signupBtn = doc.getElementById("signup-btn");
    const forgotPasswordLink = doc.getElementById("forgot-password");

    loginBtn?.addEventListener("click", async () => {
      const email = (doc.getElementById("email-input") as HTMLInputElement)?.value.trim();
      const password = (doc.getElementById("password-input") as HTMLInputElement)?.value;
      const rememberMe = (doc.getElementById("remember-me") as HTMLInputElement)?.checked;

      if (!email || !password) {
        showMessage(doc, "Please enter both email and password", "error");
        return;
      }

      if (!isValidEmail(email)) {
        showMessage(doc, "Please enter a valid email address", "error");
        return;
      }

      setButtonLoading(loginBtn, true);
      showMessage(doc, "Logging in...", "info");

      try {
        const success = await AuthManager.signIn(email, password);
        if (success) {
          if (rememberMe) {
            setPref("rememberLogin", true);
          }
          updateLoginStatus(doc);
          showMessage(doc, "Login successful!", "success");
        } else {
          showMessage(doc, "Login failed. Please check your credentials.", "error");
        }
      } catch (error) {
        showMessage(doc, "Login error. Please try again.", "error");
      } finally {
        setButtonLoading(loginBtn, false);
      }
    });

    signupBtn?.addEventListener("click", async () => {
      const email = (doc.getElementById("email-input") as HTMLInputElement)?.value.trim();
      const password = (doc.getElementById("password-input") as HTMLInputElement)?.value;

      if (!email || !password) {
        showMessage(doc, "Please enter both email and password", "error");
        return;
      }

      if (!isValidEmail(email)) {
        showMessage(doc, "Please enter a valid email address", "error");
        return;
      }

      if (password.length < 6) {
        showMessage(doc, "Password must be at least 6 characters long", "error");
        return;
      }

      setButtonLoading(signupBtn, true);
      showMessage(doc, "Creating account...", "info");

      try {
        const success = await AuthManager.signUp(email, password);
        if (success) {
          showMessage(doc, "Account created! Please check your email for verification.", "success");
        } else {
          showMessage(doc, "Sign up failed. Please try again.", "error");
        }
      } catch (error) {
        showMessage(doc, "Sign up error. Please try again.", "error");
      } finally {
        setButtonLoading(signupBtn, false);
      }
    });

    forgotPasswordLink?.addEventListener("click", (e) => {
      e.preventDefault();
      showMessage(doc, "Password reset feature coming soon!", "info");
    });
  }
}

function bindPrefEvents() {
  const doc = addon.data.prefs!.window.document;
  
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
