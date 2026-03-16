const express = require('express');
const jwt = require('jsonwebtoken');
const {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  signAccess,
  signRefresh,
  verifyRefresh,
  cookieOpts,
} = require('../lib/auth');

const router = express.Router();
const refreshStore = new Set();

function adminIdentity() {
  return {
    email: process.env.AUTH_ADMIN_EMAIL || 'admin@example.com',
    role: 'admin',
    name: 'Admin',
  };
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const admin = adminIdentity();

  if (!email || !password) {
    return res.status(400).json({ message: 'Missing email/password' });
  }

  if (email !== admin.email || password !== (process.env.AUTH_ADMIN_PASSWORD || 'change_me_now')) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const payload = { sub: admin.email, role: admin.role, name: admin.name };
  const access = signAccess(payload);
  const refresh = signRefresh(payload);
  refreshStore.add(refresh);

  res.cookie(ACCESS_COOKIE, access, cookieOpts());
  res.cookie(REFRESH_COOKIE, refresh, cookieOpts());
  return res.json({ ok: true, user: payload });
});

router.post('/refresh', (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token || !refreshStore.has(token)) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = verifyRefresh(token);
    const access = signAccess({ sub: payload.sub, role: payload.role, name: payload.name });
    res.cookie(ACCESS_COOKIE, access, cookieOpts());
    return res.json({ ok: true });
  } catch {
    refreshStore.delete(token);
    return res.status(401).json({ message: 'Unauthorized' });
  }
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) refreshStore.delete(token);
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  return res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = jwt.decode(token);
    return res.json({ user: payload });
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
});

module.exports = router;
