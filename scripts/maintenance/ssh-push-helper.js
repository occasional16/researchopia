#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

console.log('🔐 SSH Git 推送助手');
console.log('==================\n');

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupSSHAndPush() {
  try {
    console.log('1. 检查当前目录和Git状态...');
    
    // 检查Git远程配置
    console.log('2. 当前Git远程配置:');
    const { execSync } = require('child_process');
    
    try {
      const remotes = execSync('git remote -v', { encoding: 'utf8', cwd: __dirname });
      console.log(remotes);
      
      // 如果当前不是SSH协议，切换到SSH
      if (remotes.includes('https://github.com')) {
        console.log('\n3. 切换到SSH协议...');
        execSync('git remote set-url origin git@github.com:occasional15/researchopia.git', { cwd: __dirname });
        console.log('   ✅ 已切换到SSH协议');
      } else {
        console.log('\n3. 已经是SSH协议');
      }
      
    } catch (error) {
      console.log('   Git检查失败:', error.message);
    }
    
    console.log('\n4. 尝试SSH连接测试...');
    
    // 创建子进程进行SSH测试
    const sshTest = spawn('ssh', ['-T', 'git@github.com'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let sshOutput = '';
    let needsVerification = false;
    
    sshTest.stdout.on('data', (data) => {
      const output = data.toString();
      sshOutput += output;
      console.log('SSH输出:', output);
    });
    
    sshTest.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('SSH信息:', output);
      
      if (output.includes('authenticity of host')) {
        needsVerification = true;
        console.log('\n⚠️  需要确认SSH指纹！');
        console.log('请输入 "yes" 确认连接:');
        
        // 等待用户输入
        rl.question('输入 yes 继续: ', (answer) => {
          if (answer.toLowerCase() === 'yes') {
            sshTest.stdin.write('yes\n');
          }
        });
      }
    });
    
    sshTest.on('close', (code) => {
      console.log(`\nSSH测试完成，退出码: ${code}`);
      
      if (!needsVerification || code === 1) {
        console.log('\n5. 开始Git推送...');
        startGitPush();
      }
    });
    
  } catch (error) {
    console.error('设置失败:', error.message);
  }
}

function startGitPush() {
  console.log('执行: git push origin main --force');
  
  const gitPush = spawn('git', ['push', 'origin', 'main', '--force'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });
  
  gitPush.stdout.on('data', (data) => {
    console.log('推送输出:', data.toString());
  });
  
  gitPush.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('推送信息:', output);
    
    if (output.includes('authenticity of host')) {
      console.log('\n⚠️  Git推送需要确认SSH指纹！');
      console.log('请输入 "yes":');
      
      rl.question('输入 yes: ', (answer) => {
        if (answer.toLowerCase() === 'yes') {
          gitPush.stdin.write('yes\n');
        }
      });
    }
  });
  
  gitPush.on('close', (code) => {
    console.log(`\n推送完成！退出码: ${code}`);
    if (code === 0) {
      console.log('🎉 推送成功！');
    } else {
      console.log('❌ 推送失败');
    }
    rl.close();
  });
}

// 启动设置流程
setupSSHAndPush();
