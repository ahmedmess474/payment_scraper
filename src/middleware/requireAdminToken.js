const config = require('../config');

// Shared by every route that shouldn't be reachable by just anyone with the
// server's URL — currently /scrape (costs real money and returns real bank
// data per call) and /session-cookies (writes the login credential). Fails
// closed: an unset ADMIN_TOKEN refuses every request rather than letting
// them through unauthenticated.
function requireAdminToken(req, res, next) {
  if (!config.adminToken) {
    return res.status(500).json({ error: 'ADMIN_TOKEN is not configured on the server' });
  }
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || token !== config.adminToken) {
    return res.status(401).json({ error: 'missing or invalid bearer token' });
  }
  next();
}

module.exports = { requireAdminToken };
