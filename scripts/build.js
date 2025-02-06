import { build } from 'vite';
import { resolve } from 'path';
import fs from 'fs-extra';

async function buildExtension() {
  try {
    // 清理 dist 目录
    await fs.remove('dist');
    
    // 构建主要文件
    await build();
    
    // 复制 manifest 文件
    await fs.copy(
      process.env.NODE_ENV === 'development' 
        ? 'manifest.dev.json' 
        : 'manifest.json',
      'dist/manifest.json'
    );
    
    // 复制 background script
    await fs.copy('src/background.js', 'dist/background.js');
    
    console.log('构建完成');
  } catch (error) {
    console.error('构建失败:', error);
    process.exit(1);
  }
}

buildExtension(); 