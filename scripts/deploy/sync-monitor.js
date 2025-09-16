#!/usr/bin/env node

console.log('📡 研学港部署同步监控');
console.log('===================\n');

// 1. 检查 Git 状态
const { execSync } = require('child_process');

console.log('1. 检查本地 Git 状态...');
try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8', cwd: __dirname });
  const gitLog = execSync('git log --oneline -3', { encoding: 'utf8', cwd: __dirname });
  const gitRemote = execSync('git log --oneline origin/main..HEAD', { encoding: 'utf8', cwd: __dirname });
  
  console.log('   工作目录状态:');
  console.log(gitStatus.length > 0 ? `   ${gitStatus}` : '   ✅ 工作目录干净');
  
  console.log('\n   最近3次提交:');
  console.log(`   ${gitLog.trim()}`);
  
  console.log('\n   尚未推送的提交:');
  if (gitRemote.trim()) {
    console.log(`   ${gitRemote.trim()}`);
    console.log('   ⚠️ 有未推送的提交！');
  } else {
    console.log('   ✅ 本地与远程同步');
  }
  
} catch (error) {
  console.log(`   ❌ Git检查失败: ${error.message}`);
}

// 2. 检查 Vercel 部署状态
console.log('\n2. 准备检查 Vercel 部署...');
setTimeout(() => {
  console.log('   💭 建议手动检查：https://vercel.com/occasional15s-projects/academic-rating');
  console.log('   💭 在线页面：https://academic-rating.vercel.app/');
}, 1000);

console.log('\n🔧 推荐操作:');
console.log('1. 如果有未推送提交，运行: git push origin main --force');
console.log('2. 检查 Vercel 控制台是否自动触发部署');
console.log('3. 如果部署没有触发，手动点击 "Redeploy" 按钮');
console.log('4. 清除浏览器缓存后访问在线页面');
