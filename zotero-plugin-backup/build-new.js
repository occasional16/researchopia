const fs = require('fs-extra');
const path = require('path');

async function buildPlugin() {
  console.log('🔨 开始构建新架构插件...');
  
  const buildDir = path.join(__dirname, 'build-new');
  
  // 清理并创建构建目录
  await fs.remove(buildDir);
  await fs.ensureDir(buildDir);
  
  try {
    // 1. 复制新的bootstrap.js
    console.log('✅ 复制: bootstrap-simple.js -> build-new/bootstrap.js');
    await fs.copy(
      path.join(__dirname, 'bootstrap-simple.js'),
      path.join(buildDir, 'bootstrap.js')
    );
    
    // 2. 复制新的manifest.json
    console.log('✅ 复制: manifest-new.json -> build-new/manifest.json');
    await fs.copy(
      path.join(__dirname, 'manifest-new.json'),
      path.join(buildDir, 'manifest.json')
    );
    
    // 3. 复制chrome目录
    console.log('✅ 复制: chrome -> build-new/chrome');
    await fs.copy(
      path.join(__dirname, 'chrome'),
      path.join(buildDir, 'chrome')
    );
    
    // 4. 复制content目录（保留现有资源）
    console.log('✅ 复制: content -> build-new/content');
    await fs.copy(
      path.join(__dirname, 'content'),
      path.join(buildDir, 'content')
    );
    
    console.log('✅ 构建完成！');
    console.log('📁 构建目录: build-new');
    
    return buildDir;
    
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  buildPlugin().catch(console.error);
}

module.exports = { buildPlugin };
