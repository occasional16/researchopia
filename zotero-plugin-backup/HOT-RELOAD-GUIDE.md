# 🚀 Researchopia 插件自动热重载指南

## 📋 前置要求

1. **安装 Node.js**
   - 下载并安装 Node.js LTS 版本：https://nodejs.org/
   - 验证安装：在命令行运行 `node --version` 和 `npm --version`

2. **Zotero 8 Beta**
   - 确保您已安装 Zotero 8 Beta 版本
   - 创建一个专门的开发配置文件（推荐）

## 🛠️ 设置步骤

### 第一步：安装依赖
```bash
# 在 zotero-plugin 目录下运行
npm install
```

### 第二步：配置Zotero路径
1. 复制 `.env.example` 为 `.env`
2. 修改 `.env` 文件中的路径为您的实际路径：
   ```
   ZOTERO_PATH=D:\Program Files\Zotero\zotero.exe
   ZOTERO_PROFILE_PATH=C:\Users\YourUsername\AppData\Roaming\Zotero\Zotero\Profiles\your-dev-profile
   ```

### 第三步：启动自动热重载
```bash
npm start
```

## 🎯 工作流程

1. **启动监视器**：运行 `npm start`
2. **自动构建**：修改源文件后自动重新构建
3. **自动安装**：构建完成后自动安装到Zotero
4. **手动重载**：在Zotero中按 `Ctrl+Shift+Alt+R` 重新加载插件

## 📁 监视的文件

- `manifest-new.json` - 插件配置文件
- `bootstrap-new.js` - 插件启动文件
- `icons/` - 图标文件夹
- `modules/` - 功能模块文件夹
- `styles/` - 样式文件夹
- `content/` - 内容文件夹

## 🔧 手动命令

- `npm run build` - 仅构建插件
- `npm run watch` - 启动文件监视器
- `npm start` - 启动自动热重载（推荐）

## 💡 开发技巧

1. **创建开发配置文件**
   - 启动Zotero时使用 `zotero.exe -p` 参数
   - 创建专门的开发配置文件，避免影响正常使用

2. **调试方法**
   - 使用 `console.log()` 输出调试信息
   - 在Zotero中打开开发者工具：Help > Developer > Error Console
   - 查看错误日志：Help > Debug Output Logging

3. **快速重载**
   - 修改文件后，在Zotero中按 `Ctrl+Shift+Alt+R`
   - 或者重启Zotero（更彻底的重载）

## ⚠️ 注意事项

- 确保Zotero路径配置正确
- 开发时建议使用独立的配置文件
- 修改manifest.json后需要重启Zotero
- 保持文件监视器运行状态

## 🐛 常见问题

**Q: 文件监视器无法启动？**
A: 检查Node.js是否正确安装，运行 `npm install` 安装依赖

**Q: 插件无法安装到Zotero？**
A: 检查Zotero配置文件路径是否正确，确保有写入权限

**Q: 修改文件后插件没有更新？**
A: 检查文件是否在监视列表中，手动重启Zotero试试

**Q: Zotero无法加载插件？**
A: 检查manifest.json格式是否正确，查看Zotero错误控制台
