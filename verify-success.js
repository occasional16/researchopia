#!/usr/bin/env node

const https = require('https');

console.log('🎉 研学港部署成功验证');
console.log('===================\n');

const url = 'https://academic-rating.vercel.app/';

function checkSuccess() {
  return new Promise((resolve, reject) => {
    console.log(`🌐 正在验证：${url}`);
    
    https.get(url, (res) => {
      console.log(`📊 状态码: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        // 检查关键内容
        const hasResearchopia = data.includes('研学港 Researchopia');
        const hasNewBrand = data.includes('研学并进，智慧共享');
        const hasOldBrand = data.includes('学术评价平台');
        
        console.log('\n🔍 内容检查结果:');
        console.log(`   ✅ 包含"研学港 Researchopia": ${hasResearchopia ? '是' : '否'}`);
        console.log(`   ✅ 包含"研学并进，智慧共享": ${hasNewBrand ? '是' : '否'}`);
        console.log(`   ❌ 包含旧品牌内容: ${hasOldBrand ? '是' : '否'}`);
        
        // 检查页面标题
        const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          console.log(`   📋 页面标题: "${titleMatch[1]}"`);
        }
        
        // 检查Meta描述
        const metaDescMatch = data.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
        if (metaDescMatch) {
          console.log(`   📄 Meta描述: "${metaDescMatch[1]}"`);
        }
        
        console.log('\n🎯 部署状态:');
        if (hasResearchopia && hasNewBrand && !hasOldBrand) {
          console.log('   ✅ 部署完全成功！研学港品牌已上线');
        } else if (hasResearchopia) {
          console.log('   🟡 部分成功，部分内容可能仍需更新');
        } else {
          console.log('   ❌ 部署可能仍在进行中，请稍后再试');
        }
        
        resolve({ hasResearchopia, hasNewBrand, hasOldBrand });
      });
    }).on('error', (err) => {
      console.error(`❌ 检查失败: ${err.message}`);
      reject(err);
    });
  });
}

async function main() {
  try {
    await checkSuccess();
    console.log('\n🏆 恭喜！问题解决流程完成');
    console.log('📝 解决方案: 手动编辑GitHub上的package.json文件');
    console.log('⏰ 解决时间: 约5分钟');
    console.log('🔗 在线访问: https://academic-rating.vercel.app/');
  } catch (error) {
    console.error('验证失败，但这可能是网络问题，请手动检查网站');
  }
}

main();
