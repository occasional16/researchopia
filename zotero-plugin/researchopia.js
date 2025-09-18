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
          icon: this.rootURI + "icons/icon32.svg",
        },
        sidenav: {
          l10nID: "researchopia-sidenav-label",
          label: "研学港 Researchopia",
          icon: this.rootURI + "icons/icon32.svg",
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
    
    const alert = body.ownerDocument.createElement('div');
    alert.className = 'researchopia-alert';
    
    const shareBtn = body.ownerDocument.createElement("button");
    shareBtn.textContent = "分享标注";
    shareBtn.className = "researchopia-btn";
    
    container.appendChild(alert);
    container.appendChild(shareBtn);
    body.appendChild(container);

    shareBtn.addEventListener('click', async () => {
      try {
        this.showAlert(alert, '检测中...');
        
        if (!item) {
          this.showAlert(alert, ' 请选择文档');
          return;
        }
        
        let annotations = [];
        
        this.log(`检测项目类型: ${item.itemType}, ID: ${item.id}, 是否为附件: ${item.isAttachment()}, 是否为常规项目: ${item.isRegularItem()}`);
        
        // 方法1：如果当前项目是PDF附件，直接获取其标注
        if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
          this.log("检测到PDF附件，直接获取标注");
          if (typeof item.getAnnotations === 'function') {
            const annotationIDs = item.getAnnotations();
            this.log(`PDF附件标注ID数组: ${JSON.stringify(annotationIDs)}`);
            
            if (annotationIDs && annotationIDs.length > 0) {
              for (const annotID of annotationIDs) {
                const annotation = Zotero.Items.get(annotID);
                if (annotation && annotation.isAnnotation()) {
                  annotations.push(annotation);
                  this.log(`添加标注: ${annotation.id}, 类型: ${annotation.annotationType}`);
                }
              }
            }
          }
        }
        
        // 方法2：如果是常规项目，检查其所有PDF附件
        if (annotations.length === 0 && item.isRegularItem()) {
          this.log("检测常规项目的附件");
          const attachments = item.getAttachments();
          this.log(`找到 ${attachments ? attachments.length : 0} 个附件`);
          
          if (attachments && attachments.length > 0) {
            for (const attachmentID of attachments) {
              const attachment = Zotero.Items.get(attachmentID);
              this.log(`检查附件 ${attachmentID}: ${attachment ? attachment.attachmentContentType : 'null'}`);
              
              if (attachment && attachment.attachmentContentType === 'application/pdf' && typeof attachment.getAnnotations === 'function') {
                const attachmentAnnotationIDs = attachment.getAnnotations();
                this.log(`附件 ${attachmentID} 的标注ID: ${JSON.stringify(attachmentAnnotationIDs)}`);
                
                if (attachmentAnnotationIDs && attachmentAnnotationIDs.length > 0) {
                  for (const annotID of attachmentAnnotationIDs) {
                    const annotation = Zotero.Items.get(annotID);
                    if (annotation && annotation.isAnnotation()) {
                      annotations.push(annotation);
                      this.log(`从附件添加标注: ${annotation.id}, 类型: ${annotation.annotationType}`);
                    }
                  }
                }
              }
            }
          }
        }
        
        // 方法3：使用改进的 AnnotationSharing 模块
        if (annotations.length === 0 && Zotero.Researchopia.AnnotationSharing) {
          try {
            this.log("尝试使用 AnnotationSharing 模块");
            const docAnnotations = Zotero.Researchopia.AnnotationSharing.getDocumentAnnotationsImproved(item);
            if (docAnnotations && docAnnotations.length > 0) {
              annotations = docAnnotations;
              this.log(`AnnotationSharing 模块找到 ${annotations.length} 个标注`);
            }
          } catch (e) {
            this.log("Error using AnnotationSharing module: " + e);
          }
        }
        
        // 方法4：通过搜索所有标注项目来查找
        if (annotations.length === 0) {
          this.log("尝试通过搜索查找标注");
          try {
            const targetItemID = item.isAttachment() ? item.id : null;
            const parentItemID = item.isRegularItem() ? item.id : (item.parentItemID || null);
            
            const search = new Zotero.Search();
            search.addCondition('itemType', 'is', 'annotation');
            
            if (targetItemID) {
              search.addCondition('parentID', 'is', targetItemID);
            } else if (parentItemID) {
              // 搜索父项目下所有附件的标注
              const attachments = Zotero.Items.get(parentItemID).getAttachments();
              for (const attachmentID of attachments) {
                const attachment = Zotero.Items.get(attachmentID);
                if (attachment && attachment.attachmentContentType === 'application/pdf') {
                  const attachmentAnnotations = await this.searchAnnotationsByParent(attachmentID);
                  annotations.push(...attachmentAnnotations);
                }
              }
            }
            
            if (targetItemID && annotations.length === 0) {
              const searchResults = await search.search();
              for (const resultID of searchResults) {
                const annotation = Zotero.Items.get(resultID);
                if (annotation && annotation.isAnnotation()) {
                  annotations.push(annotation);
                  this.log(`通过搜索找到标注: ${annotation.id}`);
                }
              }
            }
          } catch (e) {
            this.log("搜索标注时出错: " + e);
          }
        }
        
        this.log(`最终检测到 ${annotations.length} 个标注`);
        
        if (annotations.length === 0) {
          this.showAlert(alert, ' 未检测到标注');
        } else {
          this.showAlert(alert, ` 检测到 ${annotations.length} 个标注`);
          
          // 如果有标注且AnnotationSharing模块可用，则启用分享功能
          if (Zotero.Researchopia.AnnotationSharing) {
            try {
              // 传递检测到的标注给分享模块
              const result = await Zotero.Researchopia.AnnotationSharing.shareAnnotations(annotations);
              return; // 由AnnotationSharing模块处理后续消息
            } catch (e) {
              this.log("Error sharing annotations: " + e);
              this.showAlert(alert, ' 分享失败: ' + e.message);
            }
          } else {
            this.showAlert(alert, ' 标注分享模块未加载');
          }
        }
        
      } catch (error) {
        this.log("检测标注时发生错误: " + error);
        this.showAlert(alert, ' 检测失败: ' + error.message);
      }
    });
  },

  async searchAnnotationsByParent(parentID) {
    try {
      const search = new Zotero.Search();
      search.addCondition('itemType', 'is', 'annotation');
      search.addCondition('parentID', 'is', parentID);
      
      const searchResults = await search.search();
      const annotations = [];
      
      for (const resultID of searchResults) {
        const annotation = Zotero.Items.get(resultID);
        if (annotation && annotation.isAnnotation()) {
          annotations.push(annotation);
        }
      }
      
      return annotations;
    } catch (e) {
      this.log("搜索父项目标注时出错: " + e);
      return [];
    }
  },

  showAlert(alertNode, msg) {
    if (!alertNode) return;
    if (!msg) {
      alertNode.style.display = 'none';
      alertNode.textContent = '';
    } else {
      alertNode.style.display = 'block';
      alertNode.textContent = msg;
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
  }
};
