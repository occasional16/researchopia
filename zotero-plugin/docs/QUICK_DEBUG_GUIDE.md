# Zotero插件快速调试指南

## 问题分析

根据您的反馈：
1. ✅ API服务器运行正常 (http://localhost:3005/api/v1/annotations/batch)
2. ❌ 插件仍显示离线模式
3. ❌ 测试脚本路径错误

## 解决方案

### 步骤1：在Zotero控制台中直接运行测试

**不要使用外部文件加载**，直接在Zotero开发者控制台中复制粘贴以下代码：

```javascript
// 1. 测试API连接
async function testApi() {
  console.log("🔍 测试API连接...");
  try {
    const response = await fetch('http://localhost:3005/api/v1/health');
    if (response.ok) {
      const data = await response.json();
      console.log("✅ API连接成功:", data);
      return true;
    } else {
      console.log("❌ API连接失败:", response.status);
      return false;
    }
  } catch (error) {
    console.log("❌ API连接错误:", error.message);
    return false;
  }
}

// 2. 测试端口检测
async function testPortDetection() {
  console.log("🔍 测试端口检测...");
  const ports = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];
  
  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}/api/port-detector`, {
        signal: AbortSignal.timeout(1000)
      });
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ 检测到API服务器: ${data.apiUrl}`);
        return data.apiUrl;
      }
    } catch (e) {
      continue;
    }
  }
  console.log("❌ 未检测到API服务器");
  return null;
}

// 3. 测试插件功能
async function testPlugin() {
  console.log("🔍 测试插件功能...");
  
  if (!Zotero.Researchopia || !Zotero.Researchopia.AnnotationSharing) {
    console.log("❌ 插件未加载");
    return;
  }
  
  // 测试端口检测
  const detectedUrl = await Zotero.Researchopia.AnnotationSharing.detectApiPort();
  console.log("检测结果:", detectedUrl);
  
  // 测试连接
  const isOnline = await Zotero.Researchopia.AnnotationSharing.checkServerConnection();
  console.log("连接状态:", isOnline);
  
  // 检查当前API地址
  const currentApi = Zotero.Researchopia.AnnotationSharing.getApiBase();
  console.log("当前API地址:", currentApi);
}

// 4. 运行所有测试
async function runTests() {
  console.log("🚀 开始测试...");
  await testApi();
  await testPortDetection();
  await testPlugin();
  console.log("🎉 测试完成！");
}

// 运行测试
runTests();
```

### 步骤2：手动设置API地址

如果端口检测失败，可以手动设置：

```javascript
// 手动设置API地址
if (Zotero.Researchopia && Zotero.Researchopia.AnnotationSharing) {
  Zotero.Researchopia.AnnotationSharing.apiBase = 'http://localhost:3005/api/v1';
  console.log("✅ API地址已设置为: http://localhost:3005/api/v1");
  
  // 测试连接
  const isOnline = await Zotero.Researchopia.AnnotationSharing.checkServerConnection();
  console.log("连接测试结果:", isOnline);
}
```

### 步骤3：重新加载插件

如果插件没有正确更新，重新加载：

```javascript
// 重新加载插件
Zotero.Researchopia.removeFromAllWindows();
Services.scriptloader.loadSubScript("chrome://researchopia/content/researchopia.js");
Services.scriptloader.loadSubScript("chrome://researchopia/content/annotation-sharing.js");
Zotero.Researchopia.main();
console.log("✅ 插件已重新加载");
```

### 步骤4：测试分享功能

```javascript
// 测试分享功能
async function testSharing() {
  if (!Zotero.Researchopia || !Zotero.Researchopia.AnnotationSharing) {
    console.log("❌ 插件未加载");
    return;
  }
  
  // 获取选中的项目
  const selectedItems = Zotero.getActiveZoteroPane().getSelectedItems();
  if (!selectedItems || selectedItems.length === 0) {
    console.log("❌ 请先选中一个包含PDF标注的项目");
    return;
  }
  
  const item = selectedItems[0];
  console.log("选中项目:", item.itemType, item.id);
  
  // 检测标注
  let annotations = [];
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
  
  console.log("检测到标注数量:", annotations.length);
  
  if (annotations.length > 0) {
    // 测试分享
    const result = await Zotero.Researchopia.AnnotationSharing.shareAnnotations(annotations);
    console.log("分享结果:", result);
  }
}

// 运行分享测试
testSharing();
```

## 预期结果

运行测试后，您应该看到：
1. ✅ API连接成功
2. ✅ 检测到API服务器: http://localhost:3005/api/v1
3. ✅ 连接状态: true
4. ✅ 分享结果: {success: true, count: 3, mode: 'online'}

## 故障排除

如果仍然显示离线模式：
1. 检查控制台日志，查看端口检测过程
2. 手动设置API地址
3. 重新加载插件
4. 确认API服务器运行在正确端口

## 下一步

测试成功后，您可以：
1. 点击"分享标注"按钮
2. 应该看到"✅ 成功分享 X 个标注到服务器！"
3. 不再显示离线模式
