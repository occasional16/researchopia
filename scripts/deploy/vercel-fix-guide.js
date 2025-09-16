#!/usr/bin/env node

const https = require('https');

console.log('🔧 Vercel权限问题解决方案');
console.log('============================\n');

console.log('📋 问题诊断：');
console.log('- Vercel部署失败是因为权限问题');
console.log('- dev@researchopia.com 不是团队成员');
console.log('- 需要从正确的Vercel账户重新部署\n');

console.log('✅ 解决方案：');
console.log('1. 访问 Vercel 仪表板');
console.log('2. 找到 researchopia 项目');
console.log('3. 手动触发重新部署');
console.log('4. 或者重新连接GitHub仓库\n');

console.log('🔗 具体操作步骤：');
console.log('步骤1: 打开 https://vercel.com/dashboard');
console.log('步骤2: 找到 "researchopia" 项目');
console.log('步骤3: 点击项目进入详情页');
console.log('步骤4: 在 Deployments 标签页点击 "Redeploy"');
console.log('步骤5: 选择最新的 commit 重新部署\n');

console.log('🔄 或者重新连接GitHub：');
console.log('步骤1: 在项目设置中找到 Git Integration');
console.log('步骤2: 重新连接GitHub仓库');
console.log('步骤3: 确保部署分支设置为 main\n');

// 检查当前在线状态
console.log('🔍 检查当前在线状态...');
https.get('https://academic-rating.vercel.app/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (data.includes('研学港 Researchopia')) {
      console.log('✅ 在线版本已更新！显示正确内容');
    } else if (data.includes('学术评价平台')) {
      console.log('❌ 在线版本仍显示旧内容，需要手动重新部署');
    } else {
      console.log('⚠️ 网站可能存在其他问题');
    }
    
    console.log('\n📱 验证地址：');
    console.log('- 本地开发: http://localhost:3000 ✅');
    console.log('- 在线生产: https://academic-rating.vercel.app/');
    console.log('\n操作完成后，请等待2-3分钟让部署生效。');
  });
}).on('error', (err) => {
  console.log('⚠️ 网络检查失败:', err.message);
  console.log('请手动访问 https://academic-rating.vercel.app/ 检查状态');
});
