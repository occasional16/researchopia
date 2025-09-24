/**
 * 验证Zotero插件修复的脚本
 * 检查关键修复点是否正确实现
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 验证Zotero插件修复...\n');

// 检查文件是否存在
function checkFileExists(filePath) {
  const exists = fs.existsSync(filePath);
  console.log(`${exists ? '✅' : '❌'} ${filePath} ${exists ? '存在' : '不存在'}`);
  return exists;
}

// 检查文件内容是否包含特定字符串
function checkFileContains(filePath, searchString, description) {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${description}: 文件不存在 - ${filePath}`);
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const contains = content.includes(searchString);
  console.log(`${contains ? '✅' : '❌'} ${description}: ${contains ? '已修复' : '未找到'}`);
  return contains;
}

console.log('1. 检查关键文件存在性:');
const buildDir = 'build';
checkFileExists(path.join(buildDir, 'bootstrap.js'));
checkFileExists(path.join(buildDir, 'content', 'preferences.js'));
checkFileExists(path.join(buildDir, 'content', 'preferences.xhtml'));
checkFileExists(path.join(buildDir, 'manifest.json'));

console.log('\n2. 检查关键修复点:');

// 检查全局引用设置
checkFileContains(
  path.join(buildDir, 'bootstrap.js'),
  'Zotero.ResearchopiaPlugin = this',
  '全局引用设置'
);

// 检查SupabaseConfig类
checkFileContains(
  path.join(buildDir, 'bootstrap.js'),
  'class SupabaseConfig',
  'Supabase配置管理器'
);

// 检查ResearchopiaPreferences对象定义
checkFileContains(
  path.join(buildDir, 'content', 'preferences.js'),
  'var ResearchopiaPreferences',
  'ResearchopiaPreferences对象定义'
);

// 检查错误处理改进
checkFileContains(
  path.join(buildDir, 'content', 'preferences.js'),
  'ResearchopiaPreferences: Starting login process',
  '登录过程调试信息'
);

// 检查配置统一使用
checkFileContains(
  path.join(buildDir, 'bootstrap.js'),
  'SupabaseConfig.getConfig()',
  '统一配置使用'
);

console.log('\n3. 检查配置一致性:');

// 读取.env.local文件
const envPath = '../.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
  const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
  
  if (urlMatch && keyMatch) {
    const envUrl = urlMatch[1].trim();
    const envKey = keyMatch[1].trim();
    
    // 检查bootstrap.js中的配置是否匹配
    const bootstrapContent = fs.readFileSync(path.join(buildDir, 'bootstrap.js'), 'utf8');
    const urlInCode = bootstrapContent.includes(envUrl);
    const keyInCode = bootstrapContent.includes(envKey);
    
    console.log(`${urlInCode ? '✅' : '❌'} Supabase URL配置一致性: ${urlInCode ? '匹配' : '不匹配'}`);
    console.log(`${keyInCode ? '✅' : '❌'} Supabase Key配置一致性: ${keyInCode ? '匹配' : '不匹配'}`);
  } else {
    console.log('❌ 无法解析.env.local文件中的配置');
  }
} else {
  console.log('❌ .env.local文件不存在');
}

console.log('\n4. 检查XPI包结构:');
const requiredFiles = [
  'manifest.json',
  'bootstrap.js',
  'content/preferences.js',
  'content/preferences.xhtml',
  'content/preferences.css'
];

let allFilesPresent = true;
requiredFiles.forEach(file => {
  const exists = checkFileExists(path.join(buildDir, file));
  if (!exists) allFilesPresent = false;
});

console.log('\n📋 验证总结:');
console.log(`${allFilesPresent ? '✅' : '❌'} 所有必需文件: ${allFilesPresent ? '完整' : '缺失'}`);

console.log('\n🚀 下一步:');
console.log('1. 将build目录中的文件安装到Zotero');
console.log('2. 重启Zotero');
console.log('3. 测试偏好设置页面和登录功能');
console.log('4. 查看test-fixes.md获取详细测试指南');
