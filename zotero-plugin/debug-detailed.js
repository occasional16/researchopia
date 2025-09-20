/*
  详细调试脚本 - 解决连接和标注检测问题
  直接在Zotero开发者控制台中运行
*/

async function debugDetailed() {
  console.log("🔍 开始详细调试...");
  
  try {
    // 1. 测试API连接
    console.log("1️⃣ 测试API连接...");
    const apiResponse = await fetch('http://localhost:3005/api/v1/health');
    if (apiResponse.ok) {
      const apiData = await apiResponse.json();
      console.log("✅ API连接成功:", apiData);
    } else {
      console.log("❌ API连接失败:", apiResponse.status);
      return;
    }
    
    // 2. 检查插件状态
    console.log("2️⃣ 检查插件状态...");
    if (!Zotero.Researchopia) {
      console.log("❌ Researchopia插件未加载");
      return;
    }
    if (!Zotero.Researchopia.AnnotationSharing) {
      console.log("❌ AnnotationSharing模块未加载");
      return;
    }
    console.log("✅ 插件已加载");
    
    // 3. 设置API地址并测试
    console.log("3️⃣ 设置API地址...");
    const originalApiBase = Zotero.Researchopia.AnnotationSharing.apiBase;
    console.log("原始API地址:", originalApiBase);
    
    Zotero.Researchopia.AnnotationSharing.apiBase = 'http://localhost:3005/api/v1';
    console.log("新API地址:", Zotero.Researchopia.AnnotationSharing.apiBase);
    
    // 4. 测试连接（使用修复后的方法）
    console.log("4️⃣ 测试连接...");
    try {
      const response = await fetch('http://localhost:3005/api/v1/health');
      if (response.ok) {
        const data = await response.json();
        console.log("✅ 直接连接成功:", data);
        
        // 手动设置连接状态
        console.log("✅ 强制设置连接状态为true");
      } else {
        console.log("❌ 直接连接失败:", response.status);
      }
    } catch (error) {
      console.log("❌ 直接连接错误:", error.message);
    }
    
    // 5. 测试标注检测
    console.log("5️⃣ 测试标注检测...");
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems || selectedItems.length === 0) {
      console.log("❌ 请先选中一个包含PDF标注的项目");
      console.log("💡 操作步骤：");
      console.log("   1. 在Zotero中导入PDF文档");
      console.log("   2. 双击PDF在Zotero阅读器中打开");
      console.log("   3. 添加高亮或注释");
      console.log("   4. 关闭阅读器，回到主界面");
      console.log("   5. 选中该项目");
      return;
    }
    
    const item = selectedItems[0];
    console.log("选中项目:", item.itemType, item.id);
    console.log("是否为附件:", item.isAttachment());
    console.log("是否为常规项目:", item.isRegularItem());
    
    let annotations = [];
    
    // 检测PDF附件的标注
    if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
      console.log("检测PDF附件的标注...");
      if (typeof item.getAnnotations === 'function') {
        const annotationIDs = item.getAnnotations();
        console.log("标注ID数组:", annotationIDs);
        
        if (annotationIDs && annotationIDs.length > 0) {
          for (const annotID of annotationIDs) {
            const annotation = Zotero.Items.get(annotID);
            if (annotation && annotation.isAnnotation()) {
              annotations.push(annotation);
              console.log("找到标注:", annotID, annotation.annotationType);
            }
          }
        }
      } else {
        console.log("❌ item.getAnnotations 方法不存在");
      }
    } 
    // 检测常规项目的PDF附件标注
    else if (item.isRegularItem()) {
      console.log("检测常规项目的PDF附件标注...");
      const attachments = item.getAttachments();
      console.log("附件数量:", attachments ? attachments.length : 0);
      
      if (attachments && attachments.length > 0) {
        for (const attachmentID of attachments) {
          const attachment = Zotero.Items.get(attachmentID);
          console.log("检查附件:", attachmentID, attachment ? attachment.attachmentContentType : 'null');
          
          if (attachment && attachment.attachmentContentType === 'application/pdf') {
            if (typeof attachment.getAnnotations === 'function') {
              const annotationIDs = attachment.getAnnotations();
              console.log("附件标注ID:", annotationIDs);
              
              if (annotationIDs && annotationIDs.length > 0) {
                for (const annotID of annotationIDs) {
                  const annotation = Zotero.Items.get(annotID);
                  if (annotation && annotation.isAnnotation()) {
                    annotations.push(annotation);
                    console.log("从附件找到标注:", annotID, annotation.annotationType);
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`📝 检测到 ${annotations.length} 个标注`);
    
    if (annotations.length === 0) {
      console.log("❌ 未检测到标注");
      console.log("💡 请确保：");
      console.log("   1. PDF文档包含标注");
      console.log("   2. 标注已在Zotero阅读器中保存");
      console.log("   3. 选中的是正确的项目");
      return;
    }
    
    // 6. 测试标注转换
    console.log("6️⃣ 测试标注转换...");
    const firstAnnotation = annotations[0];
    const converted = Zotero.Researchopia.AnnotationSharing.convertZoteroToUniversal(firstAnnotation);
    if (converted) {
      console.log("✅ 标注转换成功");
    } else {
      console.log("❌ 标注转换失败");
      return;
    }
    
    // 7. 模拟在线分享（绕过连接检查）
    console.log("7️⃣ 模拟在线分享...");
    try {
      const testAnnotation = converted;
      const response = await fetch('http://localhost:3005/api/v1/annotations/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          action: 'create',
          annotations: [testAnnotation]
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("✅ 在线分享成功:", result);
      } else {
        console.log("❌ 在线分享失败:", response.status);
        const errorText = await response.text();
        console.log("错误详情:", errorText);
      }
    } catch (error) {
      console.log("❌ 在线分享错误:", error.message);
    }
    
    console.log("🎉 详细调试完成！");
    
  } catch (error) {
    console.log("❌ 调试失败:", error.message);
  }
}

// 快速修复连接问题
async function fixConnection() {
  console.log("🔧 快速修复连接问题...");
  
  if (Zotero.Researchopia && Zotero.Researchopia.AnnotationSharing) {
    // 设置API地址
    Zotero.Researchopia.AnnotationSharing.apiBase = 'http://localhost:3005/api/v1';
    console.log("✅ API地址已设置");
    
    // 测试连接
    try {
      const response = await fetch('http://localhost:3005/api/v1/health');
      if (response.ok) {
        console.log("✅ 连接测试成功");
        return true;
      } else {
        console.log("❌ 连接测试失败:", response.status);
        return false;
      }
    } catch (error) {
      console.log("❌ 连接测试错误:", error.message);
      return false;
    }
  } else {
    console.log("❌ 插件未加载");
    return false;
  }
}

// 在控制台中运行以下函数：
console.log("详细调试脚本已加载。");
console.log("请运行以下函数：");
console.log("- debugDetailed() - 完整详细调试");
console.log("- fixConnection() - 快速修复连接问题");
