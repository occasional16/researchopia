#!/usr/bin/env node

/**
 * 🔄 版本同步脚本 - 将本地最新版本部署到Vercel
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

console.log('🔄 学术评价平台 - 版本同步工具\n');

async function main() {
  try {
    console.log('📋 1. 检查当前Git状态...');
    const { stdout: gitStatus } = await execAsync('git status --porcelain');
    
    if (gitStatus.trim()) {
      console.log('📝 发现未提交的更改:');
      console.log(gitStatus);
      
      console.log('\n📋 2. 提交所有更改...');
      await execAsync('git add .');
      await execAsync('git commit -m "同步最新版本到生产环境 - ' + new Date().toISOString() + '"');
      console.log('✅ 更改已提交');
    } else {
      console.log('✅ 所有更改已提交');
    }
    
    console.log('\n📋 3. 测试本地构建...');
    try {
      await execAsync('npm run build');
      console.log('✅ 本地构建成功');
    } catch (buildError) {
      console.error('❌ 构建失败:', buildError.message);
      process.exit(1);
    }
    
    console.log('\n📋 4. 检查Vercel CLI...');
    try {
      await execAsync('vercel --version');
      console.log('✅ Vercel CLI 可用');
    } catch (error) {
      console.log('📦 安装Vercel CLI...');
      await execAsync('npm install -g vercel');
    }
    
    console.log('\n🚀 5. 部署到Vercel生产环境...');
    console.log('这可能需要几分钟时间...');
    
    try {
      const { stdout: deployOutput } = await execAsync('vercel --prod --yes');
      console.log('✅ 部署成功!');
      console.log('\n📊 部署信息:');
      console.log(deployOutput);
      
      // 提取部署URL
      const urlMatch = deployOutput.match(/https:\/\/[^\s]+/);
      if (urlMatch) {
        const deployUrl = urlMatch[0];
        console.log(`\n🌐 新的生产URL: ${deployUrl}`);
        console.log('🎯 请访问上述URL验证最新版本');
      }
      
    } catch (deployError) {
      console.error('❌ 部署失败:', deployError.message);
      console.log('\n💡 备选方案:');
      console.log('1. 访问 https://vercel.com/dashboard');
      console.log('2. 找到 academic-rating 项目');
      console.log('3. 点击 "Redeploy" 按钮');
      console.log('4. 选择 "Use existing Build Cache: No"');
      console.log('5. 点击确认部署');
    }
    
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
  }
}

console.log('🎯 目标: 同步本地最新版本到线上环境');
console.log('📍 当前目录:', process.cwd());
console.log('⏰ 开始时间:', new Date().toLocaleString());
console.log('=' .repeat(50));

main().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('⏰ 完成时间:', new Date().toLocaleString());
  console.log('🎉 版本同步脚本执行完成!');
}).catch(console.error);
