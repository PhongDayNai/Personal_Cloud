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
  const ext = (item.ext || '').toLowerCase().replace(/^\./, '');
  const mime = (item.mime || '').toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext) || mime.includes('word') || mime.includes('officedocument.wordprocessingml')) return 'word';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mime.includes('excel') || mime.includes('spreadsheet')) return 'excel';
  if (['ppt', 'pptx', 'odp'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return 'powerpoint';
  if (['md', 'markdown'].includes(ext) || mime.includes('markdown')) return 'markdown';
  if (['txt', 'log'].includes(ext) || mime.startsWith('text/')) return 'text';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) return 'archive';
  if (['json', 'js', 'ts', 'py', 'java', 'kt', 'sql', 'yml', 'yaml', 'xml', 'html', 'css', 'sh'].includes(ext)) return 'code';
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
  if (t.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|avif)$/.test(name)) return 'image';
  if (t.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi|m4v)$/.test(name)) return 'video';
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
  const ext = (item.originalName || '').split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return '📕';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['doc', 'docx'].includes(ext)) return '📘';
  if (['ppt', 'pptx'].includes(ext)) return '📙';
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return '📦';
  if (['txt', 'md', 'json'].includes(ext)) return '📝';
  return '📄';
}

