import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chokidar from 'chokidar';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 确保开发目录存在
const devDir = path.join(__dirname, '../dev');
fs.ensureDirSync(devDir);

// 复制开发版 manifest
fs.copyFileSync(
  path.join(__dirname, '../manifest.dev.json'),
  path.join(devDir, 'manifest.json')
);

// 启动 Vite 开发服务器
const viteProcess = exec('vite', { stdio: 'inherit' });

// 监听源文件变化
const watcher = chokidar.watch(['src/**/*', 'public/**/*'], {
  ignored: /(^|[\/\\])\../,
  persistent: true
});

// 当文件变化时自动复制到开发目录
watcher.on('change', async (filepath) => {
  const relativePath = path.relative('src', filepath);
  const destPath = path.join(devDir, relativePath);
  
  try {
    await fs.copy(filepath, destPath);
    console.log(`已更新: ${relativePath}`);
  } catch (error) {
    console.error(`更新失败: ${error}`);
  }
});

// 清理函数
function cleanup() {
  viteProcess.kill();
  watcher.close();
  process.exit();
}

// 监听进程终止信号
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup); 