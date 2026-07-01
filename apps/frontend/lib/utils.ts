import { Asset } from '../types';

export function getApiOrigin(): string {
  return process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:45174';
}

export function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function docTypeOf(item: Asset): string {
  if (item.ext?.trim()) return item.ext.toLowerCase();
  if (item.mime?.trim()) return `mime:${item.mime.toLowerCase()}`;
  return 'no-extension';
}

export function docCategoryOf(item: Asset): 'pdf' | 'word' | 'excel' | 'powerpoint' | 'markdown' | 'text' | 'archive' | 'code' | 'other' {
  const filename = (item.originalName || '').toLowerCase();
  const ext = (item.ext || '').toLowerCase().replace(/^\./, '');
  const mime = (item.mime || '').toLowerCase();

  // 1. Kiểm tra các file cấu hình / build đặc biệt không có extension hoặc có cấu trúc tên code đặc trưng (.env.*, .*rc, .*ignore)
  const specialCodeFiles = ['dockerfile', 'makefile', 'jenkinsfile', 'vagrantfile', 'gemfile', 'rakefile', 'procfile', 'caddyfile', 'nginx.conf'];
  if (
    specialCodeFiles.includes(filename) || 
    specialCodeFiles.some(f => filename.endsWith(f)) ||
    filename.startsWith('.env') ||
    filename.includes('.env.') ||
    ext.endsWith('rc') ||
    ext.endsWith('ignore') ||
    ['mod', 'sum', 'podspec', 'gemspec'].includes(ext)
  ) return 'code';

  // 2. Định nghĩa danh sách extension đầy đủ cho Code (hơn 80 định dạng ngôn ngữ/config phổ biến)
  const codeExtensions = [
    // Web & Frontend
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'astro', 'elm', 'graphql', 'gql', 'wasm', 'wat',
    // Languages & Scripts
    'py', 'pyw', 'java', 'kt', 'kts', 'rb', 'rbw', 'pl', 'pm', 'php', 'go', 'rs', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'cs', 'fs', 'fsx', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'awk', 'sed',
    // Academics & Functional
    'r', 'rmd', 'ipynb', 'lua', 'scala', 'groovy', 'clj', 'cljs', 'cljc', 'edn', 'ex', 'exs', 'erl', 'hrl', 'hs', 'pas', 'pp', 'f', 'f90', 'm', 'mm', 'swift', 'dart', 'sol',
    // Config & DevOps & Build
    'json', 'jsonld', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config', 'properties', 'gradle', 'sql', 'proto', 'thrift', 'env', 'lock'
  ];

  // 3. Kiểm tra nhóm Code trước để các file mã nguồn có mime bắt đầu bằng "text/..." không bị nhận nhầm thành Văn bản (text)
  if (
    codeExtensions.includes(ext) ||
    mime.startsWith('text/x-') ||
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('python') ||
    mime.includes('x-php') ||
    mime.includes('x-sh') ||
    mime.includes('yaml') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    mime.includes('html') ||
    mime.includes('css') ||
    mime.includes('code') ||
    mime.includes('script')
  ) return 'code';

  // 4. Kiểm tra các nhóm tài liệu thông dụng khác
  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
  
  if (['doc', 'docx', 'docm', 'dotx', 'odt', 'pages', 'rtf'].includes(ext) || mime.includes('word') || mime.includes('officedocument.wordprocessingml')) return 'word';
  
  if (['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'tsv', 'ods', 'numbers'].includes(ext) || mime.includes('excel') || mime.includes('spreadsheet')) return 'excel';
  
  if (['ppt', 'pptx', 'pptm', 'ppsx', 'odp', 'key'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return 'powerpoint';
  
  if (['md', 'markdown', 'mdx'].includes(ext) || mime.includes('markdown') || mime.includes('mdx')) return 'markdown';
  
  if (['txt', 'log'].includes(ext) || mime.startsWith('text/')) return 'text';
  
  if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso', 'dmg', 'apk', 'jar', 'war', 'cab'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) return 'archive';
  
  return 'other';
}

export const DOC_CATEGORY_LABELS: Record<string, string> = {
  pdf: 'PDF',
  word: 'Word',
  excel: 'Excel/CSV',
  powerpoint: 'PowerPoint',
  markdown: 'Markdown',
  text: 'Text',
  archive: 'Nén',
  code: 'Code',
  other: 'Khác',
};

export function monthLabel(iso: string | null, lang: string): string {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' }).format(d);
}

export function yearLabel(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return String(d.getFullYear());
}

export function inferUploadKind(file: File): string {
  const t = (file?.type || '').toLowerCase();
  const name = (file?.name || '').toLowerCase();
  if (t.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|avif|svg|bmp|tiff|tif|ico)$/.test(name)) return 'image';
  if (t.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi|m4v|wmv|mpeg|mpg|3gp|flv|ogv)$/.test(name)) return 'video';
  return 'doc';
}

export async function readErrorMessage(res: Response, translateFn: (key: string, replacements?: Record<string, string | number>) => string): Promise<string> {
  try {
    const data = await res.clone().json();
    if (data?.message) return String(data.message);
    return JSON.stringify(data);
  } catch {
    try {
      const txt = await res.text();
      if (txt) return txt.slice(0, 300);
    } catch { }
  }
  return translateFn('messages.noDetailFromServer');
}

export function docIconOf(item: Asset): string {
  const ext = (item.ext || '').toLowerCase().replace(/^\./, '');
  
  if (['pdf'].includes(ext)) return '📕';
  if (['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'tsv', 'ods', 'numbers'].includes(ext)) return '📊';
  if (['doc', 'docx', 'docm', 'dotx', 'odt', 'pages', 'rtf'].includes(ext)) return '📘';
  if (['ppt', 'pptx', 'pptm', 'ppsx', 'odp', 'key'].includes(ext)) return '📙';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso', 'dmg', 'apk', 'jar', 'war', 'cab'].includes(ext)) return '📦';
  if (['md', 'markdown', 'mdx', 'txt', 'log'].includes(ext)) return '📝';
  
  const codeExtensions = [
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'astro', 'elm', 'graphql', 'gql', 'wasm', 'wat',
    'py', 'pyw', 'java', 'kt', 'kts', 'rb', 'rbw', 'pl', 'pm', 'php', 'go', 'rs', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'cs', 'fs', 'fsx', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'awk', 'sed',
    'r', 'rmd', 'ipynb', 'lua', 'scala', 'groovy', 'clj', 'cljs', 'cljc', 'edn', 'ex', 'exs', 'erl', 'hrl', 'hs', 'pas', 'pp', 'f', 'f90', 'm', 'mm', 'swift', 'dart', 'sol',
    'json', 'jsonld', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config', 'properties', 'gradle', 'sql', 'proto', 'thrift', 'env', 'lock', 'mod', 'sum', 'podspec', 'gemspec'
  ];
  if (codeExtensions.includes(ext) || ext.endsWith('rc') || ext.endsWith('ignore')) return '💻';
  
  return '📄';
}

