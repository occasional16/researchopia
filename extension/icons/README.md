# 图标文件说明

当前扩展使用的是SVG格式的图标占位符。为了完整的扩展功能，您需要创建以下PNG格式的图标文件：

## 需要创建的图标：

1. `icon16.png` - 16x16 像素
2. `icon32.png` - 32x32 像素  
3. `icon48.png` - 48x48 像素
4. `icon128.png` - 128x128 像素

## 图标设计建议：

- **主色调**: 使用 #667eea (蓝紫色渐变)
- **主要元素**: "研" 字或 "R" 字母
- **背景**: 圆角矩形或圆形
- **风格**: 简洁现代，与研学港品牌一致

## 临时解决方案：

可以将 `icon16.svg` 转换为不同尺寸的PNG文件：

```bash
# 使用在线工具或图像编辑软件将SVG转换为PNG
# 或者使用命令行工具如 ImageMagick:
convert icon16.svg -resize 16x16 icon16.png
convert icon16.svg -resize 32x32 icon32.png
convert icon16.svg -resize 48x48 icon48.png
convert icon16.svg -resize 128x128 icon128.png
```

## 注意事项：

- 确保图标在不同尺寸下都清晰可见
- 背景应该透明或使用适当的颜色
- 遵循Chrome扩展图标设计规范

创建完PNG图标后，请替换manifest.json中的图标路径引用。