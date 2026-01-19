/**
 * 版本号同步脚本
 * 从根目录 package.json 读取 components 版本号,同步到各组件
 *
 * 同步目标:
 * 1. 网站: package.json (主版本号)
 * 2. 浏览器扩展: extension/manifest.json, extension/package.json
 * 3. Zotero 插件: zotero-plugin/package.json
 * 4. 文档: docs/README.md
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
console.log('组件版本配置:');
Object.entries(components).forEach(([name, version]) => {
  console.log(`  - ${name}: ${version}`);
});
console.log('');

function writeJson(targetPath, data) {
  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2) + '\n');
}

// 统计结果
const results = { success: [], skipped: [], failed: [] };

// ============================================================================
// 1. 网站版本同步 (根目录 package.json 的 version 字段)
// ============================================================================
console.log('📁 同步网站版本...');
try {
  const oldVersion = rootPkg.version;
  if (rootPkg.version !== components['website']) {
    rootPkg.version = components['website'];
    writeJson(rootPkgPath, rootPkg);
    results.success.push(`网站 (package.json): ${oldVersion} → ${components['website']}`);
  } else {
    results.skipped.push(`网站 (package.json): 已是最新 ${oldVersion}`);
  }
} catch (error) {
  results.failed.push(`网站: ${error.message}`);
}

// ============================================================================
// 2. Zotero 插件版本同步
// ============================================================================
console.log('📁 同步 Zotero 插件版本...');
try {
  const zoteroPath = resolveFromRoot('zotero-plugin', 'package.json');
  if (fs.existsSync(zoteroPath)) {
    const zoteroPkg = JSON.parse(fs.readFileSync(zoteroPath, 'utf8'));
    const oldVersion = zoteroPkg.version;
    if (zoteroPkg.version !== components['zotero-plugin']) {
      zoteroPkg.version = components['zotero-plugin'];
      writeJson(zoteroPath, zoteroPkg);
      results.success.push(`Zotero插件 (package.json): ${oldVersion} → ${components['zotero-plugin']}`);
    } else {
      results.skipped.push(`Zotero插件 (package.json): 已是最新 ${oldVersion}`);
    }
  } else {
    results.skipped.push('Zotero插件: package.json 不存在');
  }
} catch (error) {
  results.failed.push(`Zotero插件: ${error.message}`);
}

// ============================================================================
// 3. 浏览器扩展版本同步 (manifest.json + package.json)
// ============================================================================
console.log('📁 同步浏览器扩展版本...');
try {
  const extManifestPath = resolveFromRoot('extension', 'manifest.json');
  if (fs.existsSync(extManifestPath)) {
    const extManifest = JSON.parse(fs.readFileSync(extManifestPath, 'utf8'));
    const oldVersion = extManifest.version;
    if (extManifest.version !== components['browser-extension']) {
      extManifest.version = components['browser-extension'];
      writeJson(extManifestPath, extManifest);
      results.success.push(`浏览器扩展 (manifest.json): ${oldVersion} → ${components['browser-extension']}`);
    } else {
      results.skipped.push(`浏览器扩展 (manifest.json): 已是最新 ${oldVersion}`);
    }
  } else {
    results.skipped.push('浏览器扩展: manifest.json 不存在');
  }
} catch (error) {
  results.failed.push(`浏览器扩展 manifest.json: ${error.message}`);
}

try {
  const extPkgPath = resolveFromRoot('extension', 'package.json');
  if (fs.existsSync(extPkgPath)) {
    const extPkg = JSON.parse(fs.readFileSync(extPkgPath, 'utf8'));
    const oldVersion = extPkg.version;
    if (extPkg.version !== components['browser-extension']) {
      extPkg.version = components['browser-extension'];
      writeJson(extPkgPath, extPkg);
      results.success.push(`浏览器扩展 (package.json): ${oldVersion} → ${components['browser-extension']}`);
    } else {
      results.skipped.push(`浏览器扩展 (package.json): 已是最新 ${oldVersion}`);
    }
  } else {
    results.skipped.push('浏览器扩展: package.json 不存在');
  }
} catch (error) {
  results.failed.push(`浏览器扩展 package.json: ${error.message}`);
}

// ============================================================================
// 4. 文档版本同步
// ============================================================================
console.log('📁 同步文档版本...');
try {
  const docsPath = resolveFromRoot('docs', 'README.md');
  if (fs.existsSync(docsPath)) {
    let docsContent = fs.readFileSync(docsPath, 'utf8');
    const versionRegex = /(\*\*文档版本\*\*:\s*v?)[\d.]+/;
    const match = docsContent.match(versionRegex);

    if (match) {
      const oldVersion = match[0].match(/[\d.]+/)[0];
      if (oldVersion !== components['docs']) {
        docsContent = docsContent.replace(versionRegex, `$1${components['docs']}`);

        const dateRegex = /\*\*最后更新\*\*:\s*\d{4}-\d{2}-\d{2}/;
        const today = new Date().toISOString().split('T')[0];
        docsContent = docsContent.replace(dateRegex, `**最后更新**: ${today}`);

        fs.writeFileSync(docsPath, docsContent);
        results.success.push(`文档 (README.md): v${oldVersion} → v${components['docs']}`);
      } else {
        results.skipped.push(`文档 (README.md): 已是最新 v${oldVersion}`);
      }
    } else {
      results.skipped.push('文档: 未找到版本号标记');
    }
  } else {
    results.skipped.push('文档: docs/README.md 不存在');
  }
} catch (error) {
  results.failed.push(`文档: ${error.message}`);
}

// ============================================================================
// 输出结果汇总
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('📊 同步结果汇总');
console.log('='.repeat(60));

if (results.success.length > 0) {
  console.log('\n✅ 已更新:');
  results.success.forEach(msg => console.log(`   ${msg}`));
}

if (results.skipped.length > 0) {
  console.log('\n⏭️  已跳过 (版本已最新):');
  results.skipped.forEach(msg => console.log(`   ${msg}`));
}

if (results.failed.length > 0) {
  console.log('\n❌ 失败:');
  results.failed.forEach(msg => console.log(`   ${msg}`));
}

console.log('\n' + '='.repeat(60));
if (results.failed.length === 0) {
  console.log('🎉 版本号同步完成!');
} else {
  console.log('⚠️  版本号同步完成，但有部分失败');
}

console.log('\n💡 提示:');
console.log('  - 检查变更: git diff');
console.log('  - 提交变更: git add -A && git commit -m "chore: sync component versions"');
console.log(`  - 创建 Git Tag: git tag v${rootPkg.version}`);

