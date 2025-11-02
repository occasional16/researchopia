/**
 * 版本号验证脚本
 * 检查所有组件版本号是否与根package.json一致
 * 
 * 使用方法: npm run version:check
 */

const fs = require('fs');
const path = require('path');

// 读取根package.json
const rootPkgPath = path.join(__dirname, '..', 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));

if (!rootPkg.components) {
  console.error('❌ 错误: package.json中未找到components字段');
  process.exit(1);
}

const components = rootPkg.components;
let hasError = false;

console.log('🔍 开始检查组件版本号...\n');
console.log(`项目主版本: ${rootPkg.version}`);
console.log('');

// 检查Zotero插件
try {
  const zoteroPath = path.join(__dirname, '..', 'zotero-plugin', 'package.json');
  
  if (fs.existsSync(zoteroPath)) {
    const zoteroPkg = JSON.parse(fs.readFileSync(zoteroPath, 'utf8'));
    const expected = components['zotero-plugin'];
    const actual = zoteroPkg.version;
    
    if (actual === expected) {
      console.log(`✅ Zotero插件: ${actual} (正确)`);
    } else {
      console.log(`❌ Zotero插件: ${actual} (应为 ${expected})`);
      hasError = true;
    }
  } else {
    console.log('⚠️  Zotero插件: package.json不存在');
  }
} catch (error) {
  console.error(`❌ Zotero插件检查失败: ${error.message}`);
  hasError = true;
}

// 检查浏览器扩展
try {
  const extPath = path.join(__dirname, '..', 'extension', 'manifest.json');
  
  if (fs.existsSync(extPath)) {
    const extManifest = JSON.parse(fs.readFileSync(extPath, 'utf8'));
    const expected = components['browser-extension'];
    const actual = extManifest.version;
    
    if (actual === expected) {
      console.log(`✅ 浏览器扩展: ${actual} (正确)`);
    } else {
      console.log(`❌ 浏览器扩展: ${actual} (应为 ${expected})`);
      hasError = true;
    }
  } else {
    console.log('⚠️  浏览器扩展: manifest.json不存在');
  }
} catch (error) {
  console.error(`❌ 浏览器扩展检查失败: ${error.message}`);
  hasError = true;
}

// 检查文档版本
try {
  const docsPath = path.join(__dirname, '..', 'docs', 'README.md');
  
  if (fs.existsSync(docsPath)) {
    const docsContent = fs.readFileSync(docsPath, 'utf8');
    const versionRegex = /\*\*文档版本\*\*:\s*v?([\d.]+)/;
    const match = docsContent.match(versionRegex);
    
    if (match) {
      const expected = components['docs'];
      const actual = match[1];
      
      if (actual === expected) {
        console.log(`✅ 文档: v${actual} (正确)`);
      } else {
        console.log(`❌ 文档: v${actual} (应为 v${expected})`);
        hasError = true;
      }
    } else {
      console.log('⚠️  文档: 未找到版本号标记');
    }
  } else {
    console.log('⚠️  文档: docs/README.md不存在');
  }
} catch (error) {
  console.error(`❌ 文档检查失败: ${error.message}`);
  hasError = true;
}

console.log('');

if (hasError) {
  console.log('❌ 版本号检查失败!');
  console.log('\n💡 修复方法: npm run version:sync');
  process.exit(1);
} else {
  console.log('🎉 版本号检查通过!');
  console.log('\n📋 当前版本概览:');
  console.log(`  - 项目主版本: ${rootPkg.version}`);
  Object.entries(components).forEach(([name, version]) => {
    console.log(`  - ${name}: ${version}`);
  });
}
