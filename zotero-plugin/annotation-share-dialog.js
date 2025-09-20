/**
 * Researchopia Annotation Share Dialog
 * 简化的标注分享对话框，解决当前的核心问题
 */

const AnnotationShareDialog = {
  /**
   * 初始化
   */
  init() {
    this.log("Initializing Annotation Share Dialog");
    return this;
  },

  /**
   * 显示通知
   */
  showNotification(message, type = 'info') {
    try {
      if (typeof FeedbackSystem !== 'undefined' && FeedbackSystem.showNotification) {
        FeedbackSystem.showNotification(message, type);
      } else {
        // 回退到简单的alert
        alert(message);
      }
    } catch (error) {
      console.log(`Notification: ${message}`);
    }
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-ShareDialog [${level.toUpperCase()}]: ${message}`;

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
   * 显示标注分享对话框
   */
  async showShareDialog(annotations) {
    try {
      // 如果没有传入标注，尝试获取选中的标注
      if (!annotations) {
        annotations = await this.getSelectedAnnotations();
      }

      if (!annotations || annotations.length === 0) {
        this.showNotification('请先选择要分享的标注', 'warning');
        return { success: false, reason: 'no_annotations' };
      }

      this.log(`Showing share dialog for ${annotations.length} annotations`);

      // 检查用户认证状态
      const isAuthenticated = this.checkAuthStatus();
      if (!isAuthenticated) {
        return this.showLoginPrompt();
      }

      // 显示确认对话框
      const confirmed = await this.showConfirmDialog(annotations);
      if (!confirmed) {
        return { success: false, reason: 'cancelled' };
      }

      // 处理分享
      return await this.processShare(annotations);

    } catch (error) {
      this.log(`Error showing share dialog: ${error.message}`, 'error');
      this.showNotification('分享失败: ' + error.message, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 检查认证状态
   */
  checkAuthStatus() {
    try {
      if (typeof AuthManager !== 'undefined') {
        return AuthManager.isUserAuthenticated();
      }
      return false;
    } catch (error) {
      this.log(`Error checking auth status: ${error.message}`, 'error');
      return false;
    }
  },

  /**
   * 获取选中的标注
   */
  async getSelectedAnnotations() {
    try {
      // 获取当前选中的项目
      const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
      if (!selectedItems || selectedItems.length === 0) {
        return [];
      }

      const annotations = [];
      for (const item of selectedItems) {
        if (item.isAttachment() && item.isPDFAttachment()) {
          // 获取PDF的标注
          const pdfAnnotations = await item.getAnnotations();
          annotations.push(...pdfAnnotations);
        } else if (item.isAnnotation()) {
          // 直接是标注项
          annotations.push(item);
        }
      }

      this.log(`Found ${annotations.length} annotations`);
      return annotations;
    } catch (error) {
      this.log(`Error getting selected annotations: ${error.message}`, 'error');
      return [];
    }
  },

  /**
   * 显示确认对话框
   */
  async showConfirmDialog(annotations) {
    try {
      const count = annotations.length;
      const message = `确定要分享 ${count} 个标注到研学港吗？\n\n分享后其他用户可以看到您的标注内容。`;

      return Services.prompt.confirm(null, "确认分享标注", message);
    } catch (error) {
      this.log(`Error showing confirm dialog: ${error.message}`, 'error');
      return false;
    }
  },

  /**
   * 处理分享
   */
  async processShare(annotations) {
    try {
      this.log(`Processing share for ${annotations.length} annotations`);

      // 显示进度通知
      this.showNotification('正在分享标注...', 'loading');

      // 模拟分享过程（实际应该调用API）
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 显示成功消息
      this.showNotification(`成功分享 ${annotations.length} 个标注！`, 'success');

      return { success: true, count: annotations.length };
    } catch (error) {
      this.log(`Error processing share: ${error.message}`, 'error');
      this.showNotification('分享失败，请重试', 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 显示登录提示
   */
  showLoginPrompt() {
    try {
      const message = "您需要登录才能分享标注。\n\n点击确定打开登录页面。";
      const confirmed = Services.prompt.confirm(null, "需要登录", message);

      if (confirmed && typeof AuthManager !== 'undefined') {
        AuthManager.openLoginWindow();
      }

      return { cancelled: true, reason: 'not_authenticated' };
    } catch (error) {
      this.log(`Error showing login prompt: ${error.message}`, 'error');
      return { cancelled: true, reason: 'error' };
    }
  },

  /**
   * 创建分享对话框
   */
  createShareDialog(annotations) {
    try {
      // 获取当前窗口
      const win = Services.wm.getMostRecentWindow('navigator:browser') ||
                  Services.wm.getMostRecentWindow('mail:3pane') ||
                  Services.wm.getMostRecentWindow(null);

      if (!win) {
        throw new Error("No active window found");
      }

      // 创建对话框内容
      const dialogContent = this.generateDialogHTML(annotations);
      
      // 使用Zotero的对话框API
      const dialog = {
        window: win,
        content: dialogContent,
        annotations: annotations,
        result: null
      };

      return dialog;
    } catch (error) {
      this.log(`Error creating share dialog: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 生成对话框HTML
   */
  generateDialogHTML(annotations) {
    const annotationsList = annotations.map((ann, index) => {
      const text = ann.annotationText || ann.text || '';
      const type = ann.annotationType || ann.type || 'highlight';
      const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
      
      return `
        <div class="annotation-item" data-index="${index}">
          <label>
            <input type="checkbox" checked data-annotation-id="${ann.key || ann.id}">
            <span class="annotation-type">${type}</span>
            <span class="annotation-preview">${this.escapeHtml(preview)}</span>
          </label>
        </div>
      `;
    }).join('');

    return `
      <div class="share-dialog">
        <h2>分享标注到研学港</h2>
        <p>选择要分享的标注 (${annotations.length} 个):</p>
        
        <div class="annotations-list">
          ${annotationsList}
        </div>
        
        <div class="privacy-settings">
          <h3>隐私设置:</h3>
          <label>
            <input type="radio" name="privacy" value="public" checked>
            公开 - 所有用户可见
          </label>
          <label>
            <input type="radio" name="privacy" value="friends">
            仅好友 - 仅关注的用户可见
          </label>
          <label>
            <input type="radio" name="privacy" value="private">
            私有 - 仅自己可见
          </label>
        </div>
        
        <div class="dialog-buttons">
          <button id="cancel-btn">取消</button>
          <button id="share-btn" class="primary">分享</button>
        </div>
      </div>
    `;
  },

  /**
   * 显示对话框
   */
  async showDialog(dialog) {
    return new Promise((resolve) => {
      try {
        // 使用简单的确认对话框作为回退
        const message = `准备分享 ${dialog.annotations.length} 个标注到研学港。\n\n确定要继续吗？`;
        const confirmed = Services.prompt.confirm(dialog.window, "分享标注", message);
        
        if (confirmed) {
          // 处理分享
          this.processShare(dialog.annotations).then(result => {
            resolve(result);
          }).catch(error => {
            this.log(`Share processing error: ${error.message}`, 'error');
            resolve({ success: false, error: error.message });
          });
        } else {
          resolve({ cancelled: true });
        }
      } catch (error) {
        this.log(`Error showing dialog: ${error.message}`, 'error');
        resolve({ success: false, error: error.message });
      }
    });
  },

  /**
   * 处理分享
   */
  async processShare(annotations) {
    try {
      this.log(`Processing share for ${annotations.length} annotations`);

      // 显示进度提示
      if (typeof FeedbackSystem !== 'undefined') {
        FeedbackSystem.showLoading('正在分享标注...');
      }

      // 调用标注分享模块
      if (typeof Zotero !== 'undefined' && Zotero.Researchopia?.AnnotationSharing) {
        const result = await Zotero.Researchopia.AnnotationSharing.shareAnnotations(annotations);
        
        if (typeof FeedbackSystem !== 'undefined') {
          if (result.success) {
            FeedbackSystem.showSuccess(`成功分享 ${result.shared || annotations.length} 个标注！`);
          } else {
            FeedbackSystem.showError(`分享失败: ${result.error || '未知错误'}`);
          }
        }
        
        return result;
      } else {
        throw new Error("Annotation sharing module not available");
      }
    } catch (error) {
      this.log(`Error processing share: ${error.message}`, 'error');
      
      if (typeof FeedbackSystem !== 'undefined') {
        FeedbackSystem.showError(`分享失败: ${error.message}`);
      }
      
      return { success: false, error: error.message };
    }
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
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationShareDialog;
}
