const chokidar = require('chokidar');
const { build, config } = require('./build-script');
const fs = require('fs-extra');
const path = require('path');

// 从环境变量读取配置
require('dotenv').config();

console.log('🔍 环境变量调试:');
console.log('ZOTERO_PATH:', process.env.ZOTERO_PATH);
console.log('ZOTERO_PROFILE_PATH:', process.env.ZOTERO_PROFILE_PATH);

const zoteroConfig = {
  // 从环境变量读取Zotero程序路径
  zoteroPath: process.env.ZOTERO_PATH || 'D:\\Program Files\\Zotero\\zotero.exe',

  // 从环境变量读取配置文件夹路径
  profilePath: process.env.ZOTERO_PROFILE_PATH || 'C:\\Users\\Bo Feng\\AppData\\Roaming\\Zotero\\Zotero\\Profiles\\k9onzs9v.dev4',

  // 插件安装目录
  extensionsPath: null // 将在初始化时设置
};

// 初始化配置
function initConfig() {
  console.log('🔧 配置信息:');
  console.log(`   Zotero路径: ${zoteroConfig.zoteroPath}`);
  console.log(`   配置文件路径: ${zoteroConfig.profilePath}`);

  if (!zoteroConfig.extensionsPath) {
    zoteroConfig.extensionsPath = path.join(zoteroConfig.profilePath, 'extensions');
  }

  console.log(`   扩展目录: ${zoteroConfig.extensionsPath}`);
}

// 安装插件到Zotero
async function installToZotero() {
  try {
    initConfig();
    
    const buildPath = path.resolve(config.buildDir);
    const pluginId = 'researchopia@zotero.plugin';
    const installPath = path.join(zoteroConfig.extensionsPath, pluginId);
    
    console.log('📦 安装插件到Zotero...');
    console.log(`   源目录: ${buildPath}`);
    console.log(`   目标目录: ${installPath}`);
    
    // 确保扩展目录存在
    await fs.ensureDir(zoteroConfig.extensionsPath);
    
    // 删除旧版本
    if (await fs.pathExists(installPath)) {
      await fs.remove(installPath);
    }
    
    // 复制新版本
    await fs.copy(buildPath, installPath);
    
    console.log('✅ 插件安装完成！');
    return true;
    
  } catch (error) {
    console.error('❌ 安装插件失败:', error);
    return false;
  }
}

// 重启Zotero（可选）
async function restartZotero() {
  console.log('🔄 提示：请手动重启Zotero以加载更新的插件');
  // 注意：自动重启Zotero可能会导致数据丢失，所以这里只是提示
}

// 主监视函数
async function startWatching() {
  console.log('👀 开始监视文件变化...');
  console.log('📁 监视的文件和目录:');
  config.sourceFiles.forEach(file => {
    console.log(`   - ${file}`);
  });
  console.log('');
  
  // 初始构建
  console.log('🔨 执行初始构建...');
  await build();
  await installToZotero();
  
  // 创建文件监视器
  const watcher = chokidar.watch(config.sourceFiles, {
    ignored: /(^|[\/\\])\../, // 忽略隐藏文件
    persistent: true,
    ignoreInitial: true
  });
  
  let isBuilding = false;
  
  // 防抖函数
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // 重新构建和安装
  const rebuildAndInstall = debounce(async () => {
    if (isBuilding) return;
    
    isBuilding = true;
    console.log('\n🔄 检测到文件变化，重新构建...');
    
    try {
      await build();
      await installToZotero();
      console.log('✅ 热重载完成！插件已更新');
      console.log('💡 提示：在Zotero中按 Ctrl+Shift+Alt+R 重新加载插件\n');
    } catch (error) {
      console.error('❌ 热重载失败:', error);
    } finally {
      isBuilding = false;
    }
  }, 1000); // 1秒防抖
  
  // 监听文件变化
  watcher
    .on('change', (filePath) => {
      console.log(`📝 文件已修改: ${filePath}`);
      rebuildAndInstall();
    })
    .on('add', (filePath) => {
      console.log(`➕ 文件已添加: ${filePath}`);
      rebuildAndInstall();
    })
    .on('unlink', (filePath) => {
      console.log(`🗑️  文件已删除: ${filePath}`);
      rebuildAndInstall();
    })
    .on('error', (error) => {
      console.error('❌ 监视器错误:', error);
    });
  
  console.log('🚀 自动热重载已启动！');
  console.log('💡 修改源文件后，插件将自动重新构建和安装');
  console.log('⏹️  按 Ctrl+C 停止监视\n');
}

// 启动监视
if (require.main === module) {
  startWatching().catch(console.error);
}

module.exports = { startWatching, installToZotero };
