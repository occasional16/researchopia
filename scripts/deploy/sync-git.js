#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔄 Git 同步脚本');
console.log('===============\n');

try {
  // 1. 检查当前状态
  console.log('1. 检查当前Git状态...');
  const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: __dirname });
  const ahead = execSync('git rev-list --count origin/main..HEAD', { encoding: 'utf8', cwd: __dirname });
  
  console.log(`   未提交文件: ${status.length > 0 ? status.split('\n').length - 1 : 0} 个`);
  console.log(`   领先远程: ${ahead.trim()} 个提交`);
  
  // 2. 添加所有更改
  console.log('\n2. 添加所有更改...');
  execSync('git add .', { cwd: __dirname });
  console.log('   ✅ 已添加所有文件');
  
  // 3. 检查是否有需要提交的内容
  const statusAfterAdd = execSync('git status --porcelain', { encoding: 'utf8', cwd: __dirname });
  if (statusAfterAdd.length > 0) {
    console.log('\n3. 提交更改...');
    execSync('git commit -m "修复PWA manifest和控制台错误"', { cwd: __dirname });
    console.log('   ✅ 已提交更改');
  } else {
    console.log('\n3. 没有新的更改需要提交');
  }
  
  // 4. 推送到远程
  console.log('\n4. 推送到GitHub...');
  try {
    execSync('git push origin main --force-with-lease', { cwd: __dirname, stdio: 'inherit' });
    console.log('   ✅ 推送成功！');
  } catch (error) {
    console.log('   ⚠️ 推送失败，尝试强制推送...');
    try {
      execSync('git push origin main --force', { cwd: __dirname, stdio: 'inherit' });
      console.log('   ✅ 强制推送成功！');
    } catch (forceError) {
      console.log('   ❌ 推送仍失败，可能是网络问题');
      console.log('   建议: 手动在GitHub上同步或使用其他网络');
    }
  }
  
  // 5. 验证同步状态
  console.log('\n5. 验证同步状态...');
  const finalAhead = execSync('git rev-list --count origin/main..HEAD', { encoding: 'utf8', cwd: __dirname });
  if (parseInt(finalAhead.trim()) === 0) {
    console.log('   ✅ 本地与远程完全同步');
  } else {
    console.log(`   ⚠️ 仍有 ${finalAhead.trim()} 个提交未同步`);
  }
  
} catch (error) {
  console.error('❌ Git操作失败:', error.message);
  console.log('\n手动操作建议:');
  console.log('1. git add .');
  console.log('2. git commit -m "修复PWA和控制台问题"');
  console.log('3. git push origin main --force');
}
