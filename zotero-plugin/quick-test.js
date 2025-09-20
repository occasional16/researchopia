/*
  快速测试脚本 - 验证整个系统是否正常工作
  在Zotero开发者控制台中运行此脚本
*/

async function quickTest() {
  console.log("🚀 开始快速测试...");
  
  try {
    // 1. 检查插件加载
    console.log("1️⃣ 检查插件加载...");
    if (!Zotero.Researchopia) {
      throw new Error("Researchopia插件未加载");
    }
    if (!Zotero.Researchopia.AnnotationSharing) {
      throw new Error("AnnotationSharing模块未加载");
    }
    console.log("✅ 插件加载正常");
    
    // 2. 检查网络连接
    console.log("2️⃣ 检查网络连接...");
    const isOnline = await Zotero.Researchopia.AnnotationSharing.checkServerConnection();
    if (isOnline) {
      console.log("✅ 服务器在线，将使用在线模式");
    } else {
      console.log("⚠️ 服务器离线，将使用离线模式");
    }
    
    // 3. 检查选中项目
    console.log("3️⃣ 检查选中项目...");
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems || selectedItems.length === 0) {
      console.log("⚠️ 请先选中一个包含PDF标注的项目");
      return;
    }
    
    const item = selectedItems[0];
    console.log(`📄 选中项目: ${item.itemType} (ID: ${item.id})`);
    
    // 4. 测试标注检测
    console.log("4️⃣ 测试标注检测...");
    let annotations = [];
    
    if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
      // 检测PDF附件的标注
      if (typeof item.getAnnotations === 'function') {
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
    } else if (item.isRegularItem()) {
      // 检测常规项目的PDF附件标注
      const attachments = item.getAttachments();
      if (attachments && attachments.length > 0) {
        for (const attachmentID of attachments) {
          const attachment = Zotero.Items.get(attachmentID);
          if (attachment && attachment.attachmentContentType === 'application/pdf') {
            if (typeof attachment.getAnnotations === 'function') {
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
    }
    
    console.log(`📝 检测到 ${annotations.length} 个标注`);
    
    if (annotations.length === 0) {
      console.log("⚠️ 未检测到标注，请确保PDF文档包含标注");
      return;
    }
    
    // 5. 测试标注转换
    console.log("5️⃣ 测试标注转换...");
    const firstAnnotation = annotations[0];
    const converted = Zotero.Researchopia.AnnotationSharing.convertZoteroToUniversal(firstAnnotation);
    if (converted) {
      console.log("✅ 标注转换成功");
    } else {
      console.log("❌ 标注转换失败");
      return;
    }
    
    // 6. 测试分享功能
    console.log("6️⃣ 测试分享功能...");
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
    
    console.log("🎉 快速测试完成！所有功能正常");
    
  } catch (error) {
    console.log("❌ 测试失败:", error.message);
    console.log("请检查:");
    console.log("1. 插件是否正确安装和加载");
    console.log("2. 后端服务器是否运行 (npm run dev)");
    console.log("3. 是否选中了包含标注的PDF项目");
  }
}

// 在控制台中运行: quickTest()
console.log("快速测试脚本已加载。请运行 quickTest() 进行测试。");
