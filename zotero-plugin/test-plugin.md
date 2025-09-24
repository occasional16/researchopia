# Researchopia 插件测试指南

## 构建状态 ✅

插件已成功构建，所有TypeScript错误已解决。

## 构建产物

- **XPI文件**: `.scaffold/build/researchopia.xpi`
- **版本**: 0.1.96
- **插件ID**: `researchopia@zotero.plugin`

## 测试清单

### 1. 基础功能测试

#### ✅ 构建测试
- [x] TypeScript编译无错误
- [x] 插件打包成功
- [x] manifest.json正确生成
- [x] 本地化文件正确处理

#### 📋 安装测试（需要在Zotero中测试）
- [ ] 插件可以正常安装
- [ ] 插件在Zotero启动时正确加载
- [ ] 没有JavaScript错误

### 2. 偏好设置测试

#### 📋 偏好设置面板
- [ ] 在Zotero偏好设置中能看到"Researchopia"选项
- [ ] 偏好设置面板能正常打开
- [ ] 偏好设置界面显示正常
- [ ] JavaScript脚本正确执行

#### 预期显示内容：
- 研学港 (Researchopia) 标题
- 账户设置区域
- 同步设置区域
- 显示设置区域
- 社交功能设置区域
- 高级设置区域

### 3. Item Pane测试

#### 📋 Item Pane显示
- [ ] 在文献项目右侧面板能看到"Researchopia"部分
- [ ] 图标正确显示
- [ ] 点击后能展开/收起

#### 📋 内容渲染
- [ ] 未选择文献时显示提示信息
- [ ] 选择文献后显示文献信息
- [ ] 显示插件状态信息
- [ ] 显示即将推出的功能列表

#### 预期显示内容：
- 📝 Researchopia 标题
- 📄 文献信息（标题、作者、DOI等）
- 🔄 插件状态（加载状态）
- 🚧 即将推出的功能列表

### 4. 错误处理测试

#### 📋 异常情况
- [ ] 插件加载失败时的错误处理
- [ ] 偏好设置加载失败时的处理
- [ ] Item Pane渲染失败时的处理

## 安装说明

1. 打开Zotero
2. 进入 工具 > 插件
3. 点击齿轮图标 > Install Add-on From File
4. 选择 `zotero-plugin/.scaffold/build/researchopia.xpi`
5. 重启Zotero

## 验证步骤

### 偏好设置验证
1. 打开 编辑 > 偏好设置
2. 查看是否有"Researchopia"选项卡
3. 点击进入，检查界面是否正常显示

### Item Pane验证
1. 在Zotero库中选择任意文献项目
2. 查看右侧面板是否有"Researchopia"部分
3. 点击展开，检查内容是否正确显示

## 已知问题

- 协作功能尚未实现（显示为"功能开发中"）
- 需要实际的Zotero环境进行完整测试

## 技术细节

### 架构改进
- 移除了复杂的管理器类
- 采用Factory模式组织代码
- 简化了插件初始化流程
- 使用官方模板的最佳实践

### 文件结构
```
.scaffold/build/addon/
├── bootstrap.js              # 插件启动脚本
├── manifest.json            # 插件清单
├── content/
│   ├── preferences.xhtml    # 偏好设置界面
│   ├── scripts/
│   │   ├── researchopia.js  # 主脚本（TypeScript编译后）
│   │   └── preferences.js   # 偏好设置脚本
│   ├── icons/              # 图标文件
│   └── *.css              # 样式文件
└── locale/                # 本地化文件
    ├── zh-CN/
    └── en-US/
```

## 下一步

1. 在实际Zotero环境中测试插件
2. 验证偏好设置和Item Pane功能
3. 根据测试结果进行必要的修复
4. 开始实现核心协作功能
