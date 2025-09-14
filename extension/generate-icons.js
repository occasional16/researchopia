// 生成研学港扩展图标的脚本
// 由于没有专门的SVG到PNG转换库，我们创建一个简单的HTML页面来手动转换

const fs = require('fs');
const path = require('path');

// 创建一个HTML工具页面用于转换SVG到PNG
const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>研学港图标转换工具</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', sans-serif;
            padding: 20px;
            background: #f5f5f5;
        }
        .icon-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin: 10px;
            display: inline-block;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .icon-preview {
            margin: 10px;
            background: #f0f0f0;
            padding: 20px;
            border-radius: 4px;
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover {
            background: #5a67d8;
        }
        .instructions {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <h1>🎨 研学港扩展图标生成工具</h1>
    
    <div class="instructions">
        <h3>📋 使用说明：</h3>
        <ol>
            <li>右键点击下面的每个图标</li>
            <li>选择"另存为图片"</li>
            <li>保存为对应尺寸的PNG文件：icon16.png, icon32.png, icon48.png, icon128.png</li>
            <li>将文件移动到扩展的icons文件夹中</li>
        </ol>
    </div>

    <div class="icon-container">
        <h3>16x16 图标</h3>
        <div class="icon-preview">
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad16" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="16" height="16" rx="3" fill="url(#grad16)"/>
                <text x="8" y="11.5" font-family="'Microsoft YaHei', Arial, sans-serif" 
                      font-size="9" font-weight="bold" text-anchor="middle" fill="white">研</text>
            </svg>
        </div>
        <p>文件名: icon16.png</p>
    </div>

    <div class="icon-container">
        <h3>32x32 图标</h3>
        <div class="icon-preview">
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad32" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="32" height="32" rx="6" fill="url(#grad32)"/>
                <text x="16" y="22" font-family="'Microsoft YaHei', Arial, sans-serif" 
                      font-size="18" font-weight="bold" text-anchor="middle" fill="white">研</text>
            </svg>
        </div>
        <p>文件名: icon32.png</p>
    </div>

    <div class="icon-container">
        <h3>48x48 图标</h3>
        <div class="icon-preview">
            <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad48" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="48" height="48" rx="9" fill="url(#grad48)"/>
                <text x="24" y="33" font-family="'Microsoft YaHei', Arial, sans-serif" 
                      font-size="26" font-weight="bold" text-anchor="middle" fill="white">研</text>
            </svg>
        </div>
        <p>文件名: icon48.png</p>
    </div>

    <div class="icon-container">
        <h3>128x128 图标</h3>
        <div class="icon-preview">
            <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad128" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                    </linearGradient>
                    <filter id="shadow">
                        <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
                    </filter>
                </defs>
                <rect width="128" height="128" rx="20" fill="url(#grad128)" filter="url(#shadow)"/>
                <text x="64" y="85" font-family="'Microsoft YaHei', Arial, sans-serif" 
                      font-size="70" font-weight="bold" text-anchor="middle" fill="white">研</text>
            </svg>
        </div>
        <p>文件名: icon128.png</p>
    </div>

    <script>
        // 添加右键菜单提示
        document.addEventListener('contextmenu', function(e) {
            if (e.target.tagName === 'svg' || e.target.closest('svg')) {
                console.log('请选择"另存为图片"来保存图标');
            }
        });
    </script>
</body>
</html>
`;

// 写入HTML文件
fs.writeFileSync(path.join(__dirname, 'generate-icons.html'), htmlContent);
console.log('✅ 图标生成工具已创建: generate-icons.html');
console.log('📋 请在浏览器中打开此文件，按照说明生成PNG图标');