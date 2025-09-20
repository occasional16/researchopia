/*
  调试脚本：用于测试标注检测功能
  在Zotero的开发者控制台中运行此脚本来调试标注检测问题
*/

// 调试函数：检测当前选中项目的标注
async function debugAnnotationDetection() {
  console.log("=== 开始调试标注检测 ===");
  
  try {
    // 获取当前选中的项目
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems || selectedItems.length === 0) {
      console.log("❌ 没有选中任何项目");
      return;
    }
    
    const item = selectedItems[0];
    console.log(`📄 选中项目: ID=${item.id}, 类型=${item.itemType}`);
    console.log(`📄 是否为附件: ${item.isAttachment()}`);
    console.log(`📄 是否为常规项目: ${item.isRegularItem()}`);
    
    if (item.isAttachment()) {
      console.log(`📄 附件类型: ${item.attachmentContentType}`);
    }
    
    let totalAnnotations = [];
    
    // 方法1：直接从当前项目获取标注
    if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
      console.log("🔍 方法1: 检测PDF附件的标注");
      
      let annotationIDs = [];
      
      // 方法1a: 使用getAnnotations()
      if (typeof item.getAnnotations === 'function') {
        try {
          annotationIDs = item.getAnnotations();
          console.log(`📝 方法1a - getAnnotations() 结果: ${JSON.stringify(annotationIDs)}`);
        } catch (e) {
          console.log(`❌ 方法1a 失败: ${e.message}`);
        }
      }
      
      // 方法1b: 使用getAnnotationsAsync() (Zotero 8+)
      if (annotationIDs.length === 0 && typeof item.getAnnotationsAsync === 'function') {
        try {
          annotationIDs = await item.getAnnotationsAsync();
          console.log(`📝 方法1b - getAnnotationsAsync() 结果: ${JSON.stringify(annotationIDs)}`);
        } catch (e) {
          console.log(`❌ 方法1b 失败: ${e.message}`);
        }
      }
      
      // 方法1c: 通过搜索获取
      if (annotationIDs.length === 0) {
        try {
          const search = new Zotero.Search();
          search.addCondition('itemType', 'is', 'annotation');
          search.addCondition('parentID', 'is', item.id);
          const searchResults = await search.search();
          annotationIDs = searchResults;
          console.log(`📝 方法1c - 搜索结果: ${JSON.stringify(annotationIDs)}`);
        } catch (e) {
          console.log(`❌ 方法1c 失败: ${e.message}`);
        }
      }
      
      if (annotationIDs && annotationIDs.length > 0) {
        for (const annotID of annotationIDs) {
          try {
            const annotation = Zotero.Items.get(annotID);
            if (annotation && annotation.isAnnotation()) {
              totalAnnotations.push(annotation);
              console.log(`✅ 标注 ${annotID}: 类型=${annotation.annotationType || annotation.getField?.('annotationType') || 'unknown'}, 文本="${annotation.annotationText || annotation.getField?.('annotationText') || ''}"`);
            }
          } catch (e) {
            console.log(`❌ 获取标注 ${annotID} 失败: ${e.message}`);
          }
        }
      } else {
        console.log("❌ PDF附件中没有找到标注ID");
      }
    }
    
    // 方法2：如果是常规项目，检查其PDF附件
    if (totalAnnotations.length === 0 && item.isRegularItem()) {
      console.log("🔍 方法2: 检测常规项目的PDF附件标注");
      const attachments = item.getAttachments();
      console.log(`📎 找到 ${attachments ? attachments.length : 0} 个附件`);
      
      if (attachments && attachments.length > 0) {
        for (const attachmentID of attachments) {
          try {
            const attachment = Zotero.Items.get(attachmentID);
            console.log(`📎 附件 ${attachmentID}: 类型=${attachment ? attachment.attachmentContentType : 'null'}`);
            
            if (attachment && attachment.attachmentContentType === 'application/pdf') {
              let attachmentAnnotationIDs = [];
              
              // 尝试多种方法获取附件的标注
              if (typeof attachment.getAnnotations === 'function') {
                try {
                  attachmentAnnotationIDs = attachment.getAnnotations();
                  console.log(`📝 附件 ${attachmentID} getAnnotations() 结果: ${JSON.stringify(attachmentAnnotationIDs)}`);
                } catch (e) {
                  console.log(`❌ 附件 ${attachmentID} getAnnotations() 失败: ${e.message}`);
                }
              }
              
              if (attachmentAnnotationIDs.length === 0 && typeof attachment.getAnnotationsAsync === 'function') {
                try {
                  attachmentAnnotationIDs = await attachment.getAnnotationsAsync();
                  console.log(`📝 附件 ${attachmentID} getAnnotationsAsync() 结果: ${JSON.stringify(attachmentAnnotationIDs)}`);
                } catch (e) {
                  console.log(`❌ 附件 ${attachmentID} getAnnotationsAsync() 失败: ${e.message}`);
                }
              }
              
              if (attachmentAnnotationIDs.length === 0) {
                try {
                  const search = new Zotero.Search();
                  search.addCondition('itemType', 'is', 'annotation');
                  search.addCondition('parentID', 'is', attachmentID);
                  const searchResults = await search.search();
                  attachmentAnnotationIDs = searchResults;
                  console.log(`📝 附件 ${attachmentID} 搜索结果: ${JSON.stringify(attachmentAnnotationIDs)}`);
                } catch (e) {
                  console.log(`❌ 附件 ${attachmentID} 搜索失败: ${e.message}`);
                }
              }
              
              if (attachmentAnnotationIDs && attachmentAnnotationIDs.length > 0) {
                for (const annotID of attachmentAnnotationIDs) {
                  try {
                    const annotation = Zotero.Items.get(annotID);
                    if (annotation && annotation.isAnnotation()) {
                      totalAnnotations.push(annotation);
                      console.log(`✅ 从附件添加标注 ${annotID}: 类型=${annotation.annotationType || annotation.getField?.('annotationType') || 'unknown'}, 文本="${annotation.annotationText || annotation.getField?.('annotationText') || ''}"`);
                    }
                  } catch (e) {
                    console.log(`❌ 获取附件标注 ${annotID} 失败: ${e.message}`);
                  }
                }
              }
            }
          } catch (e) {
            console.log(`❌ 处理附件 ${attachmentID} 时出错: ${e.message}`);
          }
        }
      }
    }
    
    // 方法3：通过搜索查找标注
    if (totalAnnotations.length === 0) {
      console.log("🔍 方法3: 通过搜索查找标注");
      try {
        const targetItemID = item.isAttachment() ? item.id : null;
        const parentItemID = item.isRegularItem() ? item.id : (item.parentItemID || null);
        
        if (targetItemID) {
          const search = new Zotero.Search();
          search.addCondition('itemType', 'is', 'annotation');
          search.addCondition('parentID', 'is', targetItemID);
          
          const searchResults = await search.search();
          console.log(`🔍 搜索结果: ${searchResults.length} 个标注`);
          
          for (const resultID of searchResults) {
            const annotation = Zotero.Items.get(resultID);
            if (annotation && annotation.isAnnotation()) {
              totalAnnotations.push(annotation);
              console.log(`✅ 通过搜索找到标注 ${resultID}: 类型=${annotation.annotationType}`);
            }
          }
        }
      } catch (e) {
        console.log("❌ 搜索标注时出错: " + e);
      }
    }
    
    console.log(`🎯 总计检测到 ${totalAnnotations.length} 个标注`);
    
    // 测试标注转换
    if (totalAnnotations.length > 0 && Zotero.Researchopia && Zotero.Researchopia.AnnotationSharing) {
      console.log("🔄 测试标注转换...");
      const firstAnnotation = totalAnnotations[0];
      const converted = Zotero.Researchopia.AnnotationSharing.convertZoteroToUniversal(firstAnnotation);
      console.log("✅ 转换结果:", converted);
    }
    
  } catch (error) {
    console.log("❌ 调试过程中出错:", error);
  }
  
  console.log("=== 调试完成 ===");
}

// 在控制台中运行: debugAnnotationDetection()
console.log("调试脚本已加载。请在选中包含标注的PDF项目后，运行 debugAnnotationDetection() 函数。");