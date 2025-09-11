#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function forceDeploy() {
  console.log('🚀 强制部署研学港到生产环境');
  console.log('===============================\n');

  try {
    // 1. 检查本地内容
    console.log('1. 检查本地内容...');
    const fs = require('fs');
    const pageContent = fs.readFileSync('src/app/page.tsx', 'utf8');
    if (pageContent.includes('研学港 Researchopia')) {
      console.log('✅ 本地文件包含正确内容');
    } else {
      console.log('❌ 本地文件内容不正确');
      return;
    }

    // 2. Git操作
    console.log('\n2. 执行Git操作...');
    
    await execAsync('git add .');
    console.log('✅ Git add 完成');
    
    const commitMsg = `🚀 强制部署研学港品牌 ${new Date().toISOString()}`;
    await execAsync(`git commit -m "${commitMsg}" --allow-empty`);
    console.log('✅ Git commit 完成');
    
    await execAsync('git push origin main --force');
    console.log('✅ Git push 完成');

    // 3. 触发Vercel部署
    console.log('\n3. 触发Vercel部署...');
    const https = require('https');
    
    const deployPromise = new Promise((resolve, reject) => {
      const req = https.request('https://api.vercel.com/v1/integrations/deploy/prj_QAnIf9vaj6vfTbZBisI3yr6UB5d3/7UrWOe4H6t', {
        method: 'POST'
      }, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });

    const statusCode = await deployPromise;
    console.log(`✅ Vercel部署触发完成 (状态码: ${statusCode})`);

    // 4. 等待部署完成
    console.log('\n4. 等待部署完成...');
    console.log('这可能需要2-5分钟...');
    
    // 每30秒检查一次
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      try {
        const checkResult = await new Promise((resolve, reject) => {
          https.get('https://academic-rating.vercel.app/', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
          }).on('error', reject);
        });

        if (checkResult.includes('研学港 Researchopia')) {
          console.log(`🎉 部署成功! (第${i + 1}次检查)`);
          console.log('✅ 在线版本已更新: https://academic-rating.vercel.app/');
          return;
        } else {
          console.log(`⏳ 第${i + 1}次检查: 仍在部署中...`);
        }
      } catch (error) {
        console.log(`⚠️ 第${i + 1}次检查失败:`, error.message);
      }
    }

    console.log('⏳ 部署可能还在进行中，请稍后手动检查');
    console.log('📱 访问: https://academic-rating.vercel.app/');

  } catch (error) {
    console.error('❌ 部署失败:', error.message);
  }
}

forceDeploy();
