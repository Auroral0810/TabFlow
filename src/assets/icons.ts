// 创建一个基础的 SVG 图标作为默认图标
export const defaultIcon = `data:assets/svg+xml;base64,${btoa(`
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="16" height="16" rx="2" fill="#E2E8F0"/>
  <path d="M4 4H12V6H4V4Z" fill="#94A3B8"/>
</svg>
`)}`;

// 导出其他图标尺寸
export const icons = {
  '16': defaultIcon,
  '48': defaultIcon,
  '128': defaultIcon
}; 