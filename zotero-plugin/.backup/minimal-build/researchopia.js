/*
 * 研学港 Zotero插件 - 极简版
 * Minimal Version of Researchopia Zotero Plugin
 */

Zotero.Researchopia = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  registeredSection: null,

  init({ id, version, rootURI }) {
    if (this.initialized) return;
    
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;

    this.log('研学港插件初始化成功');
    
    // 注册Item Pane部分
    this.registerItemPaneSection();
  },

  /**
   * 注册Item Pane部分
   */
  registerItemPaneSection() {
    try {
      if (!Zotero.ItemPaneManager) {
        throw new Error("Zotero.ItemPaneManager 不可用");
      }
      
      if (this.registeredSection) {
        this.log('部分已注册');
        return;
      }

      this.registeredSection = Zotero.ItemPaneManager.registerSection({
        paneID: `${this.id}-section`,
        pluginID: this.id,
        header: {
          l10nID: "researchopia-header-label",
          label: "研学港 Researchopia",
          icon: `${this.rootURI}icons/icon32.svg`,
        },
        sidenav: {
          l10nID: "researchopia-sidenav-label",
          label: "研学港 Researchopia",
          icon: `${this.rootURI}icons/icon32.svg`,
        },
        onRender: ({ body, item }) => {
          this.renderItemPane(body, item);
        },
      });

      this.log("Item Pane 部分注册成功");
    } catch (error) {
      this.log("注册 Item Pane 部分失败: " + error.message);
    }
  },

  /**
   * 渲染Item Pane
   */
  renderItemPane(body, item) {
    try {
      body.replaceChildren();

      const container = body.ownerDocument.createElement("div");
      container.style.cssText = `
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        background: #fff;
        padding: 16px;
        border-radius: 8px;
        max-width: 100%;
        box-sizing: border-box;
      `;

      // 标题
      const title = body.ownerDocument.createElement('h3');
      title.textContent = '研学港 Researchopia';
      title.style.cssText = `
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px 0;
        color: #333;
        border-bottom: 2px solid #667eea;
        padding-bottom: 8px;
      `;

      const subtitle = body.ownerDocument.createElement('p');
      subtitle.textContent = '学术标注分享平台 - 极简版';
      subtitle.style.cssText = `
        font-size: 12px;
        margin: 0 0 16px 0;
        color: #666;
      `;

      // 状态信息
      const status = body.ownerDocument.createElement('div');
      status.style.cssText = `
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px solid #e1e5e9;
        margin-bottom: 16px;
      `;
      status.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #28a745;"></span>
          <span style="font-weight: 500;">插件已加载</span>
        </div>
        <div style="font-size: 12px; color: #666;">
          版本: ${this.version || '未知'}<br>
          状态: 正常运行
        </div>
      `;

      // 文献信息
      const itemInfo = body.ownerDocument.createElement('div');
      itemInfo.style.cssText = `
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px solid #e1e5e9;
      `;

      if (item && item.isRegularItem()) {
        const title = item.getField('title') || '未知标题';
        const doi = this.extractDOI(item);
        
        itemInfo.innerHTML = `
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #495057;">📄 文献信息</h4>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;"><strong>标题:</strong> ${title}</p>
          <p style="margin: 0; font-size: 12px; color: ${doi ? '#28a745' : '#dc3545'};">
            ${doi ? `✅ DOI: ${doi}` : '❌ 无DOI'}
          </p>
        `;
      } else {
        itemInfo.innerHTML = `
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #495057;">📄 文献信息</h4>
          <p style="margin: 0; font-size: 12px; color: #dc3545;">请选择一个文献</p>
        `;
      }

      // 操作按钮
      const actions = body.ownerDocument.createElement('div');
      actions.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 16px;
      `;

      const testBtn = body.ownerDocument.createElement('button');
      testBtn.textContent = '🧪 测试功能';
      testBtn.style.cssText = `
        background: #28a745;
        border: none;
        color: white;
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
      `;
      testBtn.addEventListener('click', () => {
        this.showFeedback('测试功能正常！', 'success');
      });

      const refreshBtn = body.ownerDocument.createElement('button');
      refreshBtn.textContent = '🔄 刷新';
      refreshBtn.style.cssText = `
        background: #17a2b8;
        border: none;
        color: white;
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
      `;
      refreshBtn.addEventListener('click', () => {
        this.showFeedback('界面已刷新！', 'info');
      });

      actions.appendChild(testBtn);
      actions.appendChild(refreshBtn);

      container.appendChild(title);
      container.appendChild(subtitle);
      container.appendChild(status);
      container.appendChild(itemInfo);
      container.appendChild(actions);

      body.appendChild(container);

      this.log('Item Pane 渲染成功');
    } catch (error) {
      this.log('渲染 Item Pane 失败: ' + error.message);
      body.innerHTML = '<div style="color: red; padding: 16px;">界面渲染失败: ' + error.message + '</div>';
    }
  },

  /**
   * 提取DOI
   */
  extractDOI(item) {
    const doiFields = ['DOI', 'doi', 'extra'];
    for (const field of doiFields) {
      const value = item.getField(field);
      if (value) {
        const doiMatch = value.match(/10\.\d+\/[^\s]+/);
        if (doiMatch) {
          return doiMatch[0];
        }
      }
    }
    return null;
  },

  /**
   * 日志记录
   */
  log(msg, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] 研学港: ${msg}`;
    
    Zotero.debug(logMessage);
    
    try {
      console.log(logMessage);
    } catch (e) {
      // 忽略控制台错误
    }
  },

  /**
   * 显示反馈
   */
  showFeedback(message, type = 'info') {
    this.log(`反馈 [${type}]: ${message}`);
    
    try {
      if (Zotero.Alert) {
        Zotero.Alert(message, '研学港');
      } else {
        alert(`研学港: ${message}`);
      }
    } catch (e) {
      this.log('显示反馈失败: ' + e.message);
    }
  }
};
