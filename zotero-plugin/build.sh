#!/bin/bash
# Researchopia Zotero Plugin Build Script

echo "🏗️  Building Researchopia Zotero Plugin (DOI Enhanced)"
echo "=================================================="

# 设置变量
PLUGIN_NAME="researchopia-zotero-plugin-doi-enhanced"
VERSION="v1.0.0"
BUILD_DIR="build"
XPI_NAME="${PLUGIN_NAME}-${VERSION}.xpi"

# 清理之前的构建
echo "🧹 Cleaning previous builds..."
rm -rf ${BUILD_DIR}
rm -f *.xpi

# 创建构建目录
mkdir -p ${BUILD_DIR}

# 复制插件文件
echo "📦 Copying plugin files..."
cp manifest.json ${BUILD_DIR}/
cp bootstrap.js ${BUILD_DIR}/
cp researchopia.js ${BUILD_DIR}/
cp config.js ${BUILD_DIR}/
cp annotation-sharing.js ${BUILD_DIR}/
cp doi-handler.js ${BUILD_DIR}/
cp doi-annotation-sharing.js ${BUILD_DIR}/
cp style.css ${BUILD_DIR}/
cp prefs.js ${BUILD_DIR}/
cp test.js ${BUILD_DIR}/
cp DOI_PLUGIN_README.md ${BUILD_DIR}/README.md

# 复制目录
cp -r defaults ${BUILD_DIR}/
cp -r icons ${BUILD_DIR}/
cp -r locale ${BUILD_DIR}/
cp -r panel ${BUILD_DIR}/

# 创建XPI文件（实际上是ZIP文件）
echo "🗜️  Creating XPI package..."
cd ${BUILD_DIR}
zip -r "../${XPI_NAME}" ./*
cd ..

# 验证XPI文件
if [ -f "${XPI_NAME}" ]; then
    echo "✅ Successfully created: ${XPI_NAME}"
    echo "📊 File size: $(du -h ${XPI_NAME} | cut -f1)"
    echo ""
    echo "📋 Package contents:"
    unzip -l "${XPI_NAME}"
    echo ""
    echo "🎯 Installation instructions:"
    echo "1. Open Zotero"
    echo "2. Go to Tools → Add-ons"
    echo "3. Click the gear icon → Install Add-on From File"
    echo "4. Select: ${XPI_NAME}"
    echo "5. Restart Zotero"
    echo ""
    echo "🔗 API Configuration:"
    echo "- Ensure Next.js dev server is running on http://localhost:3000"
    echo "- Ensure WebSocket server is running on ws://localhost:8080"
    echo "- Test API at: http://localhost:3000/test/doi-api"
else
    echo "❌ Failed to create XPI file"
    exit 1
fi

# 清理构建目录
echo "🧹 Cleaning up build directory..."
rm -rf ${BUILD_DIR}

echo ""
echo "🎉 Build completed successfully!"
echo "📁 Output: ${XPI_NAME}"