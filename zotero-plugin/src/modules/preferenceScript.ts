import { config } from "../../package.json";
import { getString } from "../utils/locale";

// 全局偏好设置对象，参考备份实现
declare global {
  var ResearchopiaPreferences: any;
}

export async function registerPrefsScripts(_window: Window) {
  // 创建全局偏好设置对象，传入window参数
  (globalThis as any).ResearchopiaPreferences = {
    window: _window, // 保存window引用

    /**
     * 初始化偏好设置面板
     */
    init() {
      try {
        ztoolkit.log('🔧 ResearchopiaPreferences: Initializing preferences panel');

        // 设置默认值
        this.setDefaultPreferences();

        // 更新UI状态
        this.updateLoginStatus();

        // 绑定事件监听器
        this.bindEventListeners();

        ztoolkit.log('✅ ResearchopiaPreferences: Initialization completed');
      } catch (error) {
        ztoolkit.log(`❌ ResearchopiaPreferences: Initialization failed: ${error.message}`);
      }
    },

    /**
     * 设置默认偏好设置
     */
    setDefaultPreferences() {
      // 这里可以设置默认值
      ztoolkit.log('📋 Setting default preferences');
    },

    /**
     * 更新登录状态
     */
    updateLoginStatus() {
      ztoolkit.log('🔄 Updating login status');
    },

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
      try {
        // 等待DOM完全加载
        const bindEvents = () => {
          const doc = this.window.document; // 使用window.document

          // 登录按钮
          const loginBtn = doc.getElementById('researchopia-login-btn');
          if (loginBtn) {
            loginBtn.onclick = () => {
              ztoolkit.log('🔘 Login button clicked');
              this.performLogin();
            };
            ztoolkit.log('✅ Login button bound');
          } else {
            ztoolkit.log('❌ Login button not found');
          }

          // 清空按钮
          const clearBtn = doc.getElementById('researchopia-clear-btn');
          if (clearBtn) {
            clearBtn.onclick = () => this.clearLoginForm();
            ztoolkit.log('✅ Clear button bound');
          }

          // 绑定回车键登录
          const emailInput = doc.getElementById('researchopia-email-input');
          const passwordInput = doc.getElementById('researchopia-password-input');

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
        setTimeout(bindEvents, 2000);

        ztoolkit.log('✅ Event listeners binding scheduled');
      } catch (error) {
        ztoolkit.log(`❌ Failed to bind event listeners: ${error.message}`);
      }
    },

    /**
     * 执行登录
     */
    async performLogin() {
      try {
        ztoolkit.log('🔐 Starting login process...');
        const doc = this.window.document;
        const emailInput = doc.getElementById('researchopia-email-input');
        const passwordInput = doc.getElementById('researchopia-password-input');
        const messageLabel = doc.getElementById('researchopia-login-message');

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

        // 模拟登录成功
        await new Promise(resolve => setTimeout(resolve, 1000));
        const success = true;

        if (success) {
          if (messageLabel) messageLabel.textContent = '登录成功';
          this.updateLoginStatus();
        } else {
          if (messageLabel) messageLabel.textContent = '登录失败，请检查邮箱和密码';
        }

      } catch (error) {
        ztoolkit.log(`❌ Login failed: ${error.message}`);
        const doc = this.window.document;
        const messageLabel = doc.getElementById('researchopia-login-message');
        if (messageLabel) messageLabel.textContent = '登录失败：' + error.message;
      }
    },

    /**
     * 清空登录表单
     */
    clearLoginForm() {
      const doc = this.window.document;
      const emailInput = doc.getElementById('researchopia-email-input');
      const passwordInput = doc.getElementById('researchopia-password-input');
      const messageLabel = doc.getElementById('researchopia-login-message');

      if (emailInput) emailInput.value = '';
      if (passwordInput) passwordInput.value = '';
      if (messageLabel) messageLabel.textContent = '';

      ztoolkit.log('🧹 Login form cleared');
    }
  };

  // 立即初始化
  setTimeout(() => {
    (globalThis as any).ResearchopiaPreferences.init();
  }, 100);

  // 保留原有的prefs数据结构以兼容模板
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
      columns: [
        {
          dataKey: "title",
          label: getString("prefs-table-title"),
          fixedWidth: true,
          width: 100,
        },
        {
          dataKey: "detail",
          label: getString("prefs-table-detail"),
        },
      ],
      rows: [
        {
          title: "Researchopia",
          detail: "标注共享插件",
        },
      ],
    };
  } else {
    addon.data.prefs.window = _window;
  }
  updatePrefsUI();
  bindPrefEvents();
}

async function updatePrefsUI() {
  // You can initialize some UI elements on prefs window
  // with addon.data.prefs.window.document
  // Or bind some events to the elements
  const renderLock = ztoolkit.getGlobal("Zotero").Promise.defer();
  if (addon.data.prefs?.window == undefined) return;
  const tableHelper = new ztoolkit.VirtualizedTable(addon.data.prefs?.window)
    .setContainerId(`${config.addonRef}-table-container`)
    .setProp({
      id: `${config.addonRef}-prefs-table`,
      // Do not use setLocale, as it modifies the Zotero.Intl.strings
      // Set locales directly to columns
      columns: addon.data.prefs?.columns,
      showHeader: true,
      multiSelect: true,
      staticColumns: true,
      disableFontSizeScaling: true,
    })
    .setProp("getRowCount", () => addon.data.prefs?.rows.length || 0)
    .setProp(
      "getRowData",
      (index) =>
        addon.data.prefs?.rows[index] || {
          title: "no data",
          detail: "no data",
        },
    )
    // Show a progress window when selection changes
    .setProp("onSelectionChange", (selection) => {
      new ztoolkit.ProgressWindow(config.addonName)
        .createLine({
          text: `Selected line: ${addon.data.prefs?.rows
            .filter((v, i) => selection.isSelected(i))
            .map((row) => row.title)
            .join(",")}`,
          progress: 100,
        })
        .show();
    })
    // When pressing delete, delete selected line and refresh table.
    // Returning false to prevent default event.
    .setProp("onKeyDown", (event: KeyboardEvent) => {
      if (event.key == "Delete" || (Zotero.isMac && event.key == "Backspace")) {
        addon.data.prefs!.rows =
          addon.data.prefs?.rows.filter(
            (v, i) => !tableHelper.treeInstance.selection.isSelected(i),
          ) || [];
        tableHelper.render();
        return false;
      }
      return true;
    })
    // For find-as-you-type
    .setProp(
      "getRowString",
      (index) => addon.data.prefs?.rows[index].title || "",
    )
    // Render the table.
    .render(-1, () => {
      renderLock.resolve();
    });
  await renderLock.promise;
  ztoolkit.log("Preference table rendered!");
}

function bindPrefEvents() {
  addon.data
    .prefs!.window.document?.querySelector(
      `#zotero-prefpane-${config.addonRef}-enable`,
    )
    ?.addEventListener("command", (e: Event) => {
      ztoolkit.log(e);
      addon.data.prefs!.window.alert(
        `Successfully changed to ${(e.target as XUL.Checkbox).checked}!`,
      );
    });

  addon.data
    .prefs!.window.document?.querySelector(
      `#zotero-prefpane-${config.addonRef}-input`,
    )
    ?.addEventListener("change", (e: Event) => {
      ztoolkit.log(e);
      addon.data.prefs!.window.alert(
        `Successfully changed to ${(e.target as HTMLInputElement).value}!`,
      );
    });
}
