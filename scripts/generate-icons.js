import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// 获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建一个简单的 SVG 图标
const svgIcon = `
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="16" fill="#4F46E5"/>
  <path d="M32 32H96V48H32V32Z" fill="white"/>
  <path d="M32 56H96V72H32V56Z" fill="white" fill-opacity="0.7"/>
  <path d="M32 80H96V96H32V80Z" fill="white" fill-opacity="0.4"/>
</svg>
`;

// 确保目录存在
const assetsDir = path.join(__dirname, '../public/assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 生成不同尺寸的图标
const sizes = [16, 48, 128];

sizes.forEach(size => {
  sharp(Buffer.from(svgIcon))
    .resize(size, size)
    .toFile(path.join(assetsDir, `icon${size}.png`))
    .catch(console.error);
}); 