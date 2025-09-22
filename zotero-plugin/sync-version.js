/**
 * Version Synchronization Script
 * 同步所有文件中的版本号
 */

const fs = require('fs');
const path = require('path');

// 目标版本号
const TARGET_VERSION = '0.1.95';

console.log(`🔄 开始同步版本号到 ${TARGET_VERSION}...`);

// 1. 更新 manifest.json
try {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = TARGET_VERSION;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('✅ 已更新 manifest.json');
} catch (error) {
  console.error('❌ 更新 manifest.json 失败:', error.message);
}

// 2. 更新 bootstrap.js
try {
  const bootstrapPath = path.join(__dirname, 'bootstrap.js');
  let bootstrapContent = fs.readFileSync(bootstrapPath, 'utf8');
  
  // 替换版本号
  bootstrapContent = bootstrapContent.replace(
    /this\.version = '[^']+';/g,
    `this.version = '${TARGET_VERSION}';`
  );
  
  fs.writeFileSync(bootstrapPath, bootstrapContent);
  console.log('✅ 已更新 bootstrap.js');
} catch (error) {
  console.error('❌ 更新 bootstrap.js 失败:', error.message);
}

// 3. 更新 version.js
try {
  const versionPath = path.join(__dirname, 'version.js');
  let versionContent = fs.readFileSync(versionPath, 'utf8');
  
  // 替换版本号
  versionContent = versionContent.replace(
    /const PLUGIN_VERSION = '[^']+';/g,
    `const PLUGIN_VERSION = '${TARGET_VERSION}';`
  );
  
  fs.writeFileSync(versionPath, versionContent);
  console.log('✅ 已更新 version.js');
} catch (error) {
  console.error('❌ 更新 version.js 失败:', error.message);
}

// 4. 更新 package.json（如果存在）
try {
  const packagePath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageJson.version = TARGET_VERSION;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✅ 已更新 package.json');
  }
} catch (error) {
  console.error('❌ 更新 package.json 失败:', error.message);
}

console.log(`🎉 版本号同步完成！所有文件已更新到 ${TARGET_VERSION}`);
