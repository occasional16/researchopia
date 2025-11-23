#!/usr/bin/env node

/**
 * 文件大小监控脚本
 * 扫描项目中的TypeScript文件，检测超标文件
 * 
 * 规则:
 * - 警告 (WARNING): 300-599行
 * - 错误 (ERROR): 600+行
 * - 函数 (FUNCTION): 单函数 > 50行
 * 
 * 用法:
 * node scripts/check-file-size.js
 * npm run check:size
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  WARNING_THRESHOLD: 300,
  ERROR_THRESHOLD: 600,
  FUNCTION_THRESHOLD: 50,
  EXCLUDED_DIRS: [
    'node_modules',
    'dist',
    'build',
    '.next',
    '.scaffold',
    'addon'
  ],
  INCLUDED_EXTENSIONS: ['.ts', '.tsx'],
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * 递归扫描目录
 */
function scanDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 跳过排除的目录
      if (CONFIG.EXCLUDED_DIRS.includes(file)) {
        continue;
      }
      scanDirectory(filePath, results);
    } else if (stat.isFile()) {
      // 只检查指定扩展名
      const ext = path.extname(file);
      if (CONFIG.INCLUDED_EXTENSIONS.includes(ext)) {
        results.push(filePath);
      }
    }
  }

  return results;
}

/**
 * 计算文件行数
 */
function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // 统计非空白行
  const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;
  
  return {
    total: lines.length,
    nonEmpty: nonEmptyLines,
  };
}

/**
 * 简单检测函数行数 (基于大括号)
 */
function detectLongFunctions(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const longFunctions = [];
  let inFunction = false;
  let functionStartLine = 0;
  let functionName = '';
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 简单匹配函数声明
    const functionMatch = line.match(/(function\s+\w+|const\s+\w+\s*=.*(?:function|=>)|\w+\s*\([^)]*\)\s*{)/);
    
    if (functionMatch && !inFunction) {
      inFunction = true;
      functionStartLine = i + 1;
      functionName = line.trim().substring(0, 50);
      braceCount = 0;
    }
    
    if (inFunction) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      if (braceCount === 0 && i > functionStartLine) {
        const functionLength = i - functionStartLine + 1;
        if (functionLength > CONFIG.FUNCTION_THRESHOLD) {
          longFunctions.push({
            name: functionName,
            start: functionStartLine,
            end: i + 1,
            length: functionLength,
          });
        }
        inFunction = false;
      }
    }
  }
  
  return longFunctions;
}

/**
 * 分析单个文件
 */
function analyzeFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const lines = countLines(filePath);
  const longFunctions = detectLongFunctions(filePath);
  
  let status = 'OK';
  if (lines.total >= CONFIG.ERROR_THRESHOLD) {
    status = 'ERROR';
  } else if (lines.total >= CONFIG.WARNING_THRESHOLD) {
    status = 'WARNING';
  }
  
  return {
    path: relativePath,
    lines: lines.total,
    nonEmpty: lines.nonEmpty,
    status,
    longFunctions,
  };
}

/**
 * 生成报告
 */
function generateReport(results) {
  const errors = results.filter(r => r.status === 'ERROR');
  const warnings = results.filter(r => r.status === 'WARNING');
  const ok = results.filter(r => r.status === 'OK');
  
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.blue}📊 文件大小检查报告${colors.reset}`);
  console.log('='.repeat(80));
  
  console.log(`\n总计: ${results.length} 个文件`);
  console.log(`${colors.green}✅ 正常: ${ok.length}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  警告: ${warnings.length}${colors.reset}`);
  console.log(`${colors.red}❌ 错误: ${errors.length}${colors.reset}`);
  
  // 显示错误
  if (errors.length > 0) {
    console.log(`\n${colors.red}❌ 超标文件 (>= ${CONFIG.ERROR_THRESHOLD}行):${colors.reset}`);
    errors.sort((a, b) => b.lines - a.lines);
    for (const file of errors) {
      console.log(`  ${file.lines} 行 - ${file.path}`);
      
      if (file.longFunctions.length > 0) {
        console.log(`    ${colors.gray}└─ ${file.longFunctions.length} 个长函数:${colors.reset}`);
        for (const func of file.longFunctions.slice(0, 3)) {
          console.log(`       ${colors.gray}L${func.start}-${func.end} (${func.length}行): ${func.name}${colors.reset}`);
        }
      }
    }
  }
  
  // 显示警告
  if (warnings.length > 0) {
    console.log(`\n${colors.yellow}⚠️  警告文件 (${CONFIG.WARNING_THRESHOLD}-${CONFIG.ERROR_THRESHOLD - 1}行):${colors.reset}`);
    warnings.sort((a, b) => b.lines - a.lines);
    for (const file of warnings.slice(0, 10)) {
      console.log(`  ${file.lines} 行 - ${file.path}`);
    }
    if (warnings.length > 10) {
      console.log(`  ${colors.gray}... 还有 ${warnings.length - 10} 个警告文件${colors.reset}`);
    }
  }
  
  // 统计信息
  const totalLines = results.reduce((sum, r) => sum + r.lines, 0);
  const avgLines = Math.round(totalLines / results.length);
  
  console.log(`\n${colors.blue}📈 统计信息:${colors.reset}`);
  console.log(`  总行数: ${totalLines.toLocaleString()}`);
  console.log(`  平均行数: ${avgLines}`);
  console.log(`  最大文件: ${Math.max(...results.map(r => r.lines))} 行`);
  console.log(`  最小文件: ${Math.min(...results.map(r => r.lines))} 行`);
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  return {
    total: results.length,
    errors: errors.length,
    warnings: warnings.length,
    ok: ok.length,
  };
}

/**
 * 主函数
 */
function main() {
  console.log(`${colors.blue}🔍 开始扫描项目文件...${colors.reset}\n`);
  
  const startTime = Date.now();
  
  // 扫描主要目录
  const directories = [
    'src',
    'zotero-plugin/src',
    'extension/src',
  ].filter(dir => fs.existsSync(dir));
  
  let allFiles = [];
  for (const dir of directories) {
    console.log(`${colors.gray}扫描: ${dir}${colors.reset}`);
    const files = scanDirectory(dir);
    allFiles = allFiles.concat(files);
  }
  
  console.log(`\n找到 ${allFiles.length} 个文件\n`);
  
  // 分析所有文件
  const results = allFiles.map(analyzeFile);
  
  // 生成报告
  const summary = generateReport(results);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`${colors.gray}检查完成，耗时 ${duration}秒${colors.reset}\n`);
  
  // 退出码
  if (summary.errors > 0) {
    console.log(`${colors.red}❌ 发现 ${summary.errors} 个超标文件，请立即重构！${colors.reset}`);
    process.exit(1);
  } else if (summary.warnings > 0) {
    console.log(`${colors.yellow}⚠️  发现 ${summary.warnings} 个警告文件，建议优化${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.green}✅ 所有文件符合规范！${colors.reset}`);
    process.exit(0);
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { scanDirectory, analyzeFile, generateReport };
