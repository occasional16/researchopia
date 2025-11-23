/**
 * 版本号同步脚本
 * 从根目录 package.json 读取 components 版本号,同步到各组件
 *
 * 使用方法:
 * 1. 手动编辑根目录 package.json 的 components 字段
 * 2. 运行: npm run version:sync
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

console.log('📦 开始同步组件版本号...\n');
console.log(`项目主版本: ${rootPkg.version}`);
console.log('组件版本:');
Object.entries(components).forEach(([name, version]) => {
  console.log(`  - ${name}: ${version}`);
});
console.log('');

function writeJson(targetPath, data) {
  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2) + '\n');
}

try {
  const zoteroPath = resolveFromRoot('zotero-plugin', 'package.json');
  if (fs.existsSync(zoteroPath)) {
    const zoteroPkg = JSON.parse(fs.readFileSync(zoteroPath, 'utf8'));
    const oldVersion = zoteroPkg.version;
    zoteroPkg.version = components['zotero-plugin'];
    writeJson(zoteroPath, zoteroPkg);
    console.log(`✅ Zotero插件: ${oldVersion} → ${components['zotero-plugin']}`);
  } else {
    console.log('⚠️  Zotero插件: package.json 不存在,跳过');
  }
} catch (error) {
  console.error(`❌ Zotero插件同步失败: ${error.message}`);
}

try {
  const extPath = resolveFromRoot('extension', 'manifest.json');
  if (fs.existsSync(extPath)) {
    const extManifest = JSON.parse(fs.readFileSync(extPath, 'utf8'));
    const oldVersion = extManifest.version;
    extManifest.version = components['browser-extension'];
    writeJson(extPath, extManifest);
    console.log(`✅ 浏览器扩展: ${oldVersion} → ${components['browser-extension']}`);
  } else {
    console.log('⚠️  浏览器扩展: manifest.json 不存在,跳过');
  }
} catch (error) {
  console.error(`❌ 浏览器扩展同步失败: ${error.message}`);
}

try {
  const docsPath = resolveFromRoot('docs', 'README.md');
  if (fs.existsSync(docsPath)) {
    let docsContent = fs.readFileSync(docsPath, 'utf8');
    const versionRegex = /(\*\*文档版本\*\*:\s*v?)[\d.]+/;
    const match = docsContent.match(versionRegex);

    if (match) {
      const oldVersion = match[0].match(/[\d.]+/)[0];
      docsContent = docsContent.replace(versionRegex, `$1${components['docs']}`);

      const dateRegex = /\*\*最后更新\*\*:\s*\d{4}-\d{2}-\d{2}/;
      const today = new Date().toISOString().split('T')[0];
      docsContent = docsContent.replace(dateRegex, `**最后更新**: ${today}`);

      fs.writeFileSync(docsPath, docsContent);
      console.log(`✅ 文档: v${oldVersion} → v${components['docs']}`);
    } else {
      console.log('⚠️  文档: 未找到版本号标记,跳过');
    }
  } else {
    console.log('⚠️  文档: docs/README.md 不存在,跳过');
  }
} catch (error) {
  console.error(`❌ 文档同步失败: ${error.message}`);
}

console.log('\n🎉 版本号同步完成!');
console.log('\n💡 提示:');
console.log('  - 检查变更: git diff');
console.log('  - 提交变更: git add -A && git commit -m "chore: sync component versions"');
console.log('  - 创建 Git Tag: git tag v' + rootPkg.version);
