import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const isWatch = process.argv.includes('--watch');

// Entry points for the extension
const entryPoints = [
  'src/background.ts',
  'src/content.ts',
  'src/popup.ts',
  'src/sidebar.ts',
  'src/welcome.ts',
];

// Filter to only existing files
const existingEntryPoints = entryPoints.filter(entry => {
  const fullPath = path.join(process.cwd(), entry);
  return fs.existsSync(fullPath);
});

const buildOptions = {
  entryPoints: existingEntryPoints,
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome100',
  minify: !isWatch,
  sourcemap: isWatch,
  logLevel: 'info',
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Build complete!');
      
      // Copy static files to dist
      copyStaticFiles();
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

function copyStaticFiles() {
  const staticFiles = [
    'manifest.json',
    'sidebar.html',
    'popup.html',
    'welcome.html',
    'content.css',
  ];
  
  const staticDirs = [
    'icons',
    '_locales',
    'styles',
    'utils',
  ];
  
  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  
  // Copy files
  for (const file of staticFiles) {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join('dist', file));
      console.log(`Copied: ${file}`);
    }
  }
  
  // Copy directories
  for (const dir of staticDirs) {
    if (fs.existsSync(dir)) {
      copyDir(dir, path.join('dist', dir));
      console.log(`Copied directory: ${dir}`);
    }
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

build();
