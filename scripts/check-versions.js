/**
 * 版本号验证脚本
 * 检查所有组件版本号是否与根 package.json 一致
 *
 * 使用方法: npm run version:check
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const resolveFromRoot = (...segments) => path.join(repoRoot, ...segments);

const rootPkgPath = resolveFromRoot('package.json');
if (!fs.existsSync(rootPkgPath)) {
  console.error('❌ 错误: 未找到根目录 package.json');
  process.exit(1);
}

const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
if (!rootPkg.components) {
  console.error('❌ 错误: package.json 中未找到 components 字段');
  process.exit(1);
}

const components = rootPkg.components;
let hasError = false;

console.log('🔍 开始检查组件版本号...\n');
console.log(`项目主版本: ${rootPkg.version}`);
console.log('');

function compareVersion(label, expected, actual) {
  if (actual === expected) {
    console.log(`✅ ${label}: ${actual} (正确)`);
  } else {
    console.log(`❌ ${label}: ${actual ?? '未知'} (应为 ${expected})`);
    hasError = true;
  }
}

try {
  const zoteroPath = resolveFromRoot('zotero-plugin', 'package.json');
  if (fs.existsSync(zoteroPath)) {
    const zoteroPkg = JSON.parse(fs.readFileSync(zoteroPath, 'utf8'));
    compareVersion('Zotero插件', components['zotero-plugin'], zoteroPkg.version);
  } else {
    console.log('⚠️  Zotero插件: package.json 不存在');
  }
} catch (error) {
  console.error(`❌ Zotero插件检查失败: ${error.message}`);
  hasError = true;
}

try {
  const extPath = resolveFromRoot('extension', 'manifest.json');
  if (fs.existsSync(extPath)) {
    const extManifest = JSON.parse(fs.readFileSync(extPath, 'utf8'));
    compareVersion('浏览器扩展', components['browser-extension'], extManifest.version);
  } else {
    console.log('⚠️  浏览器扩展: manifest.json 不存在');
  }
} catch (error) {
  console.error(`❌ 浏览器扩展检查失败: ${error.message}`);
  hasError = true;
}

try {
  const docsPath = resolveFromRoot('docs', 'README.md');
  if (fs.existsSync(docsPath)) {
    const docsContent = fs.readFileSync(docsPath, 'utf8');
    const versionRegex = /\*\*文档版本\*\*:\s*v?([\d.]+)/;
    const match = docsContent.match(versionRegex);

    if (match) {
      compareVersion('文档', components['docs'], match[1]);
    } else {
      console.log('⚠️  文档: 未找到版本号标记');
    }
  } else {
    console.log('⚠️  文档: docs/README.md 不存在');
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
}

console.log('🎉 版本号检查通过!');
console.log('\n📋 当前版本概览:');
console.log(`  - 项目主版本: ${rootPkg.version}`);
Object.entries(components).forEach(([name, version]) => {
  console.log(`  - ${name}: ${version}`);
});
