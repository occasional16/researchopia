# 手动构建指南

## 图标显示问题的解决方案

### 问题分析
您发现的问题很重要：
- 自动构建的XPI文件：36,864 字节 - 图标不显示
- 手动压缩的XPI文件：356,352 字节 - 图标正常显示

这说明PowerShell的`Compress-Archive`使用了过高的压缩率，可能导致某些文件（特别是SVG图标）被过度压缩，影响Zotero的解析。

### 手动构建步骤（推荐）

#### 方法1：使用Windows资源管理器
1. 运行 `build.bat` 到复制文件完成（不要等压缩完成，可以Ctrl+C中断）
2. 进入 `build` 文件夹
3. 选择所有文件和文件夹
4. 右键 → "发送到" → "压缩(zipped)文件夹"
5. 将生成的ZIP文件重命名为 `researchopia-zotero-plugin-doi-enhanced-v0.2.0.xpi`

#### 方法2：使用7-Zip（如果已安装）
1. 运行 `build.bat` 到复制文件完成
2. 进入 `build` 文件夹
3. 选择所有文件，右键 → 7-Zip → "添加到压缩包..."
4. 设置：
   - 压缩格式：ZIP
   - 压缩等级：标准
   - 文件名：`../researchopia-zotero-plugin-doi-enhanced-v0.2.0.xpi`

#### 方法3：命令行（如果有7-Zip）
```batch
cd build
7z a -tzip ../researchopia-zotero-plugin-doi-enhanced-v0.2.0.xpi * -mx5
```

### 自动构建脚本改进

如果您想继续使用自动构建，可以尝试以下修改：

```batch
REM 使用较低的压缩级别
powershell -command "Compress-Archive -Path '%BUILD_DIR%\*' -DestinationPath '%TEMP_ZIP%' -CompressionLevel Fastest -Force"
```

或者完全不压缩：
```batch
powershell -command "Compress-Archive -Path '%BUILD_DIR%\*' -DestinationPath '%TEMP_ZIP%' -CompressionLevel NoCompression -Force"
```

### 验证构建结果

构建完成后，检查以下内容：

1. **文件大小**：应该在300KB左右（类似您手动压缩的结果）
2. **图标测试**：安装插件后检查图标是否显示
3. **功能测试**：确保标注分享功能正常工作

### 推荐的构建流程

对于正式发布，建议：

1. **开发阶段**：使用自动构建脚本快速测试
2. **发布阶段**：使用手动压缩确保最佳兼容性

### 文件结构检查

确保XPI文件包含以下结构：
```
researchopia-zotero-plugin-doi-enhanced-v0.2.0.xpi
├── manifest.json
├── bootstrap.js
├── researchopia.js
├── config.js
├── annotation-sharing.js
├── doi-handler.js
├── doi-annotation-sharing.js
├── style.css
├── prefs.js
├── test.js
├── README.md
├── defaults/
│   └── preferences/
│       └── prefs.js
├── icons/
│   ├── icon16.svg
│   ├── icon32.svg
│   ├── icon48.svg
│   ├── icon96.svg
│   └── icon128.svg
├── locale/
│   ├── en-US/
│   │   └── researchopia.ftl
│   └── zh-CN/
│       └── researchopia.ftl
└── panel/
    ├── panel.css
    ├── panel.html
    ├── panel.js
    └── settings.html
```

### 故障排除

如果图标仍然不显示：

1. **检查SVG文件**：确保图标文件没有被损坏
2. **检查路径**：确认图标路径在代码中正确
3. **检查权限**：确保Zotero有权限访问图标文件
4. **重启Zotero**：有时需要完全重启Zotero才能加载新图标

### 下一步

一旦图标问题解决，我们将：
1. 升级版本到v0.2.0
2. 完善文档
3. 进行全面测试
4. 准备正式发布
