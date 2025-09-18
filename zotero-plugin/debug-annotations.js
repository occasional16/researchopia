/*
  调试脚本：用于测试标注检测功能
  在Zotero的开发者控制台中运行此脚本来调试标注检测问题
*/

// 调试函数：检测当前选中项目的标注
function debugAnnotationDetection() {
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
      if (typeof item.getAnnotations === 'function') {
        const annotationIDs = item.getAnnotations();
        console.log(`📝 找到标注ID: ${JSON.stringify(annotationIDs)}`);
        
        if (annotationIDs && annotationIDs.length > 0) {
          for (const annotID of annotationIDs) {
            const annotation = Zotero.Items.get(annotID);
            if (annotation && annotation.isAnnotation()) {
              totalAnnotations.push(annotation);
              console.log(`✅ 标注 ${annotID}: 类型=${annotation.annotationType}, 文本="${annotation.annotationText || annotation.getField('annotationText') || ''}"`);
            }
          }
        }
      } else {
        console.log("❌ item.getAnnotations 方法不存在");
      }
    }
    
    // 方法2：如果是常规项目，检查其PDF附件
    if (totalAnnotations.length === 0 && item.isRegularItem()) {
      console.log("🔍 方法2: 检测常规项目的PDF附件标注");
      const attachments = item.getAttachments();
      console.log(`📎 找到 ${attachments ? attachments.length : 0} 个附件`);
      
      if (attachments && attachments.length > 0) {
        for (const attachmentID of attachments) {
          const attachment = Zotero.Items.get(attachmentID);
          console.log(`📎 附件 ${attachmentID}: 类型=${attachment ? attachment.attachmentContentType : 'null'}`);
          
          if (attachment && attachment.attachmentContentType === 'application/pdf' && typeof attachment.getAnnotations === 'function') {
            const annotationIDs = attachment.getAnnotations();
            console.log(`📝 附件 ${attachmentID} 的标注ID: ${JSON.stringify(annotationIDs)}`);
            
            if (annotationIDs && annotationIDs.length > 0) {
              for (const annotID of annotationIDs) {
                const annotation = Zotero.Items.get(annotID);
                if (annotation && annotation.isAnnotation()) {
                  totalAnnotations.push(annotation);
                  console.log(`✅ 从附件添加标注 ${annotID}: 类型=${annotation.annotationType}, 文本="${annotation.annotationText || annotation.getField('annotationText') || ''}"`);
                }
              }
            }
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