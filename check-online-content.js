#!/usr/bin/env node

const https = require('https');

console.log('🔍 检查在线页面内容');
console.log('===================\n');

const url = 'https://academic-rating.vercel.app/';

function checkOnlineContent() {
  return new Promise((resolve, reject) => {
    console.log(`📡 正在访问：${url}`);
    
    https.get(url, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      console.log(`响应头: ${JSON.stringify(res.headers)}\n`);
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('📄 HTML内容分析:');
        
        // 检查标题
        const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          console.log(`   页面标题: "${titleMatch[1]}"`);
        }
        
        // 检查是否包含研学港
        const hasResearchopia = data.includes('研学港');
        const hasResearchopiaEn = data.includes('Researchopia');
        const hasOldBrand = data.includes('学术评价平台') || data.includes('Academic Rating');
        
        console.log(`   包含"研学港": ${hasResearchopia ? '✅' : '❌'}`);
        console.log(`   包含"Researchopia": ${hasResearchopiaEn ? '✅' : '❌'}`);
        console.log(`   包含旧品牌内容: ${hasOldBrand ? '⚠️' : '✅'}`);
        
        // 检查主要内容元素
        const h1Match = data.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match) {
          console.log(`   主标题(H1): "${h1Match[1]}"`);
        }
        
        // 检查页面描述
        const metaDescMatch = data.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
        if (metaDescMatch) {
          console.log(`   Meta描述: "${metaDescMatch[1]}"`);
        }
        
        // 检查是否是缓存的内容
        console.log('\n🔄 缓存和部署信息:');
        const cacheControl = res.headers['cache-control'];
        const vercelCache = res.headers['x-vercel-cache'];
        const deploymentUrl = res.headers['x-vercel-id'];
        
        console.log(`   Cache-Control: ${cacheControl || 'N/A'}`);
        console.log(`   Vercel Cache: ${vercelCache || 'N/A'}`);
        console.log(`   部署ID: ${deploymentUrl || 'N/A'}`);
        
        // 检查构建时间戳
        const buildIdMatch = data.match(/"buildId":"([^"]+)"/);
        if (buildIdMatch) {
          console.log(`   Build ID: ${buildIdMatch[1]}`);
        }
        
        // 简单内容摘要
        console.log('\n📋 内容摘要 (前300字符):');
        const textContent = data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        console.log(`   ${textContent.substring(0, 300)}...`);
        
        resolve({ hasResearchopia, hasResearchopiaEn, hasOldBrand });
      });
    }).on('error', (err) => {
      console.error(`❌ 请求失败: ${err.message}`);
      reject(err);
    });
  });
}

async function main() {
  try {
    const result = await checkOnlineContent();
    
    console.log('\n📊 总结:');
    if (result.hasResearchopia && result.hasResearchopiaEn) {
      console.log('   ✅ 页面内容已更新为新品牌');
    } else if (!result.hasResearchopia && !result.hasResearchopiaEn && result.hasOldBrand) {
      console.log('   ❌ 页面仍显示旧品牌，可能需要强制刷新缓存');
    } else {
      console.log('   ⚠️ 页面内容状态不明确，需要进一步检查');
    }
    
  } catch (error) {
    console.error('检查失败:', error.message);
  }
}

main();
