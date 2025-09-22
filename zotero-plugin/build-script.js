const fs = require('fs-extra');
const path = require('path');

// 配置
const config = {
  sourceFiles: [
    'manifest.json',
    'bootstrap.js',
    'content'
  ],
  buildDir: 'build',
  xpiName: 'researchopia.xpi'
};

async function build() {
  try {
    console.log('🔨 开始构建插件...');
    
    // 确保构建目录存在
    await fs.ensureDir(config.buildDir);
    
    // 复制文件
    for (const file of config.sourceFiles) {
      if (await fs.pathExists(file)) {
        const destPath = path.join(config.buildDir, path.basename(file));
        try {
          await fs.copy(file, destPath, { overwrite: true });
          console.log(`✅ 复制: ${file} -> ${destPath}`);
        } catch (error) {
          console.log(`⚠️  复制失败 ${file}: ${error.message}`);
          // 尝试删除目标文件后重新复制
          try {
            if (await fs.pathExists(destPath)) {
              await fs.remove(destPath);
            }
            await fs.copy(file, destPath);
            console.log(`✅ 重试成功: ${file} -> ${destPath}`);
          } catch (retryError) {
            console.log(`❌ 重试失败 ${file}: ${retryError.message}`);
          }
        }
      } else {
        console.log(`⚠️  文件不存在: ${file}`);
      }
    }
    
    // 文件已经是正确的名称，无需重命名
    
    console.log('✅ 构建完成！');
    console.log(`📁 构建目录: ${config.buildDir}`);
    
  } catch (error) {
    console.error('❌ 构建失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  build();
}

module.exports = { build, config };
