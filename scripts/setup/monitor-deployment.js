#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

console.log('🚀 研学港部署状态监控');
console.log('========================\n');

// 检查本地文件内容
console.log('1. 检查本地文件内容...');
const pageFile = 'src/app/page.tsx';
if (fs.existsSync(pageFile)) {
  const content = fs.readFileSync(pageFile, 'utf8');
  const hasResearchopia = content.includes('研学港 Researchopia');
  console.log(`   本地页面包含"研学港 Researchopia": ${hasResearchopia ? '✅' : '❌'}`);
} else {
  console.log('   ❌ 本地页面文件不存在');
}

// 检查在线内容
console.log('\n2. 检查在线内容...');
const url = 'https://academic-rating.vercel.app/';

const checkOnlineContent = () => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const hasResearchopia = data.includes('研学港 Researchopia');
        const hasOldBrand = data.includes('学术评价平台');
        
        console.log(`   在线版本包含"研学港 Researchopia": ${hasResearchopia ? '✅' : '❌'}`);
        console.log(`   在线版本包含旧品牌"学术评价平台": ${hasOldBrand ? '❌' : '✅'}`);
        
        resolve({ hasResearchopia, hasOldBrand });
      });
    }).on('error', reject);
  });
};

// 部署状态检查函数
const checkDeploymentStatus = async (retries = 3) => {
  console.log('\n3. 等待部署完成...');
  
  for (let i = 0; i < retries; i++) {
    try {
      const result = await checkOnlineContent();
      
      if (result.hasResearchopia && !result.hasOldBrand) {
        console.log('\n🎉 部署成功！在线版本已更新');
        return true;
      }
      
      if (i < retries - 1) {
        console.log(`   第${i + 1}次检查未成功，30秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    } catch (error) {
      console.log(`   检查失败: ${error.message}`);
    }
  }
  
  console.log('\n⚠️  部署可能还在进行中，请稍后手动检查');
  return false;
};

// 运行检查
checkDeploymentStatus().then(success => {
  if (success) {
    console.log('\n✅ 同步完成！访问: https://academic-rating.vercel.app/');
  } else {
    console.log('\n🔄 如果部署仍未完成，请：');
    console.log('1. 检查Vercel仪表板: https://vercel.com/dashboard');
    console.log('2. 等待5-10分钟后重新访问网站');
    console.log('3. 或手动触发重新部署');
  }
  
  console.log('\n监控结束。');
});
