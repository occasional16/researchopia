#!/usr/bin/env node

/**
 * 研学港浏览器扩展 - 安装验证脚本
 * 用于检查扩展文件完整性和配置正确性
 */

const fs = require('fs');
const path = require('path');

class ExtensionValidator {
  constructor() {
    this.extensionDir = __dirname;
    this.errors = [];
    this.warnings = [];
    this.validate();
  }

  validate() {
    console.log('🔍 研学港扩展安装验证开始...\n');
    
    this.checkRequiredFiles();
    this.validateManifest();
    this.checkFileContents();
    this.checkPermissions();
    
    this.printResults();
  }

  checkRequiredFiles() {
    console.log('📁 检查必需文件...');
    
    const requiredFiles = [
      'manifest.json',
      'popup.html',
      'popup.js',
      'background.js',
      'content.js',
      'content.css',
      'README.md',
      'INSTALL.md',
      'welcome.html'
    ];

    const requiredDirs = [
      'icons'
    ];

    // 检查文件
    requiredFiles.forEach(file => {
      const filePath = path.join(this.extensionDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
      } else {
        this.errors.push(`缺少必需文件: ${file}`);
        console.log(`  ❌ ${file} - 缺失`);
      }
    });

    // 检查目录
    requiredDirs.forEach(dir => {
      const dirPath = path.join(this.extensionDir, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        console.log(`  ✅ ${dir}/`);
      } else {
        this.errors.push(`缺少必需目录: ${dir}`);
        console.log(`  ❌ ${dir}/ - 缺失`);
      }
    });
  }

  validateManifest() {
    console.log('\n📋 验证 manifest.json...');
    
    try {
      const manifestPath = path.join(this.extensionDir, 'manifest.json');
      
      if (!fs.existsSync(manifestPath)) {
        this.errors.push('manifest.json 文件不存在');
        return;
      }

      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      // 检查必需字段
      const requiredFields = [
        'manifest_version',
        'name',
        'version',
        'description',
        'permissions',
        'host_permissions',
        'content_scripts',
        'background',
        'action'
      ];

      requiredFields.forEach(field => {
        if (manifest[field]) {
          console.log(`  ✅ ${field}: ${typeof manifest[field] === 'object' ? 'OK' : manifest[field]}`);
        } else {
          this.errors.push(`manifest.json 缺少字段: ${field}`);
          console.log(`  ❌ ${field} - 缺失`);
        }
      });

      // 检查版本号
      if (manifest.version !== '0.1.0') {
        this.warnings.push(`版本号不匹配，当前: ${manifest.version}, 期望: 0.1.0`);
      }

      // 检查Manifest版本
      if (manifest.manifest_version !== 3) {
        this.errors.push(`不正确的 manifest_version: ${manifest.manifest_version}, 应为 3`);
      }

    } catch (error) {
      this.errors.push(`manifest.json 解析错误: ${error.message}`);
      console.log(`  ❌ JSON解析失败: ${error.message}`);
    }
  }

  checkFileContents() {
    console.log('\n🔍 检查文件内容...');

    // 检查关键文件的内容完整性
    const contentChecks = [
      {
        file: 'popup.js',
        checks: [
          'PopupManager',
          'detectDOI',
          'toggleFloatingIcon',
          'searchInResearchopia'
        ]
      },
      {
        file: 'content.js',
        checks: [
          'ResearchopiaContentScript',
          'detectDOI',
          'createFloatingIcon',
          'openSidebar'
        ]
      },
      {
        file: 'background.js',
        checks: [
          'BackgroundManager',
          'chrome.runtime.onInstalled',
          'chrome.tabs.onUpdated'
        ]
      }
    ];

    contentChecks.forEach(({ file, checks }) => {
      const filePath = path.join(this.extensionDir, file);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        checks.forEach(check => {
          if (content.includes(check)) {
            console.log(`  ✅ ${file}: 包含 ${check}`);
          } else {
            this.warnings.push(`${file} 可能缺少功能: ${check}`);
            console.log(`  ⚠️  ${file}: 未找到 ${check}`);
          }
        });
      }
    });
  }

  checkPermissions() {
    console.log('\n🔐 检查权限配置...');

    try {
      const manifestPath = path.join(this.extensionDir, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      const expectedPermissions = ['activeTab', 'storage', 'tabs'];
      const actualPermissions = manifest.permissions || [];

      expectedPermissions.forEach(permission => {
        if (actualPermissions.includes(permission)) {
          console.log(`  ✅ 权限 ${permission} 已配置`);
        } else {
          this.errors.push(`缺少权限: ${permission}`);
          console.log(`  ❌ 权限 ${permission} 未配置`);
        }
      });

      // 检查主机权限
      const hostPermissions = manifest.host_permissions || [];
      const expectedHosts = ['http://localhost:3000/*', 'https://*.nature.com/*'];
      
      expectedHosts.forEach(host => {
        const found = hostPermissions.some(h => h.includes(host.split('/*')[0]));
        if (found) {
          console.log(`  ✅ 主机权限包含 ${host.split('/*')[0]}`);
        } else {
          this.warnings.push(`建议添加主机权限: ${host}`);
          console.log(`  ⚠️  主机权限可能缺少 ${host}`);
        }
      });

    } catch (error) {
      this.errors.push(`权限检查失败: ${error.message}`);
    }
  }

  printResults() {
    console.log('\n📊 验证结果汇总：');
    console.log('═'.repeat(60));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 恭喜！扩展验证通过，所有检查都正常。');
      console.log('\n📝 下一步：');
      console.log('1. 在Chrome中打开 chrome://extensions/');
      console.log('2. 启用"开发者模式"');
      console.log('3. 点击"加载已解压的扩展程序"');
      console.log(`4. 选择目录: ${this.extensionDir}`);
      console.log('5. 扩展安装成功后访问学术网站进行测试');
      
    } else {
      if (this.errors.length > 0) {
        console.log('\n❌ 发现以下错误（必须修复）：');
        this.errors.forEach(error => {
          console.log(`  • ${error}`);
        });
      }

      if (this.warnings.length > 0) {
        console.log('\n⚠️  发现以下警告（建议处理）：');
        this.warnings.forEach(warning => {
          console.log(`  • ${warning}`);
        });
      }

      console.log('\n🔧 建议操作：');
      if (this.errors.length > 0) {
        console.log('• 修复上述错误后重新运行验证');
        console.log('• 检查文件是否正确创建和配置');
      }
      if (this.warnings.length > 0) {
        console.log('• 警告不影响基本功能，但建议优化');
      }
    }

    console.log('\n📚 相关文档：');
    console.log('• README.md - 详细功能介绍');
    console.log('• INSTALL.md - 安装指导');
    console.log('• test-extension.js - 功能测试');

    console.log('\n🆘 如需帮助：');
    console.log('• 查看浏览器控制台错误信息');
    console.log('• 确保研学港本地服务器运行正常');
    console.log('• 检查浏览器扩展开发者工具');

    console.log('═'.repeat(60));
    
    const totalIssues = this.errors.length + this.warnings.length;
    if (totalIssues === 0) {
      console.log('✨ 验证完成：0 个错误，0 个警告');
      process.exit(0);
    } else {
      console.log(`📋 验证完成：${this.errors.length} 个错误，${this.warnings.length} 个警告`);
      process.exit(this.errors.length > 0 ? 1 : 0);
    }
  }
}

// 运行验证
new ExtensionValidator();