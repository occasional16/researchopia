/**
 * Researchopia Main Plugin Script
 * 模块化的主插件逻辑
 */

// 日志函数
function log(message) {
  if (typeof Zotero !== 'undefined' && Zotero.debug) {
    Zotero.debug("Researchopia: " + message);
  }
}

// 主插件类
class ResearchopiaPlugin {
  constructor() {
    this.id = 'researchopia@zotero.plugin';
    this.version = '0.1.95';
    this.initialized = false;
    this.authManager = null;
    this.supabaseAPI = null;
  }

  // 插件钩子
  get hooks() {
    return {
      onStartup: this.onStartup.bind(this),
      onMainWindowLoad: this.onMainWindowLoad.bind(this),
      onMainWindowUnload: this.onMainWindowUnload.bind(this),
      onShutdown: this.onShutdown.bind(this)
    };
  }

  async onStartup() {
    try {
      log("🚀 Starting Researchopia plugin v" + this.version);
      
      // 初始化认证管理器
      await this.initializeAuth();
      
      // 初始化Supabase API
      await this.initializeSupabase();
      
      // 注册UI组件
      await this.registerUI();
      
      this.initialized = true;
      log("✅ Plugin startup completed successfully");
      
    } catch (error) {
      log("❌ Plugin startup failed: " + error.message);
      throw error;
    }
  }

  async initializeAuth() {
    try {
      log("🔄 Initializing authentication...");
      
      // 简化的认证管理器
      this.authManager = {
        isAuthenticated: () => {
          return Zotero.Prefs.get('extensions.researchopia.auth.token') ? true : false;
        },
        getToken: () => {
          return Zotero.Prefs.get('extensions.researchopia.auth.token');
        },
        getUserId: () => {
          return Zotero.Prefs.get('extensions.researchopia.auth.userId');
        }
      };
      
      log("✅ Authentication manager initialized");
    } catch (error) {
      log("❌ Auth initialization failed: " + error.message);
      throw error;
    }
  }

