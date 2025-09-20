/*
  Zotero内嵌测试脚本
  直接在Zotero开发者控制台中运行，无需外部文件加载
*/

// 测试API连接
async function testApiConnection() {
  console.log("🔍 测试API连接...");
  
  const apiBase = 'http://localhost:3005/api/v1'; // 根据您的实际端口调整
  
  try {
    // 测试健康检查
    const healthResponse = await fetch(`${apiBase}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log("✅ 健康检查成功:", healthData);
    } else {
      console.log("❌ 健康检查失败:", healthResponse.status);
    }
    
    // 测试批量API
    const batchResponse = await fetch(`${apiBase}/annotations/batch`);
    if (batchResponse.ok) {
      const batchData = await batchResponse.json();
      console.log("✅ 批量API成功:", batchData);
    } else {
      console.log("❌ 批量API失败:", batchResponse.status);
    }
    
  } catch (error) {
    console.log("❌ API连接测试失败:", error.message);
  }
}

// 测试端口检测
async function testPortDetection() {
  console.log("🔍 测试端口检测...");
  
  const commonPorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];
  
  for (const port of commonPorts) {
    try {
      console.log(`尝试端口 ${port}...`);
      const response = await fetch(`http://localhost:${port}/api/port-detector`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ 检测到API服务器: ${data.apiUrl}`);
        return data.apiUrl;
      }
    } catch (e) {
      // 继续尝试下一个端口
      continue;
    }
  }
  
  console.log("❌ 未检测到API服务器");
  return null;
}

// 测试标注检测
async function testAnnotationDetection() {
  console.log("🔍 测试标注检测...");
  
  try {
    const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
    if (!selectedItems || selectedItems.length === 0) {
      console.log("❌ 请先选中一个包含PDF标注的项目");
      return;
    }
    
    const item = selectedItems[0];
    console.log(`📄 选中项目: ${item.itemType} (ID: ${item.id})`);
    
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
    
    if (annotations.length > 0) {
      // 显示标注详情
      for (let i = 0; i < Math.min(annotations.length, 3); i++) {
        const ann = annotations[i];
        const type = ann.annotationType || ann.getField?.('annotationType') || 'unknown';
        const text = (ann.annotationText || ann.getField?.('annotationText') || '').substring(0, 50);
        console.log(`标注 ${i+1}: ${type} - ${text}${text.length >= 50 ? '...' : ''}`);
      }
    }
    
    return annotations;
    
  } catch (error) {
    console.log("❌ 标注检测失败:", error.message);
    return [];
  }
}

// 测试插件分享功能
async function testPluginSharing() {
  console.log("🔍 测试插件分享功能...");
  
  try {
    if (!Zotero.Researchopia || !Zotero.Researchopia.AnnotationSharing) {
      console.log("❌ 插件未正确加载");
      return;
    }
    
    // 测试端口检测
    const detectedUrl = await Zotero.Researchopia.AnnotationSharing.detectApiPort();
    if (detectedUrl) {
      console.log(`✅ 插件检测到API: ${detectedUrl}`);
    } else {
      console.log("❌ 插件未检测到API");
    }
    
    // 测试服务器连接
    const isOnline = await Zotero.Researchopia.AnnotationSharing.checkServerConnection();
    if (isOnline) {
      console.log("✅ 插件连接服务器成功");
    } else {
      console.log("❌ 插件连接服务器失败");
    }
    
    // 测试标注检测
    const annotations = await testAnnotationDetection();
    if (annotations.length > 0) {
      console.log("✅ 标注检测成功");
      
      // 测试分享
      const shareResult = await Zotero.Researchopia.AnnotationSharing.shareAnnotations(annotations);
      if (shareResult.success) {
        console.log(`✅ 分享成功: ${shareResult.count} 个标注 (${shareResult.mode} 模式)`);
      } else {
        console.log(`❌ 分享失败: ${shareResult.error}`);
      }
    } else {
      console.log("❌ 未检测到标注");
    }
    
  } catch (error) {
    console.log("❌ 插件测试失败:", error.message);
  }
}

// 完整测试
async function runFullTest() {
  console.log("🚀 开始完整测试...");
  
  await testApiConnection();
  await testPortDetection();
  await testPluginSharing();
  
  console.log("🎉 测试完成！");
}

// 在控制台中运行以下函数：
console.log("Zotero内嵌测试脚本已加载。");
console.log("请运行以下函数：");
console.log("- testApiConnection() - 测试API连接");
console.log("- testPortDetection() - 测试端口检测");
console.log("- testAnnotationDetection() - 测试标注检测");
console.log("- testPluginSharing() - 测试插件分享功能");
console.log("- runFullTest() - 运行完整测试");
