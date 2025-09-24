const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

async function installNewPlugin() {
  console.log('🔍 环境变量调试:');
  console.log('ZOTERO_PROFILE_PATH:', process.env.ZOTERO_PROFILE_PATH);
  
  const profilePath = process.env.ZOTERO_PROFILE_PATH;
  if (!profilePath) {
    throw new Error('ZOTERO_PROFILE_PATH 环境变量未设置');
  }
  
  const extensionsDir = path.join(profilePath, 'extensions');
  const pluginId = 'researchopia@zotero.plugin';
  const targetDir = path.join(extensionsDir, pluginId);
  const sourceDir = path.join(__dirname, 'build-new');
  
  console.log('🔧 配置信息:');
  console.log('   配置文件路径:', profilePath);
  console.log('   扩展目录:', extensionsDir);
  console.log('   源目录:', sourceDir);
  console.log('   目标目录:', targetDir);
  
  try {
    // 确保扩展目录存在
    await fs.ensureDir(extensionsDir);
    
    // 删除旧版本
    if (await fs.pathExists(targetDir)) {
      console.log('🗑️ 删除旧版本...');
      await fs.remove(targetDir);
    }
    
    // 复制新版本
    console.log('📦 安装新版本插件到Zotero...');
    await fs.copy(sourceDir, targetDir);
    
    console.log('✅ 新版本插件安装完成！');
    console.log('');
    console.log('🚀 下一步:');
    console.log('1. 完全关闭Zotero');
    console.log('2. 重新启动Zotero');
    console.log('3. 选择有DOI的文献');
    console.log('4. 查看调试日志');
    
  } catch (error) {
    console.error('❌ 安装失败:', error.message);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  installNewPlugin().catch(console.error);
}

module.exports = { installNewPlugin };
