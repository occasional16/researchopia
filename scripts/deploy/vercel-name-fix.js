#!/usr/bin/env node

console.log('🔍 Vercel项目名称不匹配问题诊断');
console.log('=====================================\n');

console.log('📋 发现的问题：');
console.log('- package.json项目名称: researchopia');
console.log('- Vercel项目名称: academic-rating');
console.log('- 这种不匹配可能导致部署问题\n');

console.log('🔧 解决方案（按推荐顺序）：\n');

console.log('方案1: 在Vercel中重命名项目（推荐）');
console.log('1. 访问 https://vercel.com/dashboard');
console.log('2. 找到 "academic-rating" 项目');
console.log('3. 进入项目 Settings');
console.log('4. 在 General 设置中找到 "Project Name"');
console.log('5. 将项目名称改为 "researchopia"');
console.log('6. 保存更改');
console.log('7. 手动触发重新部署\n');

console.log('方案2: 更新package.json匹配Vercel');
console.log('1. 将package.json中的name改回"academic-rating"');
console.log('2. 保持与Vercel项目名称一致\n');

console.log('方案3: 重新创建Vercel项目');
console.log('1. 删除当前的academic-rating项目');
console.log('2. 重新导入GitHub仓库');
console.log('3. 使用"researchopia"作为项目名称\n');

console.log('🎯 推荐方案1，因为：');
console.log('- 保持代码中的新品牌名称');
console.log('- 不需要重新配置环境变量');
console.log('- 保持部署历史记录\n');

console.log('📱 验证步骤：');
console.log('完成重命名后，访问新的URL：');
console.log('- 新URL可能是: https://researchopia.vercel.app/');
console.log('- 或保持原URL: https://academic-rating.vercel.app/\n');

const fs = require('fs');

// 检查是否需要更新本地配置
console.log('🔄 检查本地配置文件...');
const vercelConfig = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
console.log(`当前Vercel项目ID: ${vercelConfig.projectId}`);
console.log(`当前Vercel项目名: ${vercelConfig.projectName}`);

if (vercelConfig.projectName !== 'researchopia') {
  console.log('\n⚠️ 建议更新本地Vercel配置以匹配新项目名称');
}

console.log('\n✨ 操作完成后，部署应该能正常工作！');
