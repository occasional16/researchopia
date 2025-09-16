const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== 研学港 Researchopia 同步诊断 ===\n');

// 1. 检查当前目录
console.log('1. 当前工作目录:', process.cwd());

// 2. 检查关键文件是否存在
const keyFiles = [
  'src/app/page.tsx',
  'src/components/ui/BrandLogo.tsx',
  'package.json',
  'next.config.ts'
];

console.log('2. 检查关键文件:');
keyFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${file}: ${exists ? '✓ 存在' : '✗ 缺失'}`);
});

// 3. 检查Git状态
console.log('\n3. Git状态检查:');
try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
  if (gitStatus.trim()) {
    console.log('   有未提交的更改:');
    console.log(gitStatus);
  } else {
    console.log('   ✓ 工作区干净');
  }
} catch (error) {
  console.log('   ✗ Git状态检查失败:', error.message);
}

// 4. 检查最后提交
console.log('\n4. 最后提交信息:');
try {
  const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf8' });
  console.log('   ', lastCommit.trim());
} catch (error) {
  console.log('   ✗ 无法获取提交信息:', error.message);
}

// 5. 检查远程分支
console.log('\n5. 远程同步状态:');
try {
  execSync('git fetch', { encoding: 'utf8' });
  const behind = execSync('git rev-list HEAD..origin/main --count', { encoding: 'utf8' });
  const ahead = execSync('git rev-list origin/main..HEAD --count', { encoding: 'utf8' });
  
  console.log(`   本地领先远程: ${ahead.trim()} 个提交`);
  console.log(`   本地落后远程: ${behind.trim()} 个提交`);
} catch (error) {
  console.log('   ✗ 远程同步检查失败:', error.message);
}

// 6. 检查环境变量
console.log('\n6. 环境变量检查:');
const envFile = '.env.local';
if (fs.existsSync(envFile)) {
  console.log('   ✓ .env.local 存在');
  const envContent = fs.readFileSync(envFile, 'utf8');
  const hasSupabaseUrl = envContent.includes('NEXT_PUBLIC_SUPABASE_URL');
  const hasSupabaseKey = envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.log(`   Supabase URL配置: ${hasSupabaseUrl ? '✓' : '✗'}`);
  console.log(`   Supabase Key配置: ${hasSupabaseKey ? '✓' : '✗'}`);
} else {
  console.log('   ✗ .env.local 不存在');
}

// 7. 检查本地页面内容
console.log('\n7. 本地页面内容检查:');
const pageFile = 'src/app/page.tsx';
if (fs.existsSync(pageFile)) {
  const pageContent = fs.readFileSync(pageFile, 'utf8');
  const hasResearchopia = pageContent.includes('研学港 Researchopia');
  const hasBrandLogo = pageContent.includes('BrandLogo');
  console.log(`   包含"研学港 Researchopia": ${hasResearchopia ? '✓' : '✗'}`);
  console.log(`   包含BrandLogo组件: ${hasBrandLogo ? '✓' : '✗'}`);
} else {
  console.log('   ✗ 主页面文件不存在');
}

console.log('\n=== 诊断完成 ===');

// 提供解决方案建议
console.log('\n🔧 解决方案建议:');
console.log('1. 如果有未提交的更改，运行: git add . && git commit -m "同步更新"');
console.log('2. 如果本地领先远程，运行: git push origin main');
console.log('3. 推送后等待2-3分钟让Vercel自动部署');
console.log('4. 检查Vercel部署状态: https://vercel.com/dashboard');
