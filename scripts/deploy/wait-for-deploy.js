#!/usr/bin/env node

const https = require('https');

console.log('⏳ 等待Vercel部署完成...');
console.log('已修复项目名称不匹配问题\n');

let checkCount = 0;
const maxChecks = 6; // 6次检查，每次30秒

function checkDeployment() {
  checkCount++;
  console.log(`🔍 第${checkCount}次检查 (${new Date().toLocaleTimeString()})...`);
  
  https.get('https://academic-rating.vercel.app/', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (data.includes('研学港 Researchopia')) {
        console.log('🎉 成功！在线版本已更新！');
        console.log('✅ 显示正确的"研学港 Researchopia"品牌');
        console.log('🔗 访问: https://academic-rating.vercel.app/');
        process.exit(0);
      } else if (data.includes('学术评价平台')) {
        console.log('⏳ 仍显示旧版本，继续等待...');
      } else {
        console.log('⚠️ 网站返回异常内容');
      }
      
      if (checkCount < maxChecks) {
        setTimeout(checkDeployment, 30000); // 30秒后重试
      } else {
        console.log('\n⏰ 检查超时');
        console.log('请手动访问 https://academic-rating.vercel.app/ 确认状态');
        console.log('如果仍未更新，请在Vercel仪表板手动重新部署');
      }
    });
  }).on('error', (err) => {
    console.log(`❌ 网络错误: ${err.message}`);
    if (checkCount < maxChecks) {
      setTimeout(checkDeployment, 30000);
    }
  });
}

// 立即开始第一次检查
checkDeployment();
