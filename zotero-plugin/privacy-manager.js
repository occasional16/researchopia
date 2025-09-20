/**
 * Researchopia Privacy Manager
 * 隐私和权限控制模块
 */

const PrivacyManager = {
  // 配置
  config: {
    apiBase: 'http://localhost:3000/api/v1',
    defaultPrivacy: 'public',
    privacyLevels: ['public', 'friends', 'private']
  },

  // 隐私设置缓存
  cache: {
    userSettings: new Map(),
    blockedUsers: new Set(),
    privacyRules: new Map()
  },

  /**
   * 初始化隐私管理器
   */
  init() {
    this.log("Initializing Privacy Manager");
    this.loadUserSettings();
    this.setupEventListeners();
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-Privacy [${level.toUpperCase()}]: ${message}`;
      
      // 使用Zotero的日志系统
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug(logMessage, level === 'error' ? 1 : 3);
      } else if (typeof console !== 'undefined') {
        console.log(logMessage);
      }
    } catch (e) {
      // 静默处理日志错误
    }
  },

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    try {
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.addObserver(this, 'researchopia:privacySettingsChanged', false);
        this.log("Privacy event listeners registered");
      }
    } catch (error) {
      this.log(`Error setting up event listeners: ${error.message}`, 'error');
    }
  },

  /**
   * 观察者接口实现
   */
  observe(subject, topic, data) {
    try {
      switch (topic) {
        case 'researchopia:privacySettingsChanged':
          this.handlePrivacySettingsChanged(JSON.parse(data));
          break;
      }
    } catch (error) {
      this.log(`Error handling observer event: ${error.message}`, 'error');
    }
  },

  /**
   * 加载用户隐私设置
   */
  async loadUserSettings() {
    try {
      this.log("Loading user privacy settings");
      
      if (!this.isUserAuthenticated()) {
        this.log("User not authenticated, using default settings");
        return;
      }

      const response = await this.makeRequest('/user/privacy-settings');
      
      if (response.ok) {
        const settings = JSON.parse(response.responseText);
        this.cache.userSettings.set('current', settings);
        
        // 加载屏蔽用户列表
        if (settings.blockedUsers) {
          settings.blockedUsers.forEach(userId => {
            this.cache.blockedUsers.add(userId);
          });
        }
        
        this.log(`Loaded privacy settings for user`);
      } else {
        this.log(`Failed to load privacy settings: ${response.status}`, 'warn');
      }
    } catch (error) {
      this.log(`Error loading user settings: ${error.message}`, 'error');
    }
  },

  /**
   * 显示隐私设置界面
   */
  async showPrivacySettings() {
    try {
      this.log("Showing privacy settings dialog");
      
      const settingsHTML = this.createPrivacySettingsHTML();
      
      const dialog = Services.ww.openWindow(
        null,
        'data:text/html;charset=utf-8,' + encodeURIComponent(settingsHTML),
        'privacy-settings',
        'chrome,centerscreen,modal,resizable=yes,width=600,height=500',
        null
      );

      dialog.addEventListener('load', () => {
        this.setupPrivacySettingsEvents(dialog);
        this.loadCurrentSettings(dialog);
      });

      return dialog;
    } catch (error) {
      this.log(`Error showing privacy settings: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 创建隐私设置HTML
   */
  createPrivacySettingsHTML() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>隐私设置 - 研学港</title>
        <meta charset="utf-8">
        <style>
          ${this.getPrivacySettingsCSS()}
        </style>
      </head>
      <body>
        <div class="settings-container">
          <div class="settings-header">
            <h2>🔒 隐私设置</h2>
            <p>管理您的标注分享隐私和权限</p>
          </div>
          
          <div class="settings-content">
            <!-- 默认隐私级别 -->
            <div class="setting-section">
              <h3>默认隐私级别</h3>
              <p class="setting-description">新分享的标注默认使用此隐私级别</p>
              <div class="privacy-options">
                <label class="privacy-option">
                  <input type="radio" name="defaultPrivacy" value="public">
                  <div class="option-content">
                    <span class="option-icon">🌍</span>
                    <div class="option-text">
                      <strong>公开</strong>
                      <p>所有人都可以看到您的标注</p>
                    </div>
                  </div>
                </label>
                
                <label class="privacy-option">
                  <input type="radio" name="defaultPrivacy" value="friends">
                  <div class="option-content">
                    <span class="option-icon">👥</span>
                    <div class="option-text">
                      <strong>仅好友</strong>
                      <p>只有您关注的用户可以看到</p>
                    </div>
                  </div>
                </label>
                
                <label class="privacy-option">
                  <input type="radio" name="defaultPrivacy" value="private">
                  <div class="option-content">
                    <span class="option-icon">🔒</span>
                    <div class="option-text">
                      <strong>私人</strong>
                      <p>只有您自己可以看到</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            <!-- 社交互动设置 -->
            <div class="setting-section">
              <h3>社交互动</h3>
              <div class="setting-item">
                <label class="checkbox-label">
                  <input type="checkbox" id="allowComments">
                  <span class="checkmark"></span>
                  允许其他用户评论我的标注
                </label>
              </div>
              <div class="setting-item">
                <label class="checkbox-label">
                  <input type="checkbox" id="allowLikes">
                  <span class="checkmark"></span>
                  允许其他用户点赞我的标注
                </label>
              </div>
              <div class="setting-item">
                <label class="checkbox-label">
                  <input type="checkbox" id="notifyInteractions">
                  <span class="checkmark"></span>
                  当有人与我的标注互动时通知我
                </label>
              </div>
            </div>
            
            <!-- 屏蔽管理 -->
            <div class="setting-section">
              <h3>屏蔽管理</h3>
              <p class="setting-description">管理被屏蔽的用户</p>
              <div class="blocked-users-container">
                <div id="blocked-users-list" class="blocked-users-list">
                  <!-- 屏蔽用户列表将在这里动态加载 -->
                </div>
                <div class="add-block-section">
                  <input type="text" id="block-user-input" placeholder="输入用户名或ID">
                  <button onclick="blockUser()" class="block-btn">屏蔽用户</button>
                </div>
              </div>
            </div>
            
            <!-- 数据管理 -->
            <div class="setting-section">
              <h3>数据管理</h3>
              <div class="data-actions">
                <button onclick="exportData()" class="data-btn">📥 导出我的数据</button>
                <button onclick="deleteAllData()" class="data-btn danger">🗑️ 删除所有数据</button>
              </div>
            </div>
          </div>
          
          <div class="settings-footer">
            <button onclick="cancelSettings()" class="cancel-btn">取消</button>
            <button onclick="saveSettings()" class="save-btn">保存设置</button>
          </div>
        </div>
        
        <script>
          ${this.getPrivacySettingsJS()}
        </script>
      </body>
      </html>
    `;
  },

  /**
   * 获取隐私设置CSS
   */
  getPrivacySettingsCSS() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f8f9fa;
        color: #333;
      }
      
      .settings-container {
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: white;
      }
      
      .settings-header {
        padding: 20px;
        border-bottom: 1px solid #e9ecef;
        text-align: center;
      }
      
      .settings-header h2 {
        color: #495057;
        margin-bottom: 8px;
      }
      
      .settings-header p {
        color: #6c757d;
        font-size: 14px;
      }
      
      .settings-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
      }
      
      .setting-section {
        margin-bottom: 32px;
      }
      
      .setting-section h3 {
        color: #495057;
        margin-bottom: 8px;
        font-size: 16px;
      }
      
      .setting-description {
        color: #6c757d;
        font-size: 13px;
        margin-bottom: 16px;
      }
      
      .privacy-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .privacy-option {
        display: flex;
        align-items: center;
        padding: 16px;
        border: 2px solid #e9ecef;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .privacy-option:hover {
        border-color: #007bff;
        background: #f8f9ff;
      }
      
      .privacy-option input[type="radio"] {
        margin-right: 12px;
      }
      
      .option-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .option-icon {
        font-size: 24px;
      }
      
      .option-text strong {
        display: block;
        color: #495057;
        margin-bottom: 4px;
      }
      
      .option-text p {
        color: #6c757d;
        font-size: 12px;
        margin: 0;
      }
      
      .setting-item {
        margin-bottom: 12px;
      }
      
      .checkbox-label {
        display: flex;
        align-items: center;
        cursor: pointer;
        font-size: 14px;
      }
      
      .checkbox-label input[type="checkbox"] {
        margin-right: 8px;
      }
      
      .blocked-users-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        margin-bottom: 12px;
      }
      
      .blocked-user-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid #f8f9fa;
      }
      
      .blocked-user-item:last-child {
        border-bottom: none;
      }
      
      .add-block-section {
        display: flex;
        gap: 8px;
      }
      
      #block-user-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .block-btn {
        padding: 8px 16px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .data-actions {
        display: flex;
        gap: 12px;
      }
      
      .data-btn {
        padding: 10px 16px;
        border: 1px solid #dee2e6;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .data-btn.danger {
        background: #dc3545;
        color: white;
        border-color: #dc3545;
      }
      
      .settings-footer {
        padding: 20px;
        border-top: 1px solid #e9ecef;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      
      .cancel-btn, .save-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .cancel-btn {
        background: #6c757d;
        color: white;
      }
      
      .save-btn {
        background: #007bff;
        color: white;
      }
      
      .empty-state {
        text-align: center;
        padding: 20px;
        color: #6c757d;
        font-size: 14px;
      }
    `;
  },

  /**
   * 设置隐私设置事件
   */
  setupPrivacySettingsEvents(dialog) {
    try {
      // 设置全局引用
      dialog.contentWindow.PrivacyManager = this;
      this.log("Privacy settings events setup completed");
    } catch (error) {
      this.log(`Error setting up privacy settings events: ${error.message}`, 'error');
    }
  },

  /**
   * 加载当前设置到界面
   */
  loadCurrentSettings(dialog) {
    try {
      const settings = this.cache.userSettings.get('current') || {};

      // 设置默认隐私级别
      const defaultPrivacy = settings.defaultPrivacy || this.config.defaultPrivacy;
      const privacyRadio = dialog.contentDocument.querySelector(`input[name="defaultPrivacy"][value="${defaultPrivacy}"]`);
      if (privacyRadio) privacyRadio.checked = true;

      // 设置社交互动选项
      const allowComments = dialog.contentDocument.getElementById('allowComments');
      if (allowComments) allowComments.checked = settings.allowComments !== false;

      const allowLikes = dialog.contentDocument.getElementById('allowLikes');
      if (allowLikes) allowLikes.checked = settings.allowLikes !== false;

      const notifyInteractions = dialog.contentDocument.getElementById('notifyInteractions');
      if (notifyInteractions) notifyInteractions.checked = settings.notifyInteractions !== false;

      this.log("Current settings loaded to dialog");
    } catch (error) {
      this.log(`Error loading current settings: ${error.message}`, 'error');
    }
  },

  /**
   * 屏蔽用户
   */
  async blockUser(username) {
    try {
      this.log(`Blocking user: ${username}`);

      if (!this.isUserAuthenticated()) {
        throw new Error('请先登录');
      }

      const response = await this.makeRequest('/user/block', {
        method: 'POST',
        body: JSON.stringify({ username })
      });

      if (response.ok) {
        const data = JSON.parse(response.responseText);
        this.cache.blockedUsers.add(data.userId);
        this.log(`User blocked successfully: ${username}`);
        return { success: true };
      } else {
        throw new Error(`屏蔽用户失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error blocking user: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 取消屏蔽用户
   */
  async unblockUser(userId) {
    try {
      this.log(`Unblocking user: ${userId}`);

      const response = await this.makeRequest(`/user/unblock/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.cache.blockedUsers.delete(userId);
        this.log(`User unblocked successfully: ${userId}`);
        return { success: true };
      } else {
        throw new Error(`取消屏蔽失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error unblocking user: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 加载屏蔽用户列表到界面
   */
  async loadBlockedUsersList(document) {
    try {
      const listContainer = document.getElementById('blocked-users-list');

      if (this.cache.blockedUsers.size === 0) {
        listContainer.innerHTML = '<div class="empty-state">没有屏蔽的用户</div>';
        return;
      }

      // 获取用户详细信息
      const userIds = Array.from(this.cache.blockedUsers);
      const response = await this.makeRequest('/users/batch', {
        method: 'POST',
        body: JSON.stringify({ userIds })
      });

      if (response.ok) {
        const users = JSON.parse(response.responseText);
        const userItems = users.map(user => `
          <div class="blocked-user-item">
            <div class="user-info">
              <strong>${this.escapeHtml(user.name)}</strong>
              <span class="user-id">@${this.escapeHtml(user.username)}</span>
            </div>
            <button onclick="unblockUser('${user.id}')" class="unblock-btn">取消屏蔽</button>
          </div>
        `).join('');

        listContainer.innerHTML = userItems;
      } else {
        listContainer.innerHTML = '<div class="empty-state">加载失败</div>';
      }
    } catch (error) {
      this.log(`Error loading blocked users list: ${error.message}`, 'error');
    }
  },

  /**
   * 保存隐私设置
   */
  async savePrivacySettings(settings) {
    try {
      this.log("Saving privacy settings");

      if (!this.isUserAuthenticated()) {
        throw new Error('请先登录');
      }

      const response = await this.makeRequest('/user/privacy-settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        // 更新本地缓存
        this.cache.userSettings.set('current', settings);

        // 触发设置变更事件
        this.notifyPrivacySettingsChanged(settings);

        this.log("Privacy settings saved successfully");
        return { success: true };
      } else {
        throw new Error(`保存设置失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error saving privacy settings: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 导出用户数据
   */
  async exportUserData() {
    try {
      this.log("Exporting user data");

      if (!this.isUserAuthenticated()) {
        throw new Error('请先登录');
      }

      const response = await this.makeRequest('/user/export-data');

      if (response.ok) {
        const data = JSON.parse(response.responseText);

        // 创建下载链接
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `researchopia-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.log("User data exported successfully");
        return { success: true };
      } else {
        throw new Error(`导出数据失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error exporting user data: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 删除所有用户数据
   */
  async deleteAllUserData() {
    try {
      this.log("Deleting all user data");

      if (!this.isUserAuthenticated()) {
        throw new Error('请先登录');
      }

      const response = await this.makeRequest('/user/delete-all-data', {
        method: 'DELETE'
      });

      if (response.ok) {
        // 清除本地缓存
        this.cache.userSettings.clear();
        this.cache.blockedUsers.clear();
        this.cache.privacyRules.clear();

        this.log("All user data deleted successfully");
        return { success: true };
      } else {
        throw new Error(`删除数据失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error deleting user data: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 检查标注是否对用户可见
   */
  isAnnotationVisibleToUser(annotation, viewerUserId) {
    try {
      // 如果是作者本人，总是可见
      if (annotation.authorId === viewerUserId) {
        return true;
      }

      // 检查隐私级别
      switch (annotation.privacy) {
        case 'private':
          return false;
        case 'friends':
          return this.isUserFriend(annotation.authorId, viewerUserId);
        case 'public':
        default:
          return !this.isUserBlocked(annotation.authorId, viewerUserId);
      }
    } catch (error) {
      this.log(`Error checking annotation visibility: ${error.message}`, 'error');
      return false;
    }
  },

  /**
   * 检查用户是否被屏蔽
   */
  isUserBlocked(userId, viewerUserId) {
    return this.cache.blockedUsers.has(userId);
  },

  /**
   * 检查用户是否为好友
   */
  isUserFriend(userId, viewerUserId) {
    // 这里应该检查用户关注关系
    // 暂时返回false，等待社交功能完善
    return false;
  },

  /**
   * 通知隐私设置变更
   */
  notifyPrivacySettingsChanged(settings) {
    try {
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.notifyObservers(null, 'researchopia:privacySettingsChanged', JSON.stringify(settings));
      }
    } catch (error) {
      this.log(`Error notifying privacy settings changed: ${error.message}`, 'error');
    }
  },

  /**
   * 处理隐私设置变更事件
   */
  handlePrivacySettingsChanged(settings) {
    this.log("Privacy settings changed, updating cache");
    this.cache.userSettings.set('current', settings);
  },

  /**
   * 检查用户是否已认证
   */
  isUserAuthenticated() {
    return typeof AuthManager !== 'undefined' && AuthManager.isUserAuthenticated();
  },

  /**
   * HTML转义
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * 发送HTTP请求
   */
  makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.config.apiBase}${endpoint}`;

      xhr.timeout = options.timeout || 10000;
      xhr.open(options.method || 'GET', url, true);

      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      // 添加认证头
      if (this.isUserAuthenticated()) {
        const authHeaders = AuthManager.getAuthHeaders();
        Object.assign(headers, authHeaders);
      }

      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });

      xhr.onload = function() {
        resolve({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText,
          ok: xhr.status >= 200 && xhr.status < 300
        });
      };

      xhr.onerror = function() {
        reject(new Error(`Network error: ${xhr.statusText || 'Connection failed'}`));
      };

      xhr.ontimeout = function() {
        reject(new Error(`Request timeout after ${xhr.timeout}ms`));
      };

      xhr.send(options.body || null);
    });
  },

  /**
   * 获取隐私设置JavaScript
   */
  getPrivacySettingsJS() {
    return `
      function blockUser() {
        const input = document.getElementById('block-user-input');
        const username = input.value.trim();
        
        if (!username) {
          alert('请输入用户名');
          return;
        }
        
        if (window.opener && window.opener.PrivacyManager) {
          window.opener.PrivacyManager.blockUser(username);
          input.value = '';
          loadBlockedUsers();
        }
      }
      
      function unblockUser(userId) {
        if (window.opener && window.opener.PrivacyManager) {
          window.opener.PrivacyManager.unblockUser(userId);
          loadBlockedUsers();
        }
      }
      
      function loadBlockedUsers() {
        if (window.opener && window.opener.PrivacyManager) {
          window.opener.PrivacyManager.loadBlockedUsersList(document);
        }
      }
      
      function exportData() {
        if (window.opener && window.opener.PrivacyManager) {
          window.opener.PrivacyManager.exportUserData();
        }
      }
      
      function deleteAllData() {
        if (confirm('确定要删除所有数据吗？此操作不可撤销！')) {
          if (window.opener && window.opener.PrivacyManager) {
            window.opener.PrivacyManager.deleteAllUserData();
          }
        }
      }
      
      function saveSettings() {
        const settings = {
          defaultPrivacy: document.querySelector('input[name="defaultPrivacy"]:checked')?.value,
          allowComments: document.getElementById('allowComments').checked,
          allowLikes: document.getElementById('allowLikes').checked,
          notifyInteractions: document.getElementById('notifyInteractions').checked
        };
        
        if (window.opener && window.opener.PrivacyManager) {
          window.opener.PrivacyManager.savePrivacySettings(settings);
        }
        
        window.close();
      }
      
      function cancelSettings() {
        window.close();
      }
      
      // 初始化
      window.addEventListener('load', () => {
        loadBlockedUsers();
      });
    `;
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrivacyManager;
}
