const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const exifr = require('exifr');

const LIBRARY_PATH = process.env.MEDIA_LIBRARY_PATH || '/data/library';
const ORIGINALS_ROOT = path.join(LIBRARY_PATH, 'originals');
const INDEX_DIR = path.join(LIBRARY_PATH, 'index');
const INDEX_FILE = path.join(INDEX_DIR, 'assets.json');

function ensureIndex() {
  fs.mkdirSync(ORIGINALS_ROOT, { recursive: true });
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_FILE)) fs.writeFileSync(INDEX_FILE, JSON.stringify({ items: [] }, null, 2));
}

function readIndex() {
  ensureIndex();
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {
    return { items: [] };
  }
}

function writeIndex(data) {
  ensureIndex();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2));
}

async function detectTakenAt(absPath, mime) {
  try {
    if (!mime?.startsWith('image/')) return null;

    const exif = await exifr.parse(absPath, {
      tiff: true,
      exif: true,
      gps: false,
      xmp: true,
      iptc: true,
    });

    const dt = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate;
    if (!dt) return null;
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

async function saveUploadedFile(file, user) {
  ensureIndex();
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const destDir = path.join(ORIGINALS_ROOT, yyyy, mm);
  fs.mkdirSync(destDir, { recursive: true });

  const ext = path.extname(file.originalname || '') || '';
  const id = crypto.randomUUID();
  const fileName = `${id}${ext}`;
  const absPath = path.join(destDir, fileName);
  try {
    fs.renameSync(file.path, absPath);
  } catch (e) {
    if (e && e.code === 'EXDEV') {
      fs.copyFileSync(file.path, absPath);
      fs.unlinkSync(file.path);
    } else {
      throw e;
    }
  }

  const uploadedAt = now.toISOString();
  const takenAt = (await detectTakenAt(absPath, file.mimetype)) || uploadedAt;

  const relPath = path.relative(LIBRARY_PATH, absPath).replaceAll('\\', '/');
  const item = {
    id,
    originalName: file.originalname,
    mime: file.mimetype,
    size: file.size,
    owner: user?.sub || 'admin',
    uploadedAt,
    takenAt,
    relPath,
    ext,
    type: file.mimetype?.startsWith('image/') ? 'image' : file.mimetype?.startsWith('video/') ? 'video' : 'file',
  };

  const db = readIndex();
  db.items.unshift(item);
  writeIndex(db);

  return item;
}

function listAssets(limit = 200) {
  const db = readIndex();
  const items = db.items.map((x) => ({ ...x, takenAt: x.takenAt || x.uploadedAt }));
  return items.slice(0, Math.max(1, Math.min(limit, 500)));
}

function getAsset(id) {
  const db = readIndex();
  const item = db.items.find((x) => x.id === id) || null;
  if (!item) return null;
  return { ...item, takenAt: item.takenAt || item.uploadedAt };
}

function getAbsPathFromAsset(asset) {
  return path.join(LIBRARY_PATH, asset.relPath);
}

module.exports = {
  saveUploadedFile,
  listAssets,
  getAsset,
  getAbsPathFromAsset,
  LIBRARY_PATH,
};
