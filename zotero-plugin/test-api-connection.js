/*
  API连接测试脚本
  在Zotero开发者控制台中运行此脚本来测试API连接
*/

// 测试API连接
async function testApiConnection() {
  console.log("=== 开始测试API连接 ===");
  
  const apiBase = 'http://localhost:3000/api/v1';
  
  try {
    // 测试1: API根路径
    console.log("🔍 测试1: API根路径");
    try {
      const response = await fetch(`${apiBase}`);
      if (response.ok) {
        const data = await response.json();
        console.log("✅ API根路径连接成功:", data);
      } else {
        console.log("❌ API根路径连接失败:", response.status, response.statusText);
      }
    } catch (e) {
      console.log("❌ API根路径连接错误:", e.message);
    }
    
    // 测试2: Health检查
    console.log("🔍 测试2: Health检查");
    try {
      const response = await fetch(`${apiBase}/health`);
      if (response.ok) {
        const data = await response.json();
        console.log("✅ Health检查成功:", data);
      } else {
        console.log("❌ Health检查失败:", response.status, response.statusText);
      }
    } catch (e) {
      console.log("❌ Health检查错误:", e.message);
    }
    
    // 测试3: 标注批量操作
    console.log("🔍 测试3: 标注批量操作");
    try {
      const testAnnotation = {
        id: 'test-' + Date.now(),
        type: 'highlight',
        documentId: 'doc-test',
        position: { pageIndex: 1, rects: [] },
        content: {
          text: '测试标注文本',
          comment: '这是一个测试标注',
          color: '#ffd400'
        },
        metadata: {
          platform: 'zotero',
          author: {
            id: 'user-test',
            name: '测试用户',
            platform: 'zotero',
            isAuthoritative: true
          },
          visibility: 'private'
        },
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      };
      
      const response = await fetch(`${apiBase}/annotations/batch`, {
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
        const data = await response.json();
        console.log("✅ 标注批量操作成功:", data);
      } else {
        console.log("❌ 标注批量操作失败:", response.status, response.statusText);
        const errorText = await response.text();
        console.log("错误详情:", errorText);
      }
    } catch (e) {
      console.log("❌ 标注批量操作错误:", e.message);
    }
    
    // 测试4: 插件API连接
    console.log("🔍 测试4: 插件API连接");
    if (Zotero.Researchopia && Zotero.Researchopia.AnnotationSharing) {
      try {
        const isOnline = await Zotero.Researchopia.AnnotationSharing.checkServerConnection();
        if (isOnline) {
          console.log("✅ 插件API连接成功");
        } else {
          console.log("❌ 插件API连接失败");
        }
      } catch (e) {
        console.log("❌ 插件API连接错误:", e.message);
      }
    } else {
      console.log("❌ 插件AnnotationSharing模块未加载");
    }
    
  } catch (error) {
    console.log("❌ 测试过程中出错:", error);
  }
  
  console.log("=== API连接测试完成 ===");
}

// 测试网络配置
async function testNetworkConfig() {
  console.log("=== 开始测试网络配置 ===");
  
  try {
    // 检查插件配置
    if (Zotero.Researchopia && Zotero.Researchopia.AnnotationSharing) {
      const apiBase = Zotero.Researchopia.AnnotationSharing.getApiBase();
      console.log("📡 当前API地址:", apiBase);
      
      // 检查配置模块
      if (Zotero.Researchopia.Config) {
        const config = Zotero.Researchopia.Config.getApiConfig();
        console.log("⚙️ API配置:", config);
      } else {
        console.log("⚠️ 配置模块未加载");
      }
    } else {
      console.log("❌ 插件未正确加载");
    }
    
  } catch (error) {
    console.log("❌ 网络配置测试出错:", error);
  }
  
  console.log("=== 网络配置测试完成 ===");
}

// 完整测试
async function runFullTest() {
  console.log("🚀 开始完整测试...");
  
  await testNetworkConfig();
  await testApiConnection();
  
  console.log("🎉 完整测试完成！");
}

// 在控制台中运行: runFullTest()
console.log("API测试脚本已加载。请运行以下函数进行测试：");
console.log("- testApiConnection() - 测试API连接");
console.log("- testNetworkConfig() - 测试网络配置");
console.log("- runFullTest() - 运行完整测试");
