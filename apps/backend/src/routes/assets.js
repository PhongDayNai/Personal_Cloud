const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { requireAuth } = require('../middleware/requireAuth');
const { saveUploadedFile, listAssets, getAsset, getAbsPathFromAsset } = require('../lib/assets');

const router = express.Router();
const tempDir = '/tmp/hcphotos-upload';
fs.mkdirSync(tempDir, { recursive: true });

const upload = multer({
  dest: tempDir,
  limits: {
    files: 50,
    fileSize: 20 * 1024 * 1024 * 1024, // 20GB/file safety guard
  },
});

router.get('/', requireAuth, (req, res) => {
  const limit = Number(req.query.limit || 200);
  return res.json({ items: listAssets(limit) });
});

router.post('/upload', requireAuth, upload.array('files', 50), (req, res) => {
  const files = req.files || [];
  const saved = files.map((f) => saveUploadedFile(f, req.user));
  return res.json({ ok: true, count: saved.length, items: saved });
});

router.get('/_media/original/:id', requireAuth, (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Not found' });

  const abs = getAbsPathFromAsset(asset);
  if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File missing' });

  res.setHeader('Content-Type', asset.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(asset.originalName || 'file')}"`);
  return res.sendFile(abs);
});

router.get('/:id', requireAuth, (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) return res.status(404).json({ message: 'Not found' });
  return res.json(asset);
});

module.exports = router;
