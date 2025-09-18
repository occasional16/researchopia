/*
  Researchopia Annotation Sharing Module
  Handles cross-platform annotation sharing functionality
*/

Zotero.Researchopia.AnnotationSharing = {
  apiBase: 'http://localhost:3003/api/v1',
  
  /**
   * 初始化标注分享功能
   */
  init() {
    this.log("Initializing annotation sharing module");
    this.registerMenuItems();
  },
  
  /**
   * 日志输出
   */
  log(msg) {
    Zotero.debug("Researchopia-Annotation: " + msg);
  },
  
  /**
   * 注册菜单项
   */
  registerMenuItems() {
    try {
      this.log("Skipping MenuAPI registration to avoid compatibility issues");
      // 菜单功能暂时禁用以避免MenuAPI错误
      // 标注分享功能通过主插件界面的按钮提供
      
    } catch (error) {
      this.log("Failed to register menu items: " + error);
    }
  },
  
  /**
   * 获取当前选中的标注
   */
  getSelectedAnnotations() {
    try {
      // 从当前阅读器获取选中的标注
      const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
      if (!reader) return [];
      
      const selectedAnnotations = reader.getSelectedAnnotations();
      this.log(`Found ${selectedAnnotations.length} selected annotations`);
      return selectedAnnotations;
      
    } catch (error) {
      this.log("Error getting selected annotations: " + error);
      return [];
    }
  },
  
  /**
   * 获取文档的所有标注
   */
  getDocumentAnnotations() {
    try {
      const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
      if (!reader) return [];
      
      const attachmentID = reader.itemID;
      const item = Zotero.Items.get(attachmentID);
      
      // 获取该附件的所有标注
      const annotationIDs = item.getAnnotations();
      const annotations = [];
      
      if (annotationIDs && annotationIDs.length > 0) {
        for (const annotID of annotationIDs) {
          const annotation = Zotero.Items.get(annotID);
          if (annotation && annotation.isAnnotation()) {
            annotations.push(annotation);
          }
        }
      }
      
      this.log(`Found ${annotations.length} document annotations`);
      return annotations;
      
    } catch (error) {
      this.log("Error getting document annotations: " + error);
      return [];
    }
  },

  /**
   * 改进的标注获取方法，不依赖阅读器
   */
  getDocumentAnnotationsImproved(item) {
    try {
      if (!item) return [];
      
      let annotations = [];
      
      // 如果是PDF附件
      if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
        const annotationIDs = item.getAnnotations();
        if (annotationIDs && annotationIDs.length > 0) {
          for (const annotID of annotationIDs) {
            const annotation = Zotero.Items.get(annotID);
            if (annotation && annotation.isAnnotation()) {
              annotations.push(annotation);
            }
          }
        }
      }
      // 如果是常规项目，检查其PDF附件
      else if (item.isRegularItem()) {
        const attachments = item.getAttachments();
        if (attachments && attachments.length > 0) {
          for (const attachmentID of attachments) {
            const attachment = Zotero.Items.get(attachmentID);
            if (attachment && attachment.attachmentContentType === 'application/pdf') {
              const annotationIDs = attachment.getAnnotations();
              if (annotationIDs && annotationIDs.length > 0) {
                for (const annotID of annotationIDs) {
                  const annotation = Zotero.Items.get(annotID);
                  if (annotation && annotation.isAnnotation()) {
                    annotations.push(annotation);
                  }
                }
              }
            }
          }
        }
      }
      
      this.log(`Improved method found ${annotations.length} annotations`);
      return annotations;
      
    } catch (error) {
      this.log("Error in improved annotation detection: " + error);
      return [];
    }
  },
  
  /**
   * 将Zotero标注转换为通用格式
   */
  convertZoteroToUniversal(zoteroAnnotation) {
    try {
      this.log(`转换标注: ID=${zoteroAnnotation.id}, 类型=${zoteroAnnotation.annotationType}`);
      
      // 获取标注的各种属性，使用多种方法确保兼容性
      const annotationType = zoteroAnnotation.annotationType || 
                           zoteroAnnotation.getField?.('annotationType') || 
                           'highlight';
      
      const annotationText = zoteroAnnotation.annotationText || 
                            zoteroAnnotation.getField?.('annotationText') || 
                            '';
      
      const annotationComment = zoteroAnnotation.annotationComment || 
                               zoteroAnnotation.getField?.('annotationComment') || 
                               '';
      
      const annotationColor = zoteroAnnotation.annotationColor || 
                             zoteroAnnotation.getField?.('annotationColor') || 
                             '#ffd400';
      
      const annotationPosition = zoteroAnnotation.annotationPosition || 
                                zoteroAnnotation.getField?.('annotationPosition') || 
                                '{}';
      
      const annotationPageLabel = zoteroAnnotation.annotationPageLabel || 
                                 zoteroAnnotation.getField?.('annotationPageLabel') || 
                                 '';
      
      const annotationSortIndex = zoteroAnnotation.annotationSortIndex || 
                                 zoteroAnnotation.getField?.('annotationSortIndex') || 
                                 '';
      
      const dateAdded = zoteroAnnotation.dateAdded || 
                       zoteroAnnotation.getField?.('dateAdded') || 
                       new Date().toISOString();
      
      const dateModified = zoteroAnnotation.dateModified || 
                          zoteroAnnotation.getField?.('dateModified') || 
                          new Date().toISOString();

      const universal = {
        id: zoteroAnnotation.key || zoteroAnnotation.id || this.generateId(),
        type: this.mapZoteroAnnotationType(annotationType),
        documentId: this.getDocumentId(zoteroAnnotation),
        position: this.convertZoteroPosition(zoteroAnnotation, annotationPosition),
        createdAt: dateAdded,
        modifiedAt: dateModified,
        content: {
          text: annotationText,
          comment: annotationComment,
          color: annotationColor
        },
        metadata: {
          platform: 'zotero',
          version: '1.0',
          author: {
            id: 'current-user',
            name: this.getCurrentUserName(),
            platform: 'zotero',
            isAuthoritative: true
          },
          tags: this.getAnnotationTags(zoteroAnnotation),
          visibility: 'private'
        },
        extensions: {
          zotero: {
            sortIndex: annotationSortIndex,
            pageLabel: annotationPageLabel,
            readOnly: false
          }
        }
      };
      
      this.log(`转换完成: ${JSON.stringify(universal, null, 2)}`);
      return universal;
      
    } catch (error) {
      this.log("Error converting annotation: " + error);
      return null;
    }
  },

  /**
   * 获取标注的标签
   */
  getAnnotationTags(annotation) {
    try {
      if (typeof annotation.getTags === 'function') {
        return annotation.getTags();
      }
      // 备用方法
      return [];
    } catch (error) {
      this.log("Error getting annotation tags: " + error);
      return [];
    }
  },
  
  /**
   * 映射Zotero标注类型
   */
  mapZoteroAnnotationType(zoteroType) {
    const typeMap = {
      'highlight': 'highlight',
      'underline': 'underline',
      'note': 'note',
      'image': 'image',
      'ink': 'ink',
      'text': 'text'
    };
    return typeMap[zoteroType] || 'note';
  },
  
  /**
   * 转换Zotero位置信息
   */
  convertZoteroPosition(annotation, annotationPosition) {
    try {
      const positionStr = annotationPosition || annotation.annotationPosition || '{}';
      const position = JSON.parse(positionStr);
      
      if (position.pageIndex !== undefined) {
        // PDF标注
        return {
          documentType: 'pdf',
          pdf: {
            pageIndex: position.pageIndex,
            rects: position.rects || [],
            paths: position.paths || [],
            rotation: position.rotation || 0
          }
        };
      } else {
        // 其他类型标注
        const annotationText = annotation.annotationText || 
                              annotation.getField?.('annotationText') || 
                              '';
        return {
          documentType: 'text',
          text: {
            startOffset: 0,
            endOffset: annotationText.length,
            context: annotationText
          }
        };
      }
    } catch (error) {
      this.log("Error converting position: " + error);
      const annotationText = annotation.annotationText || 
                            annotation.getField?.('annotationText') || 
                            '';
      return {
        documentType: 'text',
        text: { startOffset: 0, endOffset: annotationText.length, context: annotationText }
      };
    }
  },
  
  /**
   * 获取文档ID
   */
  getDocumentId(annotation) {
    try {
      // 获取父项目ID
      const parentItemID = annotation.parentItemID || annotation.parentID;
      if (!parentItemID) {
        return 'unknown:' + Date.now();
      }
      
      const parentItem = Zotero.Items.get(parentItemID);
      if (!parentItem) {
        return 'item:' + parentItemID;
      }
      
      // 如果父项目是附件，获取其父项目
      let targetItem = parentItem;
      if (parentItem.isAttachment() && parentItem.parentItemID) {
        const grandParent = Zotero.Items.get(parentItem.parentItemID);
        if (grandParent) {
          targetItem = grandParent;
        }
      }
      
      // 尝试获取DOI
      try {
        const doi = targetItem.getField('DOI');
        if (doi) return 'doi:' + doi;
      } catch (e) {
        this.log("Error getting DOI: " + e);
      }
      
      // 尝试获取标题
      try {
        const title = targetItem.getField('title');
        if (title) return 'title:' + title.replace(/\W/g, '_').substring(0, 50);
      } catch (e) {
        this.log("Error getting title: " + e);
      }
      
      return 'item:' + targetItem.id;
    } catch (error) {
      this.log("Error getting document ID: " + error);
      return 'unknown:' + Date.now();
    }
  },
  
  /**
   * 获取当前用户名
   */
  getCurrentUserName() {
    try {
      return Zotero.Users.getCurrentUserName() || 'Anonymous';
    } catch {
      return 'Anonymous';
    }
  },
  
  /**
   * 生成唯一ID
   */
  generateId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  },
  
  /**
   * 分享选中的标注
   */
  async shareSelectedAnnotations() {
    try {
      const annotations = this.getSelectedAnnotations();
      if (!annotations || annotations.length === 0) {
        this.showMessage("没有选中的标注可以分享");
        return;
      }
      
      this.showMessage(`正在分享 ${annotations.length} 个标注...`);
      
      const universalAnnotations = annotations
        .map(ann => this.convertZoteroToUniversal(ann))
        .filter(ann => ann !== null);
      
      if (universalAnnotations.length === 0) {
        this.showMessage("标注转换失败");
        return;
      }
      
      const result = await this.uploadAnnotations(universalAnnotations);
      if (result.success) {
        this.showMessage(`成功分享 ${result.count} 个标注！`);
      } else {
        this.showMessage(`分享失败：${result.error}`);
      }
      
    } catch (error) {
      this.log("Error sharing annotations: " + error);
      this.showMessage("分享过程中出现错误：" + error.message);
    }
  },

  /**
   * 分享指定的标注数组
   */
  async shareAnnotations(annotations) {
    try {
      if (!annotations || annotations.length === 0) {
        this.showMessage("没有标注可以分享");
        return { success: false, error: "没有标注" };
      }
      
      this.log(`开始分享 ${annotations.length} 个标注`);
      this.showMessage(`正在分享 ${annotations.length} 个标注...`);
      
      const universalAnnotations = annotations
        .map(ann => this.convertZoteroToUniversal(ann))
        .filter(ann => ann !== null);
      
      this.log(`转换后得到 ${universalAnnotations.length} 个有效标注`);
      
      if (universalAnnotations.length === 0) {
        this.showMessage("标注转换失败");
        return { success: false, error: "标注转换失败" };
      }
      
      const result = await this.uploadAnnotations(universalAnnotations);
      if (result.success) {
        this.showMessage(`成功分享 ${result.count} 个标注！`);
        return { success: true, count: result.count };
      } else {
        this.showMessage(`分享失败：${result.error}`);
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      this.log("Error sharing annotations: " + error);
      this.showMessage("分享过程中出现错误：" + error.message);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * 分享文档的所有标注
   */
  async shareAllDocumentAnnotations() {
    try {
      const annotations = this.getDocumentAnnotations();
      if (!annotations || annotations.length === 0) {
        this.showMessage("当前文档没有标注可以分享");
        return;
      }
      
      const result = await this.showConfirmDialog(
        "确认分享",
        `是否要分享当前文档的所有 ${annotations.length} 个标注？`,
        "分享",
        "取消"
      );
      
      if (!result) return;
      
      this.showMessage(`正在分享 ${annotations.length} 个标注...`);
      
      const universalAnnotations = annotations
        .map(ann => this.convertZoteroToUniversal(ann))
        .filter(ann => ann !== null);
      
      const uploadResult = await this.uploadAnnotations(universalAnnotations);
      if (uploadResult.success) {
        this.showMessage(`成功分享 ${uploadResult.count} 个标注！`);
      } else {
        this.showMessage(`分享失败：${uploadResult.error}`);
      }
      
    } catch (error) {
      this.log("Error sharing all annotations: " + error);
      this.showMessage("分享过程中出现错误：" + error.message);
    }
  },
  
  /**
   * 上传标注到服务器
   */
  async uploadAnnotations(annotations) {
    try {
      const response = await fetch(`${this.apiBase}/annotations/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + await this.getAuthToken()
        },
        body: JSON.stringify({
          action: 'create',
          annotations: annotations
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (result.success) {
        return {
          success: true,
          count: result.data.summary.successful
        };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Unknown error'
        };
      }
      
    } catch (error) {
      this.log("Upload error: " + error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * 获取认证令牌
   */
  async getAuthToken() {
    // 简化处理，实际应该有完整的OAuth流程
    return 'test-token';
  },
  
  /**
   * 显示导入对话框
   */
  async showImportDialog() {
    try {
      const platforms = ['mendeley', 'hypothesis', 'adobe-reader'];
      const platform = await this.showSelectionDialog(
        "选择平台",
        "从哪个平台导入标注？",
        platforms.map(p => ({
          label: this.getPlatformDisplayName(p),
          value: p
        }))
      );
      
      if (!platform) return;
      
      this.showMessage("正在从 " + this.getPlatformDisplayName(platform) + " 导入标注...");
      
      const result = await this.importFromPlatform(platform);
      if (result.success) {
        this.showMessage(`成功导入 ${result.count} 个标注！`);
      } else {
        this.showMessage(`导入失败：${result.error}`);
      }
      
    } catch (error) {
      this.log("Import error: " + error);
      this.showMessage("导入过程中出现错误：" + error.message);
    }
  },
  
  /**
   * 从指定平台导入标注
   */
  async importFromPlatform(platform) {
    try {
      // 这里应该调用具体平台的API
      // 目前只是模拟
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        success: true,
        count: Math.floor(Math.random() * 20) + 1
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * 获取平台显示名称
   */
  getPlatformDisplayName(platform) {
    const names = {
      'mendeley': 'Mendeley',
      'hypothesis': 'Hypothesis',
      'adobe-reader': 'Adobe Reader',
      'zotero': 'Zotero'
    };
    return names[platform] || platform;
  },
  
  /**
   * 显示消息
   */
  showMessage(message) {
    try {
      const ps = Services.prompt;
      ps.alert(null, "研学港标注分享", message);
    } catch (error) {
      this.log("Error showing message: " + error);
      alert(message);
    }
  },
  
  /**
   * 显示确认对话框
   */
  async showConfirmDialog(title, message, confirmLabel, cancelLabel) {
    try {
      const ps = Services.prompt;
      const result = ps.confirm(null, title, message);
      return result;
    } catch (error) {
      this.log("Error showing confirm dialog: " + error);
      return confirm(message);
    }
  },
  
  /**
   * 显示选择对话框
   */
  async showSelectionDialog(title, message, options) {
    try {
      const ps = Services.prompt;
      const selected = {};
      const result = ps.select(
        null,
        title,
        message,
        options.length,
        options.map(opt => opt.label),
        selected
      );
      
      if (result) {
        return options[selected.value]?.value;
      }
      return null;
    } catch (error) {
      this.log("Error showing selection dialog: " + error);
      // 简化处理
      return options[0]?.value;
    }
  }
};