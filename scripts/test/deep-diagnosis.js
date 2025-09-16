#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

console.log('🔍 深度诊断研学港部署问题');
console.log('==============================\n');

async function deepDiagnosis() {
  try {
    // 1. 检查本地文件
    console.log('1. 📁 检查关键文件内容:');
    
    // 检查主页面文件
    const pageContent = fs.readFileSync('src/app/page.tsx', 'utf8');
    const hasResearchopia = pageContent.includes('研学港 Researchopia');
    console.log(`   主页面包含"研学港 Researchopia": ${hasResearchopia ? '✅' : '❌'}`);
    
    if (hasResearchopia) {
      const lines = pageContent.split('\n');
      const researchopiaLine = lines.find(line => line.includes('研学港 Researchopia'));
      console.log(`   位置: ${researchopiaLine?.trim()}`);
    }
    
    // 检查package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`   package.json名称: ${packageJson.name}`);
    
    // 2. 检查Git状态
    console.log('\n2. 📊 Git状态检查:');
    const gitStatus = await execAsync('git status --porcelain');
    const gitLog = await execAsync('git log --oneline -3');
    const gitRemote = await execAsync('git remote -v');
    
    console.log('   工作区状态:', gitStatus.stdout.trim() || '干净');
    console.log('   最近提交:');
    console.log(gitLog.stdout.split('\n').map(line => `     ${line}`).join('\n'));
    console.log('   远程仓库:');
    console.log(gitRemote.stdout.split('\n').map(line => `     ${line}`).join('\n'));
    
    // 3. 检查Vercel配置
    console.log('\n3. ⚙️ Vercel配置检查:');
    if (fs.existsSync('.vercel/project.json')) {
      const vercelConfig = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
      console.log(`   项目ID: ${vercelConfig.projectId}`);
      console.log(`   项目名: ${vercelConfig.projectName}`);
      console.log(`   组织ID: ${vercelConfig.orgId}`);
    } else {
      console.log('   ❌ .vercel/project.json 不存在');
    }
    
    // 4. 检查在线内容
    console.log('\n4. 🌐 在线内容检查:');
    try {
      const webContent = await new Promise((resolve, reject) => {
        https.get('https://academic-rating.vercel.app/', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
      
      const onlineHasResearchopia = webContent.includes('研学港 Researchopia');
      const onlineHasOldBrand = webContent.includes('学术评价平台');
      
      console.log(`   包含"研学港 Researchopia": ${onlineHasResearchopia ? '✅' : '❌'}`);
      console.log(`   包含旧品牌"学术评价平台": ${onlineHasOldBrand ? '❌' : '✅'}`);
      
      // 检查HTML标题
      const titleMatch = webContent.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) {
        console.log(`   页面标题: ${titleMatch[1]}`);
      }
      
      // 检查是否是缓存问题
      const cacheHeaders = ['cache-control', 'etag', 'last-modified'];
      console.log('   可能的缓存问题检查...');
      
    } catch (error) {
      console.log(`   ❌ 网络请求失败: ${error.message}`);
    }
    
    // 5. 构建检查
    console.log('\n5. 🔨 构建检查:');
    if (fs.existsSync('.next')) {
      console.log('   ✅ .next 目录存在');
      const buildInfo = fs.existsSync('.next/BUILD_ID');
      console.log(`   构建ID文件: ${buildInfo ? '✅' : '❌'}`);
    } else {
      console.log('   ❌ .next 目录不存在，需要运行 npm run build');
    }
    
    // 6. 给出具体建议
    console.log('\n6. 💡 建议的解决步骤:');
    console.log('   A. 确保代码已推送: git push origin main --force');
    console.log('   B. 在Vercel仪表板手动重新部署');
    console.log('   C. 检查Vercel构建日志是否有错误');
    console.log('   D. 清除浏览器和CDN缓存');
    console.log('   E. 考虑重新连接GitHub仓库');
    
  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error.message);
  }
}

deepDiagnosis();
