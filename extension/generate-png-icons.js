const fs = require('fs');
const { createCanvas } = require('canvas');

// 研学港图标生成器
function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 设置背景色（研学港蓝色）
  ctx.fillStyle = '#667eea';
  ctx.fillRect(0, 0, size, size);
  
  // 计算比例
  const scale = size / 128;
  
  // 绘制书本图形
  ctx.fillStyle = '#ffffff';
  
  // 书本主体
  const bookWidth = 80 * scale;
  const bookHeight = 90 * scale;
  const bookX = (size - bookWidth) / 2;
  const bookY = (size - bookHeight) / 2;
  
  // 绘制书本
  ctx.fillRect(bookX, bookY, bookWidth, bookHeight);
  
  // 书脊
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(bookX, bookY, 8 * scale, bookHeight);
  
  // 页面线条
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1 * scale;
  for (let i = 1; i <= 6; i++) {
    const y = bookY + (bookHeight / 8) * i;
    ctx.beginPath();
    ctx.moveTo(bookX + 15 * scale, y);
    ctx.lineTo(bookX + bookWidth - 10 * scale, y);
    ctx.stroke();
  }
  
  // 添加DOI标识
  ctx.fillStyle = '#667eea';
  ctx.font = `bold ${12 * scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('DOI', size / 2, bookY + bookHeight + 15 * scale);
  
  return canvas.toBuffer('image/png');
}

// 生成所有尺寸的图标
const sizes = [16, 32, 48, 128];
const iconsDir = './icons';

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

console.log('🎨 开始生成研学港PNG图标...');

sizes.forEach(size => {
  try {
    const buffer = generateIcon(size);
    const filename = `${iconsDir}/icon${size}.png`;
    fs.writeFileSync(filename, buffer);
    console.log(`✅ 生成成功: icon${size}.png`);
  } catch (error) {
    console.error(`❌ 生成icon${size}.png失败:`, error.message);
  }
});

console.log('🚀 PNG图标生成完成！');