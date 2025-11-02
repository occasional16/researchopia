# 环境切换使用指南

## 功能说明

Zotero插件现在支持在开发环境和生产环境之间便捷切换,无需手动修改代码。

## 使用方法

### 1. 打开偏好设置

在Zotero中:
- Windows/Linux: **编辑 → 设置 → Researchopia**
- macOS: **Zotero → 设置 → Researchopia**

### 2. 找到"开发者选项"部分

在偏好设置面板底部,可以看到 **🔧 开发者选项** 部分。

### 3. 快速切换环境

#### 方式一:使用复选框切换(推荐)

- ☑️ **勾选"使用开发环境 API"** → 切换到 `http://localhost:3000`
- ☐ **取消勾选** → 切换到生产环境 `https://www.researchopia.com`

切换后会立即显示成功提示,并更新当前使用的API地址显示。

#### 方式二:使用自定义API地址

1. 在"自定义 API 地址"输入框中输入你的API地址
2. 失焦(点击其他地方)后自动保存
3. 适用于测试其他服务器或特殊域名

#### 方式三:重置为默认

点击 **"重置为默认"** 按钮,会将API地址重置为生产环境。

## 技术实现

### 配置存储

环境配置保存在Zotero偏好设置中:
```
extensions.researchopia.apiBaseUrl
```

### 优先级

1. 自定义API地址(如果设置)
2. 开发环境复选框状态
3. 默认生产环境

### 代码读取

插件启动时,`env.ts` 会自动从Zotero Prefs读取设置:

```typescript
// src/config/env.ts
if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
  const customApiUrl = Zotero.Prefs.get('extensions.researchopia.apiBaseUrl');
  if (customApiUrl) {
    config.apiBaseUrl = customApiUrl as string;
  }
}
```

## 注意事项

1. **需要重启插件**:切换环境后,建议重新加载插件或重启Zotero以确保设置生效
2. **本地服务器**:使用开发环境前,请确保 `npm run dev` 已在本地运行
3. **网络访问**:切换到生产环境需要稳定的互联网连接
4. **安全性**:自定义API地址仅用于开发测试,不建议在生产使用中修改

## 开发工作流

### 日常开发
1. 勾选"使用开发环境 API"
2. 运行 `npm run dev` 启动本地服务器
3. 在Zotero中测试插件功能

### 准备发布
1. 取消勾选"使用开发环境 API"
2. 测试生产环境功能
3. 确认所有功能正常

### 测试特定环境
1. 使用"自定义 API 地址"输入测试服务器地址
2. 进行集成测试
3. 测试完成后点击"重置为默认"

## 示例场景

### 场景1:开发新功能
```
1. 勾选 [✓] 使用开发环境 API
2. 当前使用: http://localhost:3000 (橙色显示)
3. 开始开发...
```

### 场景2:测试生产环境
```
1. 取消勾选 [ ] 使用开发环境 API
2. 当前使用: https://www.researchopia.com (绿色显示)
3. 验证功能...
```

### 场景3:测试staging环境
```
1. 自定义 API 地址: https://staging.researchopia.com
2. 当前使用: https://staging.researchopia.com (绿色显示)
3. 集成测试...
4. 点击 [重置为默认] 恢复生产环境
```

## 相关文件

- `addon/content/preferences.xhtml` - 偏好设置UI
- `addon/content/preferences.js` - 环境切换逻辑
- `src/config/env.ts` - 环境配置读取
- `docs/Environment-Switching-Guide.md` - 本文档