  async initializeSupabase() {
    try {
      log("🔄 Initializing Supabase API...");

      // 真实的Supabase API实现
      this.supabaseAPI = {
        baseUrl: 'https://obcblvdtqhwrihoddlez.supabase.co',
        apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4',

        // 通用HTTP请求方法
        async makeRequest(endpoint, method = 'GET', data = null) {
          const url = this.baseUrl + '/rest/v1/' + endpoint;
          const headers = {
            'apikey': this.apiKey,
            'Authorization': 'Bearer ' + this.apiKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          };

          const options = {
            method: method,
            headers: headers
          };

          if (data && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
          }

          log(`🌐 Making ${method} request to: ${url}`);
          if (data) {
            log(`📤 Request data: ${JSON.stringify(data, null, 2).substring(0, 500)}...`);
          }

          try {
            const response = await fetch(url, options);
            const responseText = await response.text();

            log(`📡 Response status: ${response.status}`);
            log(`📡 Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
            log(`📡 Response body: ${responseText.substring(0, 500)}...`);

            if (!response.ok) {
              // 对于权限错误，提供更详细的信息
              if (response.status === 401) {
                log(`🔐 Authentication issue: This might be due to Row Level Security (RLS) policies`);
              }
              throw new Error(`HTTP ${response.status}: ${responseText}`);
            }

            return responseText ? JSON.parse(responseText) : null;
          } catch (error) {
            log(`❌ Request failed: ${error.message}`);
            throw error;
          }
        },

        // 生成UUID的简单函数
        generateUUID() {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        },

        async uploadAnnotations(annotations) {
          log("📤 Uploading " + annotations.length + " annotations");

          try {
            // 生成随机UUID
            const documentId = this.generateUUID();
            const userId = this.generateUUID();
            const doi = annotations[0]?.paperDoi || 'unknown';

            log(`🔑 Generated IDs - Document: ${documentId}, User: ${userId}`);

            // 步骤1：先创建用户记录（如果users表存在）
            try {
              const userData = {
                id: userId,
                email: `user_${userId.substring(0, 8)}@researchopia.com`,
                username: `user_${userId.substring(0, 8)}`,
                created_at: new Date().toISOString()
              };

              log(`👤 Creating user: ${JSON.stringify(userData)}`);
              await this.makeRequest('users', 'POST', userData);
              log(`✅ User created successfully`);
            } catch (userError) {
              log(`⚠️ User creation failed (might not be needed): ${userError.message}`);
            }

            // 步骤2：先创建文档记录
            try {
              const documentData = {
                id: documentId,
                title: `Paper with DOI: ${doi}`,
                doi: doi,
                created_at: new Date().toISOString()
              };

              log(`📄 Creating document: ${JSON.stringify(documentData)}`);
              await this.makeRequest('documents', 'POST', documentData);
              log(`✅ Document created successfully`);
            } catch (docError) {
              log(`❌ Document creation failed: ${docError.message}`);
              throw new Error(`无法创建文档记录: ${docError.message}`);
            }

            // 步骤3：创建标注记录
            const annotationData = annotations.map(ann => ({
              // 必需字段
              document_id: documentId,
              user_id: userId,
              type: ann.type || 'highlight',
              position: {
                page: parseInt(ann.page) || 1,
                key: ann.key || '',
                doi: doi,
                zotero_key: ann.key || ''
              },
              // 可选字段
              content: ann.text || '',
              comment: ann.comment || '',
              color: ann.color || '#ffd400',
              visibility: 'public',
              platform: 'zotero',
              original_id: ann.key || ''
            }));

            log(`📋 Creating annotations: ${annotationData.length} items`);

            // 批量插入标注
            const result = await this.makeRequest('annotations', 'POST', annotationData);

            log(`✅ Successfully uploaded ${annotationData.length} annotations`);
            return { success: true, count: annotationData.length, data: result };

          } catch (error) {
            log(`❌ Upload failed: ${error.message}`);

            // 提供更友好的错误信息
            if (error.message.includes('row-level security policy')) {
              throw new Error('数据库权限限制：需要配置Supabase行级安全策略或使用认证用户');
            } else if (error.message.includes('foreign key constraint')) {
              throw new Error('数据库约束错误：用户或文档ID不存在');
            } else {
              throw error;
            }
          }
        },

        async getSharedAnnotations(paperId) {
          log("📥 Loading shared annotations for paper: " + paperId);

          try {
            // 简化查询，获取所有标注
            const result = await this.makeRequest(`annotations?select=*`);

            log(`✅ Loaded ${result.length} shared annotations`);
            return result.map(ann => ({
              id: ann.id,
              text: ann.content || ann.text || '',
              comment: ann.comment || '',
              user: ann.user || 'anonymous',
              type: ann.type || 'highlight',
              page: ann.page || '',
              color: ann.color || '#ffd400',
              likes: 0,
              comments: 0,
              created_at: ann.created_at
            }));

          } catch (error) {
            log(`❌ Loading failed: ${error.message}`);
            // 返回空数组而不是抛出错误，这样界面仍然可以显示
            return [];
          }
        },

        async likeAnnotation(annotationId) {
          log("👍 Liking annotation: " + annotationId);

          try {
            const userId = 'user_' + Date.now(); // 临时用户ID
            const likeData = {
              id: 'like_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
              user_id: userId,
              annotation_id: annotationId,
              created_at: new Date().toISOString()
            };

            const result = await this.makeRequest('likes', 'POST', likeData);

            log("✅ Like added successfully");
            return { success: true, data: result };

          } catch (error) {
            log(`❌ Like failed: ${error.message}`);
            throw error;
          }
        },

        async addComment(annotationId, comment) {
          log("💬 Adding comment to annotation: " + annotationId);

          try {
            const userId = 'user_' + Date.now(); // 临时用户ID
            const commentData = {
              id: 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
              user_id: userId,
              annotation_id: annotationId,
              content: comment,
              created_at: new Date().toISOString()
            };

            const result = await this.makeRequest('comments', 'POST', commentData);

            log("✅ Comment added successfully");
            return { success: true, data: result };

          } catch (error) {
            log(`❌ Comment failed: ${error.message}`);
            throw error;
          }
        }
      };

      log("✅ Supabase API initialized");
    } catch (error) {
      log("❌ Supabase initialization failed: " + error.message);
      throw error;
    }
  }

  async registerUI() {
    try {
      log("🔄 Registering UI components...");
      
      // 注册Item Pane
      await this.registerItemPane();
      
      // 注册偏好设置面板
      this.registerPreferencesPane();
      
      log("✅ UI components registered");
    } catch (error) {
      log("❌ UI registration failed: " + error.message);
      throw error;
    }
  }

  async registerItemPane() {
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
  }

  registerPreferencesPane() {
    const prefOptions = {
      pluginID: this.id,
      src: rootURI + "content/preferences.xhtml",
      label: "Researchopia",
      image: `chrome://zotero/skin/16/universal/note.svg`,
      defaultXUL: true,
    };
    Zotero.PreferencePanes.register(prefOptions);
  }

  renderPane(body, item, editable, tabType) {
    try {
      log('🔍 Rendering pane - Supabase API status: ' + (this.supabaseAPI ? 'initialized' : 'null'));
      
      const doc = body.ownerDocument;
      body.innerHTML = '';

      // 创建简单的界面
      const container = doc.createElement('div');
      container.style.cssText = 'padding: 15px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';

      if (!item) {
        container.innerHTML = '<div style="color: #666;">请选择一个文献项目</div>';
      } else {
        this.renderItemContent(doc, container, item);
      }

      body.appendChild(container);

    } catch (error) {
      log("❌ Error rendering pane: " + error.message);
      body.innerHTML = '<div style="color: #dc2626; padding: 15px;">渲染错误: ' + error.message + '</div>';
    }
  }

  renderItemContent(doc, container, item) {
    const doi = item.getField('DOI');

    if (!doi) {
      // 使用DOM API而不是innerHTML
      const noDOIDiv = doc.createElement('div');
      noDOIDiv.style.cssText = 'text-align: center; color: #666;';

      const iconDiv = doc.createElement('div');
      iconDiv.style.cssText = 'font-size: 24px; margin-bottom: 10px;';
      iconDiv.textContent = '📄';

      const messageDiv = doc.createElement('div');
      messageDiv.textContent = '此文献没有DOI';

      const hintDiv = doc.createElement('div');
      hintDiv.style.cssText = 'font-size: 12px; margin-top: 5px;';
      hintDiv.textContent = '标注共享功能需要DOI来识别论文';

      noDOIDiv.appendChild(iconDiv);
      noDOIDiv.appendChild(messageDiv);
      noDOIDiv.appendChild(hintDiv);
      container.appendChild(noDOIDiv);
      return;
    }

    // 创建标题区域
    const headerDiv = doc.createElement('div');
    headerDiv.style.cssText = 'margin-bottom: 15px;';

    const title = doc.createElement('h3');
    title.style.cssText = 'margin: 0 0 10px 0; font-size: 16px; color: #2c3e50;';
    title.textContent = '📝 标注管理';

    const doiDiv = doc.createElement('div');
    doiDiv.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 15px;';
    doiDiv.textContent = 'DOI: ' + doi;

    headerDiv.appendChild(title);
    headerDiv.appendChild(doiDiv);

    // 创建按钮区域
    const buttonDiv = doc.createElement('div');
    buttonDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 15px;';

    const extractBtn = doc.createElement('button');
    extractBtn.id = 'extract-annotations';
    extractBtn.style.cssText = 'flex: 1; padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';
    extractBtn.textContent = '📋 提取我的标注';

    const shareBtn = doc.createElement('button');
    shareBtn.id = 'share-annotations';
    shareBtn.style.cssText = 'flex: 1; padding: 8px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; opacity: 0.5;';
    shareBtn.textContent = '📤 共享我的标注';
    shareBtn.disabled = true;

    const viewBtn = doc.createElement('button');
    viewBtn.id = 'view-shared';
    viewBtn.style.cssText = 'flex: 1; padding: 8px 12px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;';
    viewBtn.textContent = '👥 查看共享标注';

    buttonDiv.appendChild(extractBtn);
    buttonDiv.appendChild(shareBtn);
    buttonDiv.appendChild(viewBtn);

    // 创建状态区域
    const statusArea = doc.createElement('div');
    statusArea.id = 'status-area';
    statusArea.style.cssText = 'padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px; color: #666;';
    statusArea.textContent = '💡 点击"提取我的标注"开始使用标注管理功能';

    // 创建内容区域
    const contentArea = doc.createElement('div');
    contentArea.id = 'content-area';
    contentArea.style.cssText = 'margin-top: 15px;';

    // 组装界面
    container.appendChild(headerDiv);
    container.appendChild(buttonDiv);
    container.appendChild(statusArea);
    container.appendChild(contentArea);

    // 绑定事件
    this.bindEvents(doc, container, item);
  }

  bindEvents(doc, container, item) {
    const extractBtn = container.querySelector('#extract-annotations');
    const shareBtn = container.querySelector('#share-annotations');
    const viewBtn = container.querySelector('#view-shared');
    const statusArea = container.querySelector('#status-area');
    const contentArea = container.querySelector('#content-area');

    extractBtn.onclick = () => this.handleExtractAnnotations(item, statusArea, contentArea, shareBtn);
    shareBtn.onclick = () => this.handleShareAnnotations(item, statusArea);
    viewBtn.onclick = () => this.handleViewSharedAnnotations(item, statusArea, contentArea);
  }

  async handleExtractAnnotations(item, statusArea, contentArea, shareBtn) {
    try {
      statusArea.textContent = '🔄 正在提取标注...';

      // 模拟提取标注
      const annotations = await this.extractAnnotations(item);

      statusArea.textContent = `✅ 找到 ${annotations.length} 个标注`;

      // 清空内容区域
      contentArea.innerHTML = '';

      // 创建标注容器
      const annotationContainer = statusArea.ownerDocument.createElement('div');
      annotationContainer.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px;';

      const title = statusArea.ownerDocument.createElement('h4');
      title.style.cssText = 'margin: 0 0 10px 0; font-size: 14px;';
      title.textContent = '我的标注';
      annotationContainer.appendChild(title);

      // 添加标注项
      annotations.forEach(ann => {
        const annDiv = statusArea.ownerDocument.createElement('div');
        annDiv.style.cssText = 'margin-bottom: 8px; padding: 8px; background: #f9fafb; border-radius: 4px;';

        const textDiv = statusArea.ownerDocument.createElement('div');
        textDiv.style.cssText = 'font-size: 12px; color: #374151;';
        textDiv.textContent = `"${ann.text}"`;
        annDiv.appendChild(textDiv);

        if (ann.comment) {
          const commentDiv = statusArea.ownerDocument.createElement('div');
          commentDiv.style.cssText = 'font-size: 11px; color: #6b7280; margin-top: 4px;';
          commentDiv.textContent = `💭 ${ann.comment}`;
          annDiv.appendChild(commentDiv);
        }

        annotationContainer.appendChild(annDiv);
      });

      contentArea.appendChild(annotationContainer);

      shareBtn.disabled = false;
      shareBtn.style.opacity = '1';

    } catch (error) {
      statusArea.textContent = '❌ 提取标注失败: ' + error.message;
    }
  }

  async handleShareAnnotations(item, statusArea) {
    if (!this.supabaseAPI) {
      statusArea.textContent = '❌ Supabase API未初始化\n\n请检查配置文件或网络连接';
      return;
    }

    try {
      statusArea.textContent = '🔄 正在上传标注...';

      const annotations = await this.extractAnnotations(item);
      const result = await this.supabaseAPI.uploadAnnotations(annotations);

      statusArea.textContent = `✅ 成功上传 ${result.count} 个标注`;

    } catch (error) {
      statusArea.textContent = '❌ 上传失败: ' + error.message;
    }
  }

  async handleViewSharedAnnotations(item, statusArea, contentArea) {
    if (!this.supabaseAPI) {
      statusArea.textContent = '❌ Supabase API未初始化';
      return;
    }

    try {
      statusArea.textContent = '🔄 正在加载共享标注...';

      const doi = item.getField('DOI');
      const sharedAnnotations = await this.supabaseAPI.getSharedAnnotations(doi);

      statusArea.textContent = `✅ 加载了 ${sharedAnnotations.length} 个共享标注`;

      // 清空内容区域
      contentArea.innerHTML = '';

      // 创建共享标注容器
      const sharedContainer = statusArea.ownerDocument.createElement('div');
      sharedContainer.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px;';

      const title = statusArea.ownerDocument.createElement('h4');
      title.style.cssText = 'margin: 0 0 10px 0; font-size: 14px;';
      title.textContent = '共享标注';
      sharedContainer.appendChild(title);

      if (sharedAnnotations.length === 0) {
        const emptyDiv = statusArea.ownerDocument.createElement('div');
        emptyDiv.style.cssText = 'color: #666; font-size: 12px;';
        emptyDiv.textContent = '暂无共享标注';
        sharedContainer.appendChild(emptyDiv);
      } else {
        // 添加共享标注项
        sharedAnnotations.forEach(ann => {
          const annDiv = statusArea.ownerDocument.createElement('div');
          annDiv.style.cssText = 'margin-bottom: 12px; padding: 10px; background: #f0f9ff; border-radius: 4px;';

          const textDiv = statusArea.ownerDocument.createElement('div');
          textDiv.style.cssText = 'font-size: 12px; color: #374151;';
          textDiv.textContent = `"${ann.text}"`;
          annDiv.appendChild(textDiv);

          const metaDiv = statusArea.ownerDocument.createElement('div');
          metaDiv.style.cssText = 'font-size: 11px; color: #6b7280; margin-top: 4px;';
          metaDiv.textContent = `👤 ${ann.user} · 👍 ${ann.likes || 0} · 💬 ${ann.comments || 0}`;
          annDiv.appendChild(metaDiv);

          sharedContainer.appendChild(annDiv);
        });
      }

      contentArea.appendChild(sharedContainer);

    } catch (error) {
      statusArea.textContent = '❌ 加载失败: ' + error.message;
    }
  }

  async extractAnnotations(item) {
    // 改进的标注提取逻辑
    const annotations = [];
    const doi = item.getField('DOI');

    // 获取附件
    const attachments = item.getAttachments();
    for (const attachmentID of attachments) {
      const attachment = Zotero.Items.get(attachmentID);
      if (attachment.isPDFAttachment()) {
        // 获取PDF的标注
        const itemAnnotations = attachment.getAnnotations();
        for (const annotation of itemAnnotations) {
          annotations.push({
            key: annotation.key,
            type: annotation.annotationType,
            text: annotation.annotationText || '',
            comment: annotation.annotationComment || '',
            page: annotation.annotationPageLabel || '',
            color: annotation.annotationColor || '#ffd400',
            paperDoi: doi // 添加DOI信息
          });
        }
      }
    }

    log(`📋 Extracted ${annotations.length} annotations for DOI: ${doi}`);
    return annotations;
  }

  onMainWindowLoad(win) {
    log("Main window loaded");
  }

  onMainWindowUnload(win) {
    log("Main window unloaded");
  }

  onShutdown() {
    log("Plugin shutting down");
    this.initialized = false;
  }
}

// 创建全局插件实例
Zotero.ResearchopiaPlugin = new ResearchopiaPlugin();
