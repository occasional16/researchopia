/*
  Researchopia for Zotero - Ultra Simple Fixed Version
*/

Zotero.Researchopia = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  addedElementIDs: [],
  registeredSection: null,

  init({ id, version, rootURI }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  },

  log(msg) {
    Zotero.debug("Researchopia: " + msg);
    try {
      console.log("Researchopia Debug: " + msg);
    } catch {}
  },

  /**
   * 处理错误
   */
  handleError(error, context = {}) {
    try {
      if (typeof ErrorHandler !== 'undefined') {
        return ErrorHandler.handleError(error, {
          type: ErrorHandler.ErrorTypes.ANNOTATION,
          context: context.context || 'researchopia',
          showToUser: context.showToUser !== false,
          ...context
        });
      } else {
        // 回退到基本错误处理
        this.log(`Error: ${error.message || error}`);
        if (context.showToUser !== false) {
          this.showAlert(null, `操作失败: ${error.message || error}`, 'error');
        }
      }
    } catch (handlerError) {
      this.log(`Error in error handler: ${handlerError.message}`);
    }
  },

  /**
   * 显示用户反馈
   */
  showFeedback(message, type = 'info', options = {}) {
    try {
      if (typeof FeedbackSystem !== 'undefined') {
        return FeedbackSystem.showNotification(message, type, options);
      } else {
        // 回退到基本反馈
        this.showAlert(null, message, type);
      }
    } catch (error) {
      this.log(`Error showing feedback: ${error.message}`);
    }
  },

  registerItemPaneSection() {
    try {
      if (!Zotero.ItemPaneManager) {
        throw new Error("Zotero.ItemPaneManager not available");
      }
      if (this.registeredSection) {
        this.log('Section already registered');
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
      this.log("Item Pane section registered successfully");
    } catch (e) {
      this.log("Failed to register Item Pane section: " + e);
    }
  },

  renderItemPane(body, item) {
    body.replaceChildren();

    const container = body.ownerDocument.createElement("div");
    container.className = "researchopia-container";

    // 创建标题区域
    const headerArea = body.ownerDocument.createElement('div');
    headerArea.className = 'researchopia-header';

    const title = body.ownerDocument.createElement('h3');
    title.textContent = '研学港 Researchopia';
    title.className = 'researchopia-title';

    const subtitle = body.ownerDocument.createElement('p');
    subtitle.textContent = '学术标注分享平台';
    subtitle.className = 'researchopia-subtitle';

    headerArea.appendChild(title);
    headerArea.appendChild(subtitle);

    // 创建用户认证区域
    const authArea = body.ownerDocument.createElement('div');
    authArea.className = 'researchopia-auth-area';
    authArea.id = 'researchopia-auth-panel';

    // 初始化用户界面
    if (typeof UserInterface !== 'undefined') {
      UserInterface.createUserPanel(authArea);

      // 启动同步状态更新器
      if (typeof UserInterface.startSyncStatusUpdater === 'function') {
        UserInterface.startSyncStatusUpdater();
      }
    }

    // 创建状态显示区域
    const statusArea = body.ownerDocument.createElement('div');
    statusArea.className = 'researchopia-status-area';

    const alert = body.ownerDocument.createElement('div');
    alert.className = 'researchopia-alert';

    // 创建按钮区域
    const buttonArea = body.ownerDocument.createElement('div');
    buttonArea.className = 'researchopia-button-area';

    const shareBtn = body.ownerDocument.createElement("button");
    shareBtn.textContent = "🔗 分享标注";
    shareBtn.className = "researchopia-btn annotation-btn";
    shareBtn.title = "检测并分享当前文档的标注到研学港";

    const browseBtn = body.ownerDocument.createElement("button");
    browseBtn.textContent = "🌐 浏览标注";
    browseBtn.className = "researchopia-btn browse-btn";
    browseBtn.title = "浏览其他用户分享的标注";

    const websiteBtn = body.ownerDocument.createElement("button");
    websiteBtn.textContent = "🏠 访问主网站";
    websiteBtn.className = "researchopia-btn website-btn";
    websiteBtn.title = "打开研学港主网站进行登录和设置";

    const refreshBtn = body.ownerDocument.createElement("button");
    refreshBtn.textContent = "🔄 刷新";
    refreshBtn.className = "researchopia-btn secondary";
    refreshBtn.title = "重新检测标注";

    buttonArea.appendChild(shareBtn);
    buttonArea.appendChild(browseBtn);
    buttonArea.appendChild(websiteBtn);
    buttonArea.appendChild(refreshBtn);

    statusArea.appendChild(alert);

    // 组装界面
    container.appendChild(headerArea);
    container.appendChild(authArea);
    container.appendChild(statusArea);
    container.appendChild(buttonArea);
    body.appendChild(container);

    // 初始化用户界面组件
    if (typeof UserInterface !== 'undefined') {
      try {
        UserInterface.createUserPanel(authArea);
      } catch (e) {
        this.log("Failed to create user panel: " + e, 'warn');
      }
    }

    // 初始状态显示
    this.updateItemStatus(alert, item);

    // 分享按钮事件
    shareBtn.addEventListener('click', async () => {
      shareBtn.disabled = true;
      shareBtn.textContent = "🔄 处理中...";
      refreshBtn.disabled = true;
      try {
        this.showAlert(alert, '🔄 检测中...', 'info');

        if (!item) {
          this.showAlert(alert, '❌ 请选择文档', 'auto');
          return;
        }

        // 使用简化的标注检测方法
        const annotations = await this.getItemAnnotations(item);

        this.log(`最终检测到 ${annotations.length} 个标注`);

        // 显示检测结果并处理分享
        if (annotations.length === 0) {
          this.showAlert(alert, '❌ 未检测到标注 - 请确保PDF文档包含标注且已正确保存', 'auto');
          this.log("标注检测失败的可能原因:");
          this.log("1. PDF文档中没有标注");
          this.log("2. 标注未正确保存到Zotero");
          this.log("3. Zotero版本兼容性问题");
        } else {
          // 显示检测到的标注详细信息
          const annotationSummary = this.getAnnotationSummary(annotations);
          this.showAlert(alert, `✅ 检测到 ${annotations.length} 个标注${annotationSummary}`, 'auto');

          // 使用新的标注选择器
          try {
            this.log(`开始使用标注分享对话框处理 ${annotations.length} 个标注`);
            this.showAlert(alert, '📋 准备分享标注...', 'info');

            // 使用新的分享对话框
            let selectionResult = null;
            if (typeof AnnotationShareDialog !== 'undefined') {
              this.log("使用新的分享对话框");
              selectionResult = await AnnotationShareDialog.showShareDialog(annotations);

              // 转换结果格式以兼容现有代码
              if (selectionResult && selectionResult.success) {
                selectionResult = {
                  annotations: annotations,
                  privacyLevel: 'public',
                  count: annotations.length
                };
              }
            } else {
              this.log("分享对话框不可用，使用简化流程");
              // 简化的确认对话框
              const confirmed = Services.prompt.confirm(
                null,
                "分享标注",
                `确定要分享 ${annotations.length} 个标注到研学港吗？`
              );

              if (confirmed) {
                selectionResult = {
                  annotations: annotations,
                  privacyLevel: 'public',
                  count: annotations.length
                };
              }
            }

            if (selectionResult && selectionResult.annotations.length > 0) {
              this.log(`用户选择了 ${selectionResult.annotations.length} 个标注进行分享`);
              this.showAlert(alert, `🚀 正在分享 ${selectionResult.annotations.length} 个标注...`, 'info');

              // 执行实际的分享操作
              if (Zotero.Researchopia.AnnotationSharing) {
                const shareResult = await Zotero.Researchopia.AnnotationSharing.shareAnnotations(
                  selectionResult.annotations,
                  {
                    privacyLevel: selectionResult.privacyLevel,
                    selectedCount: selectionResult.count
                  }
                );

                if (shareResult.success) {
                  if (shareResult.mode === 'offline') {
                    this.showAlert(alert, `✅ 离线模式：已处理 ${shareResult.count} 个标注`, 'auto');
                  } else {
                    this.showAlert(alert, `✅ 成功分享 ${shareResult.count} 个标注 (${selectionResult.privacyLevel})`, 'auto');
                  }
                } else {
                  this.showAlert(alert, `❌ 分享失败: ${shareResult.error}`, 'auto');
                }
              } else {
                this.showAlert(alert, '❌ 标注分享模块未加载', 'auto');
              }
            } else {
              this.log("用户取消了标注选择");
              this.showAlert(alert, '📋 已取消分享', 'auto');
            }
          } catch (selectorError) {
            this.log("标注选择器错误: " + selectorError);

            // 如果选择器失败，回退到原有的全量分享方式
            this.log("回退到传统分享方式");
            this.showAlert(alert, '🚀 正在分享所有标注...', 'info');

            if (Zotero.Researchopia.AnnotationSharing) {
              try {
                const result = await Zotero.Researchopia.AnnotationSharing.shareAnnotations(annotations);
                if (result.success) {
                  this.showAlert(alert, `✅ 成功分享 ${result.count} 个标注到服务器！`, 'auto');
                } else {
                  this.showAlert(alert, `❌ 分享失败: ${result.error}`, 'auto');
                }
              } catch (e) {
                this.log("Error sharing annotations: " + e);
                this.showAlert(alert, '❌ 分享失败: ' + e.message, 'auto');
              }
            } else {
              this.showAlert(alert, '⚠️ 标注分享模块未加载', 'auto');
              this.log("AnnotationSharing模块未找到，请检查插件是否正确加载");
            }
          }
        }

      } catch (error) {
        this.log("检测标注时发生错误: " + error);
        this.showAlert(alert, '❌ 检测失败: ' + error.message, 'auto');
      } finally {
        // 恢复按钮状态
        shareBtn.disabled = false;
        shareBtn.textContent = "🔗 分享标注";
        refreshBtn.disabled = false;
      }
    });

    // 浏览按钮事件
    browseBtn.addEventListener('click', async () => {
      try {
        browseBtn.disabled = true;
        browseBtn.textContent = "🔄 打开中...";
        // 简化处理：直接在主网站中打开浏览页，避免 data:URL + 内联脚本被策略拦截导致空白
        this.openMainWebsite('');
      } catch (error) {
        this.log("Error opening annotation browser: " + error);
        this.showAlert(alert, '❌ 打开浏览器失败', 'auto');
      } finally {
        browseBtn.disabled = false;
        browseBtn.textContent = "🌐 浏览标注";
      }
    });

    // 主网站按钮事件
    websiteBtn.addEventListener('click', () => {
      try {
        this.openMainWebsite();
        this.log("Main website opened");
      } catch (error) {
        this.log("Error opening main website: " + error);
        this.showAlert(alert, '❌ 打开主网站失败: ' + error.message, 'auto');
      }
    });

    // 刷新按钮事件
    refreshBtn.addEventListener('click', () => {
      this.updateItemStatus(alert, item);
    });
  },

  /**
   * 更新项目状态显示
   */
  updateItemStatus(alert, item) {
    try {
      if (!item) {
        this.showAlert(alert, 'ℹ️ 请选择一个文档项目');
        return;
      }

      let statusMessage = '';

      if (item.isRegularItem()) {
        const attachments = item.getAttachments();
        const pdfCount = attachments.filter(id => {
          const attachment = Zotero.Items.get(id);
          return attachment && attachment.attachmentContentType === 'application/pdf';
        }).length;

        if (pdfCount > 0) {
          statusMessage = `📄 常规项目，包含 ${pdfCount} 个PDF附件`;
        } else {
          statusMessage = '⚠️ 常规项目，但没有PDF附件';
        }
      } else if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
        statusMessage = '📎 PDF附件';
      } else {
        statusMessage = '❓ 不支持的项目类型';
      }

      this.showAlert(alert, statusMessage, 'auto');
    } catch (e) {
      this.log("更新状态时出错: " + e);
      this.showAlert(alert, '❌ 状态更新失败', 'auto');
    }
  },

  /**
   * 获取标注摘要信息
   */
  getAnnotationSummary(annotations) {
    try {
      if (annotations.length === 0) return '';

      const types = {};
      let sampleText = '';

      for (let i = 0; i < Math.min(annotations.length, 3); i++) {
        const ann = annotations[i];
        const type = ann.annotationType || ann.getField?.('annotationType') || 'unknown';
        types[type] = (types[type] || 0) + 1;

        if (i === 0) {
          const text = ann.annotationText || ann.getField?.('annotationText') || '';
          if (text) {
            sampleText = text.substring(0, 30) + (text.length > 30 ? '...' : '');
          }
        }
      }

      const typesSummary = Object.entries(types)
        .map(([type, count]) => `${type}(${count})`)
        .join(', ');

      return `\n类型: ${typesSummary}${sampleText ? `\n示例: "${sampleText}"` : ''}`;
    } catch (e) {
      this.log("获取标注摘要时出错: " + e);
      return '';
    }
  },

  /**
   * 简化的标注检测方法
   */
  async getItemAnnotations(item) {
    try {
      let annotations = [];

      // 如果是PDF附件，直接获取标注
      if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
        annotations = await this.getAttachmentAnnotations(item);
      }
      // 如果是常规项目，检查所有PDF附件
      else if (item.isRegularItem()) {
        const attachments = item.getAttachments();
        for (const attachmentID of attachments) {
          const attachment = Zotero.Items.get(attachmentID);
          if (attachment && attachment.attachmentContentType === 'application/pdf') {
            const attachmentAnnotations = await this.getAttachmentAnnotations(attachment);
            annotations.push(...attachmentAnnotations);
          }
        }
      }

      this.log(`检测到 ${annotations.length} 个标注`);
      return annotations;
    } catch (e) {
      this.log("获取标注时出错: " + e);
      return [];
    }
  },

  /**
   * 获取单个附件的标注
   */
  async getAttachmentAnnotations(attachment) {
    try {
      const annotations = [];
      let annotationIDs = [];

      this.log(`开始检测附件标注: ${attachment.id}, 类型: ${attachment.attachmentContentType}`);

      // 方法1: 使用getAnnotations() - Zotero 7+
      if (typeof attachment.getAnnotations === 'function') {
        try {
          const annotationResults = attachment.getAnnotations();
          this.log(`getAnnotations() 原始结果: ${JSON.stringify(annotationResults).substring(0, 200)}`);

          // 处理不同的返回格式
          if (Array.isArray(annotationResults)) {
            for (const item of annotationResults) {
              if (typeof item === 'number') {
                // 直接是ID
                annotationIDs.push(item);
              } else if (typeof item === 'object' && item !== null) {
                // 是对象，尝试获取ID
                if (item.id) {
                  annotationIDs.push(item.id);
                } else if (item.itemID) {
                  annotationIDs.push(item.itemID);
                } else {
                  // 可能对象本身就是Zotero Item
                  if (item.isAnnotation && item.isAnnotation()) {
                    annotations.push(item);
                    this.log(`直接添加标注对象: ID=${item.id}, 类型=${item.annotationType || 'unknown'}`);
                  }
                }
              }
            }
          }
          this.log(`getAnnotations() 处理后找到 ${annotationIDs.length} 个标注ID，${annotations.length} 个直接对象`);
        } catch (e) {
          this.log(`getAnnotations() 失败: ${e.message}`);
        }
      } else {
        this.log("getAnnotations() 方法不可用");
      }

      // 方法2: 使用搜索 - 兼容性方法
      if (annotationIDs.length === 0) {
        try {
          const search = new Zotero.Search();
          search.addCondition('itemType', 'is', 'annotation');
          search.addCondition('parentID', 'is', attachment.id);
          annotationIDs = await search.search();
          this.log(`搜索找到 ${annotationIDs.length} 个标注ID`);
        } catch (e) {
          this.log(`搜索标注失败: ${e.message}`);
        }
      }

      // 方法3: 直接查找子项目 - 备用方法
      if (annotationIDs.length === 0) {
        try {
          const childItems = attachment.getChildren();
          for (const childID of childItems) {
            const child = Zotero.Items.get(childID);
            if (child && child.isAnnotation && child.isAnnotation()) {
              annotationIDs.push(childID);
            }
          }
          this.log(`子项目查找找到 ${annotationIDs.length} 个标注ID`);
        } catch (e) {
          this.log(`子项目查找失败: ${e.message}`);
        }
      }

      // 方法4: 使用Zotero.Annotations API - 如果可用
      if (annotationIDs.length === 0 && Zotero.Annotations) {
        try {
          const annotationItems = await Zotero.Annotations.getByParent(attachment.id);
          annotationIDs = annotationItems.map(item => item.id);
          this.log(`Zotero.Annotations API找到 ${annotationIDs.length} 个标注`);
        } catch (e) {
          this.log(`Zotero.Annotations API失败: ${e.message}`);
        }
      }

      // 转换ID为标注对象
      for (const annotID of annotationIDs) {
        try {
          const annotation = Zotero.Items.get(annotID);
          this.log(`获取到项目: ID=${annotID}, 存在=${!!annotation}`);

          if (annotation) {
            // 详细检查标注类型
            const itemType = annotation.itemType;
            const itemTypeID = annotation.itemTypeID;
            const annotationType = annotation.annotationType;

            this.log(`项目详情: itemType=${itemType}, itemTypeID=${itemTypeID}, annotationType=${annotationType}`);

            // 多种方式检查是否为标注类型
            let isAnnotation = false;

            // 方法1: 使用isAnnotation()方法
            if (typeof annotation.isAnnotation === 'function') {
              try {
                isAnnotation = annotation.isAnnotation();
                this.log(`isAnnotation()方法结果: ${isAnnotation}`);
              } catch (e) {
                this.log(`isAnnotation()方法失败: ${e.message}`);
              }
            }

            // 方法2: 检查itemType
            if (!isAnnotation && itemType === 'annotation') {
              isAnnotation = true;
              this.log(`通过itemType识别为标注`);
            }

            // 方法3: 检查itemTypeID
            if (!isAnnotation && Zotero.ItemTypes && Zotero.ItemTypes.getID) {
              try {
                const annotationTypeID = Zotero.ItemTypes.getID('annotation');
                if (itemTypeID === annotationTypeID) {
                  isAnnotation = true;
                  this.log(`通过itemTypeID识别为标注`);
                }
              } catch (e) {
                this.log(`ItemTypes.getID失败: ${e.message}`);
              }
            }

            // 方法4: 检查annotationType属性
            if (!isAnnotation && annotationType) {
              isAnnotation = true;
              this.log(`通过annotationType属性识别为标注`);
            }

            if (isAnnotation) {
              annotations.push(annotation);
              this.log(`✅ 添加标注: ID=${annotation.id}, 类型=${annotationType || 'unknown'}`);
            } else {
              this.log(`❌ 项目不是标注类型: ID=${annotID}`);
            }
          } else {
            this.log(`❌ 无法获取项目对象: ID=${annotID}`);
          }
        } catch (e) {
          this.log(`❌ 获取标注对象异常 (ID: ${annotID}): ${e.message}`);
        }
      }

      this.log(`最终获取到 ${annotations.length} 个有效标注`);
      return annotations;
    } catch (e) {
      this.log("获取附件标注时出错: " + e);
      return [];
    }
  },

  showAlert(alertNode, msg, type = 'info') {
    if (!alertNode) return;

    // 清除之前的状态类
    alertNode.classList.remove('success', 'error', 'warning', 'info');

    if (!msg) {
      alertNode.style.display = 'none';
      alertNode.textContent = '';
    } else {
      alertNode.style.display = 'block';
      alertNode.textContent = msg;

      // 根据消息内容自动判断类型
      if (type === 'auto') {
        if (msg.includes('✅') || msg.includes('成功')) {
          type = 'success';
        } else if (msg.includes('❌') || msg.includes('失败') || msg.includes('错误')) {
          type = 'error';
        } else if (msg.includes('⚠️') || msg.includes('警告')) {
          type = 'warning';
        } else {
          type = 'info';
        }
      }

      alertNode.classList.add(type);
    }
  },

  addToAllWindows() {
    // 兼容Zotero启动流程，实际逻辑已在registerItemPaneSection中处理
    this.log("addToAllWindows called");
    // 不需要额外操作，保持为空函数以兼容bootstrap.js的调用
  },

  async main() {
    this.log("Researchopia 插件启动");
    this.registerItemPaneSection();
    
    // 初始化标注分享模块
    if (this.AnnotationSharing) {
      try {
        this.AnnotationSharing.init();
        this.log("Annotation sharing module initialized");
      } catch (e) {
        this.log("Failed to initialize annotation sharing module: " + e);
      }
    }
  },
  
  removeFromAllWindows() {
    this.log("removeFromAllWindows called");
    // 清理资源，在插件关闭时调用
  },
  
  unregisterItemPaneSection() {
    if (this.registeredSection) {
      try {
        this.registeredSection.unregister();
        this.log("Item Pane section unregistered");
      } catch (e) {
        this.log("Failed to unregister Item Pane section: " + e);
      }
      this.registeredSection = null;
    }
  },

  // 启动插件的所有功能模块
  startup() {
    this.log("Starting up Researchopia plugin modules");

    try {
      // 初始化认证管理器
      if (typeof AuthManager !== 'undefined') {
        AuthManager.init();
        this.log("Authentication manager initialized");
      } else {
        this.log("AuthManager not available", 'warn');
      }

      // 注册Item Pane部分
      this.registerItemPaneSection();

      // 初始化标注分享模块
      if (typeof Zotero !== 'undefined' && Zotero.Researchopia && Zotero.Researchopia.AnnotationSharing) {
        Zotero.Researchopia.AnnotationSharing.init();
        this.log("Annotation sharing module initialized");
      } else {
        this.log("AnnotationSharing not available", 'warn');
      }

      // 初始化标注选择器
      if (typeof AnnotationSelector !== 'undefined') {
        AnnotationSelector.init();
        this.log("Annotation selector initialized");
      } else {
        this.log("AnnotationSelector not available", 'warn');
      }

      // 初始化社交功能
      if (typeof SocialFeatures !== 'undefined') {
        SocialFeatures.init();
        this.log("Social features initialized");
      } else {
        this.log("SocialFeatures not available", 'warn');
      }

      // 初始化标注浏览器
      if (typeof AnnotationBrowser !== 'undefined') {
        AnnotationBrowser.init();
        this.log("Annotation browser initialized");
      } else {
        this.log("AnnotationBrowser not available", 'warn');
      }

      // 初始化隐私管理器
      if (typeof PrivacyManager !== 'undefined') {
        PrivacyManager.init();
        this.log("Privacy manager initialized");
      } else {
        this.log("PrivacyManager not available", 'warn');
      }

      // 初始化协作管理器
      if (typeof CollaborationManager !== 'undefined') {
        CollaborationManager.init();
        this.log("Collaboration manager initialized");
      } else {
        this.log("CollaborationManager not available", 'warn');
      }

      // 延迟初始化用户界面，确保DOM已准备好
      setTimeout(() => {
        try {
          if (typeof UserInterface !== 'undefined') {
            UserInterface.init();
            this.log("User interface initialized");
          } else {
            this.log("UserInterface not available", 'warn');
          }
        } catch (error) {
          this.log("Error initializing user interface: " + error.message);
        }
      }, 2000); // 增加延迟时间确保DOM完全加载

      // 设置事件监听器
      this.setupEventListeners();

      this.log("Plugin startup completed");
    } catch (error) {
      this.log("Error during plugin startup: " + error.message);
    }
  },

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    try {
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.addObserver(this, 'researchopia:refreshUserPanels', false);
        this.log("Event listeners setup completed");
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
        case 'researchopia:refreshUserPanels':
          this.refreshAllUserPanels();
          break;
      }
    } catch (error) {
      this.log(`Error handling observer event: ${error.message}`, 'error');
    }
  },

  /**
   * 刷新所有用户面板
   */
  refreshAllUserPanels() {
    try {
      // 这里可以触发所有已渲染的用户面板刷新
      // 由于Zotero的架构，我们通过重新触发itempane刷新来实现
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.notifyObservers(null, 'refresh', 'itempane');
      }
      this.log("Refreshed all user panels");
    } catch (error) {
      this.log(`Error refreshing all user panels: ${error.message}`, 'error');
    }
  },

  /**
   * 打开主网站
   */
  async openMainWebsite(path = '') {
    try {
      // 优先尝试本地开发站点
      const candidates = [
        'http://localhost:3001', // 当前运行端口
        'http://localhost:3000',
        'http://localhost:3002',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3000',
        'https://researchopia.com'
      ];

      let base = 'https://researchopia.com';
      // 轻量探测本地主机是否在线
      for (const host of candidates) {
        try {
          const url = `${host}/api/auth/status`;
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 1200;
            xhr.open('GET', url, true);
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 500) ? resolve() : reject();
            xhr.onerror = () => reject();
            xhr.ontimeout = () => reject();
            xhr.send();
          });
          base = host;
          break;
        } catch (_) {
          // try next
        }
      }

      const websiteUrl = path ? `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}` : base;

      if (typeof Zotero !== 'undefined' && Zotero.launchURL) {
        Zotero.launchURL(websiteUrl);
        this.log(`Opened main website: ${websiteUrl}`);
      } else if (typeof Services !== 'undefined' && Services.wm) {
        const win = Services.wm.getMostRecentWindow('navigator:browser') ||
                    Services.wm.getMostRecentWindow('mail:3pane') ||
                    Services.wm.getMostRecentWindow(null);
        if (win && win.open) {
          win.open(websiteUrl, '_blank');
          this.log(`Opened main website using window.open: ${websiteUrl}`);
        } else {
          throw new Error('No suitable window found');
        }
      } else {
        throw new Error('No suitable method to open URL');
      }
    } catch (error) {
      this.log(`Error opening main website: ${error.message}`, 'error');

      // 显示URL给用户手动复制
      const fallbackUrl = base || 'http://localhost:3001';
      const message = `无法自动打开主网站，请手动访问：\n\n${fallbackUrl}\n\n您可以在主网站进行登录、设置和管理您的标注。`;

      if (typeof Services !== 'undefined' && Services.prompt) {
        Services.prompt.alert(null, '研学港 - 主网站', message);
      } else {
        // Fallback: 尝试使用alert
        try {
          alert(message);
        } catch (e) {
          this.log('Failed to show alert dialog', 'error');
        }
      }
    }
  }
};
