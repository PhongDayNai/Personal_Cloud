const express = require('express');
const { getStorageUsage } = require('../lib/storage');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/usage', requireAuth, (_req, res) => {
  return res.json(getStorageUsage());
});

module.exports = router;
