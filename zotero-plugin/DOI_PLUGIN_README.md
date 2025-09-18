# 🦓 Researchopia Zotero Plugin - DOI Enhanced Version

## 🎯 核心功能

这个增强版的Zotero插件专门针对**有DOI号的学术论文**进行了优化，提供无缝的标注分享体验。

### ✨ 主要特性

1. **🔍 智能DOI识别**
   - 自动识别文献条目中的有效DOI
   - 支持多种DOI格式和来源
   - 智能清理和验证DOI格式

2. **📤 一键标注分享**
   - 检测DOI条目，优先使用DOI分享功能
   - 批量上传所有标注到研学港
   - 保持标注的完整性和格式

3. **🤝 跨平台协作**
   - 基于DOI的统一标识系统
   - 与Web平台实时同步
   - 支持多用户协作标注

## 🚀 快速开始

### 1. 环境准备

确保以下服务正在运行：
- ✅ Next.js开发服务器: `http://localhost:3003`
- ✅ WebSocket协作服务器: `ws://localhost:8080`

```bash
# 启动Next.js开发服务器
npm run dev

# 启动WebSocket服务器（新终端）
node websocket-server.js
```

### 2. 插件安装

1. 下载插件文件：`researchopia-zotero-plugin-v1.0.0.xpi`
2. 在Zotero中：工具 → 插件 → 从文件安装插件
3. 选择下载的.xpi文件并安装
4. 重启Zotero

### 3. 使用方法

#### DOI条目标注分享
1. 在Zotero中选择一个**有DOI的文献条目**
2. 在右侧面板找到"研学港 Researchopia"部分
3. 点击"分享标注"按钮
4. 插件会自动：
   - ✅ 检测DOI的有效性
   - ✅ 提取所有PDF标注
   - ✅ 转换为通用格式
   - ✅ 上传到服务器

#### 查看分享结果
- 插件会显示分享状态和结果
- 可以在Web界面查看分享的标注
- 支持实时协作和讨论

## 🔧 技术架构

### DOI处理流程
```javascript
// 1. DOI识别和验证
DOI检测 → 格式验证 → 标准化处理

// 2. 标注提取和转换
PDF标注提取 → 通用格式转换 → 元数据增强

// 3. 批量上传
API调用 → 服务器处理 → 状态反馈
```

### API端点
- `POST /api/v1/annotations/doi-batch` - DOI批量上传
- `GET /api/v1/annotations/doi-batch?doi=VALUE` - 按DOI查询
- `DELETE /api/v1/annotations/doi-batch` - 清理测试数据

### 数据格式
插件使用符合`UniversalAnnotation`协议的标准格式：

```typescript
interface UniversalAnnotation {
  id: string;
  type: AnnotationType;
  documentId: string;
  createdAt: string;
  modifiedAt: string;
  version: string;
  content: {
    text?: string;
    comment?: string;
    color?: string;
  };
  metadata: {
    platform: 'zotero';
    author: AuthorInfo;
    visibility: 'public';
    documentInfo: {
      doi: string;
      title: string;
    };
  };
}
```

## 🧪 测试验证

### API测试页面
访问 `http://localhost:3003/test/doi-api` 进行API功能测试：
- 📤 测试DOI批量上传
- 📥 测试DOI标注检索  
- 🗑️ 清理测试数据

### 插件调试
1. 打开Zotero的开发者工具
2. 查看控制台中的"Researchopia"日志
3. 验证API请求和响应

## ❗ 故障排除

### 常见问题

1. **"MenuAPI: Error: Option must have ['pluginID']"**
   - ✅ 已修复：添加了pluginID到菜单注册

2. **"分享失败:NetworkError when attempting to fetch resource"**
   - ✅ 已修复：更新API地址为本地服务器
   - 确保开发服务器正在运行

3. **"此条目没有有效的DOI"**
   - 检查条目的DOI字段是否填写
   - 确保DOI格式正确（以10.开头）

### 调试步骤
1. 检查开发服务器是否运行在3003端口
2. 验证WebSocket服务器是否在8080端口
3. 查看Zotero控制台的错误日志
4. 使用API测试页面验证后端功能

## 🔄 版本信息

**当前版本**: v1.0.0
**发布日期**: 2025-09-18
**兼容性**: Zotero 7.0+

### 更新日志
- ✅ 修复MenuAPI插件ID问题
- ✅ 更新API地址为本地开发环境
- ✅ 添加DOI智能识别和处理
- ✅ 实现批量标注上传功能
- ✅ 集成实时协作支持

## 🌟 下一步计划

1. **扩展支持的标识符类型**
   - ISBN、PMID等其他标识符
   - 自定义标识符支持

2. **增强用户体验**  
   - 分享进度指示器
   - 标注预览和选择
   - 批量操作优化

3. **协作功能增强**
   - 实时标注同步
   - 冲突解决机制
   - 版本历史追踪

---

🎉 **开始使用DOI增强版Zotero插件，体验智能标注分享的强大功能！**