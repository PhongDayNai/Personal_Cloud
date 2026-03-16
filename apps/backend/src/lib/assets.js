const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function saveUploadedFile(file, user) {
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

  const relPath = path.relative(LIBRARY_PATH, absPath).replaceAll('\\', '/');
  const item = {
    id,
    originalName: file.originalname,
    mime: file.mimetype,
    size: file.size,
    owner: user?.sub || 'admin',
    uploadedAt: now.toISOString(),
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
  return db.items.slice(0, Math.max(1, Math.min(limit, 500)));
}

function getAsset(id) {
  const db = readIndex();
  return db.items.find((x) => x.id === id) || null;
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
