/*
  测试脚本：验证标注检测修复
  在Zotero开发者控制台中运行此脚本来测试修复后的功能
*/

// 测试函数：验证标注检测修复
async function testAnnotationFix() {
  console.log("=== 开始测试标注检测修复 ===");
  
  try {
    // 检查插件是否正确加载
    if (!Zotero.Researchopia) {
      console.log("❌ Researchopia插件未加载");
      return;
    }
    
    console.log("✅ Researchopia插件已加载");
    
    // 检查AnnotationSharing模块
    if (!Zotero.Researchopia.AnnotationSharing) {
      console.log("❌ AnnotationSharing模块未加载");
      return;
    }
    
    console.log("✅ AnnotationSharing模块已加载");
    
    // 测试网络连接
    console.log("🌐 测试网络连接...");
    try {
      const isOnline = await Zotero.Researchopia.AnnotationSharing.checkServerConnection();
      if (isOnline) {
        console.log("✅ 服务器在线，将使用在线模式");
      } else {
        console.log("⚠️ 服务器离线，将使用离线模式");
      }
    } catch (e) {
      console.log("⚠️ 网络测试失败，将使用离线模式:", e.message);
    }
    
    // 获取当前选中的项目
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems || selectedItems.length === 0) {
      console.log("❌ 请先选中一个包含PDF标注的项目");
      return;
    }
    
    const item = selectedItems[0];
    console.log(`📄 测试项目: ID=${item.id}, 类型=${item.itemType}`);
    
    // 测试改进的标注检测
    console.log("🔍 测试改进的标注检测方法...");
    
    let annotations = [];
    
    // 测试PDF附件检测
    if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
      console.log("测试PDF附件标注检测");
      
      // 方法1a: getAnnotations()
      if (typeof item.getAnnotations === 'function') {
        try {
          const annotationIDs = item.getAnnotations();
          console.log(`方法1a结果: ${annotationIDs.length} 个标注ID`);
          if (annotationIDs.length > 0) {
            annotations = annotationIDs.map(id => Zotero.Items.get(id)).filter(ann => ann && ann.isAnnotation());
          }
        } catch (e) {
          console.log(`方法1a失败: ${e.message}`);
        }
      }
      
      // 方法1b: getAnnotationsAsync()
      if (annotations.length === 0 && typeof item.getAnnotationsAsync === 'function') {
        try {
          const annotationIDs = await item.getAnnotationsAsync();
          console.log(`方法1b结果: ${annotationIDs.length} 个标注ID`);
          if (annotationIDs.length > 0) {
            annotations = annotationIDs.map(id => Zotero.Items.get(id)).filter(ann => ann && ann.isAnnotation());
          }
        } catch (e) {
          console.log(`方法1b失败: ${e.message}`);
        }
      }
      
      // 方法1c: 搜索
      if (annotations.length === 0) {
        try {
          const search = new Zotero.Search();
          search.addCondition('itemType', 'is', 'annotation');
          search.addCondition('parentID', 'is', item.id);
          const searchResults = await search.search();
          console.log(`方法1c结果: ${searchResults.length} 个搜索结果`);
          if (searchResults.length > 0) {
            annotations = searchResults.map(id => Zotero.Items.get(id)).filter(ann => ann && ann.isAnnotation());
          }
        } catch (e) {
          console.log(`方法1c失败: ${e.message}`);
        }
      }
    }
    
    // 测试常规项目检测
    if (annotations.length === 0 && item.isRegularItem()) {
      console.log("测试常规项目标注检测");
      const attachments = item.getAttachments();
      console.log(`找到 ${attachments.length} 个附件`);
      
      for (const attachmentID of attachments) {
        const attachment = Zotero.Items.get(attachmentID);
        if (attachment && attachment.attachmentContentType === 'application/pdf') {
          console.log(`检查PDF附件: ${attachmentID}`);
          
          // 尝试多种方法
          let attachmentAnnotations = [];
          
          if (typeof attachment.getAnnotations === 'function') {
            try {
              const annotationIDs = attachment.getAnnotations();
              if (annotationIDs.length > 0) {
                attachmentAnnotations = annotationIDs.map(id => Zotero.Items.get(id)).filter(ann => ann && ann.isAnnotation());
                console.log(`附件 ${attachmentID} 找到 ${attachmentAnnotations.length} 个标注`);
              }
            } catch (e) {
              console.log(`附件 ${attachmentID} getAnnotations失败: ${e.message}`);
            }
          }
          
          if (attachmentAnnotations.length === 0 && typeof attachment.getAnnotationsAsync === 'function') {
            try {
              const annotationIDs = await attachment.getAnnotationsAsync();
              if (annotationIDs.length > 0) {
                attachmentAnnotations = annotationIDs.map(id => Zotero.Items.get(id)).filter(ann => ann && ann.isAnnotation());
                console.log(`附件 ${attachmentID} 异步找到 ${attachmentAnnotations.length} 个标注`);
              }
            } catch (e) {
              console.log(`附件 ${attachmentID} getAnnotationsAsync失败: ${e.message}`);
            }
          }
          
          annotations.push(...attachmentAnnotations);
        }
      }
    }
    
    console.log(`🎯 总计检测到 ${annotations.length} 个标注`);
    
    if (annotations.length > 0) {
      console.log("✅ 标注检测修复成功！");
      
      // 显示标注详情
      for (let i = 0; i < Math.min(annotations.length, 3); i++) {
        const ann = annotations[i];
        const type = ann.annotationType || ann.getField?.('annotationType') || 'unknown';
        const text = (ann.annotationText || ann.getField?.('annotationText') || '').substring(0, 50);
        console.log(`标注 ${i+1}: ${type} - ${text}${text.length >= 50 ? '...' : ''}`);
      }
      
      // 测试标注转换
      if (Zotero.Researchopia.AnnotationSharing) {
        console.log("🔄 测试标注转换...");
        try {
          const converted = Zotero.Researchopia.AnnotationSharing.convertZoteroToUniversal(annotations[0]);
          console.log("✅ 标注转换成功:", converted);
        } catch (e) {
          console.log("❌ 标注转换失败:", e.message);
        }
        
        // 测试分享功能
        console.log("📤 测试分享功能...");
        try {
          const shareResult = await Zotero.Researchopia.AnnotationSharing.shareAnnotations(annotations);
          if (shareResult.success) {
            if (shareResult.mode === 'offline') {
              console.log(`✅ 离线模式分享成功: ${shareResult.count} 个标注`);
            } else {
              console.log(`✅ 在线模式分享成功: ${shareResult.count} 个标注`);
            }
          } else {
            console.log(`❌ 分享失败: ${shareResult.error}`);
          }
        } catch (e) {
          console.log("❌ 分享测试失败:", e.message);
        }
      }
    } else {
      console.log("❌ 未检测到标注，请检查:");
      console.log("1. PDF文档是否包含标注");
      console.log("2. 标注是否已保存到Zotero");
      console.log("3. 选中的项目是否正确");
    }
    
  } catch (error) {
    console.log("❌ 测试过程中出错:", error);
  }
  
  console.log("=== 测试完成 ===");
}

// 在控制台中运行: testAnnotationFix()
console.log("测试脚本已加载。请在选中包含标注的PDF项目后，运行 testAnnotationFix() 函数。");

