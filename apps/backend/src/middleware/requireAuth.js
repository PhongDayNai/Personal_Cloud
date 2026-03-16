const { ACCESS_COOKIE, verifyAccess } = require('../lib/auth');

function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const payload = verifyAccess(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

module.exports = { requireAuth };
