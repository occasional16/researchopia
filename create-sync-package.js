#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

console.log('📦 创建离线同步包');
console.log('==================\n');

// 需要同步的关键文件
const filesToSync = [
  'package.json',
  'public/manifest.json',
  'src/app/page.tsx',
  'src/components/ui/BrandLogo.tsx',
  'README.md'
];

console.log('🔍 检查需要同步的文件...');
const existingFiles = [];

filesToSync.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
    existingFiles.push(file);
  } else {
    console.log(`   ❌ ${file} (不存在)`);
  }
});

// 创建简化的同步信息
const syncInfo = {
  timestamp: new Date().toISOString(),
  branch: 'main',
  description: '修复PWA manifest和控制台错误 - 更新品牌信息',
  files: existingFiles,
  instructions: [
    '1. 解压此文件到本地仓库',
    '2. 检查文件差异',
    '3. 在GitHub网页版逐个编辑文件',
    '4. 或使用GitHub Desktop上传'
  ]
};

fs.writeFileSync('SYNC_INFO.json', JSON.stringify(syncInfo, null, 2));

console.log('\n📋 同步信息已创建: SYNC_INFO.json');
console.log('\n🌐 手动同步建议:');
console.log('1. 访问 https://github.com/occasional15/researchopia');
console.log('2. 编辑以下关键文件:');
existingFiles.forEach(file => {
  console.log(`   - ${file}`);
});
console.log('3. 或使用GitHub Desktop批量上传');

console.log('\n⚡ 快速修复: 只需编辑这2个最关键的文件:');
console.log('   - package.json (确保name为"academic-rating")');
console.log('   - public/manifest.json (确保包含研学港品牌)');
