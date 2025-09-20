/*
  Zotero简化测试脚本
  在Zotero开发者控制台中运行此脚本进行快速测试
*/

// 简化测试函数
async function testZoteroPlugin() {
  console.log("🚀 开始Zotero插件测试...");
  
  try {
    // 1. 检查插件状态
    console.log("1️⃣ 检查插件状态...");
    if (!Zotero.Researchopia) {
      throw new Error("❌ Researchopia插件未加载");
    }
    if (!Zotero.Researchopia.AnnotationSharing) {
      throw new Error("❌ AnnotationSharing模块未加载");
    }
    console.log("✅ 插件加载正常");
    
    // 2. 检查选中项目
    console.log("2️⃣ 检查选中项目...");
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems || selectedItems.length === 0) {
      console.log("⚠️ 请先选中一个包含PDF标注的项目");
      console.log("💡 操作步骤：");
      console.log("   1. 在Zotero中导入PDF文档");
      console.log("   2. 在Zotero阅读器中添加标注");
      console.log("   3. 回到主界面选中该项目");
      return;
    }
    
    const item = selectedItems[0];
    console.log(`📄 选中项目: ${item.itemType} (ID: ${item.id})`);
    
    // 3. 测试网络连接
    console.log("3️⃣ 测试网络连接...");
    const isOnline = await Zotero.Researchopia.AnnotationSharing.checkServerConnection();
    if (isOnline) {
      console.log("✅ 服务器在线，将使用在线模式");
    } else {
      console.log("⚠️ 服务器离线，将使用离线模式");
    }
    
    // 4. 测试标注检测
    console.log("4️⃣ 测试标注检测...");
    let annotations = [];
    
    if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
      console.log("检测PDF附件的标注...");
      if (typeof item.getAnnotations === 'function') {
        const annotationIDs = item.getAnnotations();
        console.log(`找到 ${annotationIDs ? annotationIDs.length : 0} 个标注ID`);
        
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
      console.log("检测常规项目的PDF附件标注...");
      const attachments = item.getAttachments();
      console.log(`找到 ${attachments ? attachments.length : 0} 个附件`);
      
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
      console.log("⚠️ 未检测到标注");
      console.log("💡 请确保：");
      console.log("   1. PDF文档包含标注");
      console.log("   2. 标注已在Zotero阅读器中保存");
      console.log("   3. 选中的是正确的项目");
      return;
    }
    
    // 5. 测试分享功能
    console.log("5️⃣ 测试分享功能...");
    const shareResult = await Zotero.Researchopia.AnnotationSharing.shareAnnotations(annotations);
    
    if (shareResult.success) {
      if (shareResult.mode === 'offline') {
        console.log(`✅ 离线模式分享成功: ${shareResult.count} 个标注`);
        console.log("💡 提示：启动后端服务器 (npm run dev) 可使用在线模式");
      } else {
        console.log(`✅ 在线模式分享成功: ${shareResult.count} 个标注`);
      }
    } else {
      console.log(`❌ 分享失败: ${shareResult.error}`);
    }
    
    console.log("🎉 测试完成！");
    
  } catch (error) {
    console.log("❌ 测试失败:", error.message);
    console.log("💡 请检查：");
    console.log("   1. 插件是否正确安装");
    console.log("   2. 是否选中了包含标注的项目");
    console.log("   3. 开发者控制台是否有其他错误");
  }
}

// 端口检测测试
async function testPortDetection() {
  console.log("🔍 测试端口检测...");
  
  try {
    const detectedUrl = await Zotero.Researchopia.AnnotationSharing.detectApiPort();
    if (detectedUrl) {
      console.log(`✅ 检测到API服务器: ${detectedUrl}`);
    } else {
      console.log("❌ 未检测到API服务器");
      console.log("💡 请启动后端服务器: npm run dev");
    }
  } catch (error) {
    console.log("❌ 端口检测失败:", error.message);
  }
}

// 在控制台中运行: testZoteroPlugin()
console.log("Zotero测试脚本已加载。");
console.log("请运行以下函数：");
console.log("- testZoteroPlugin() - 完整测试");
console.log("- testPortDetection() - 端口检测测试");
