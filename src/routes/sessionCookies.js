const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../config');
const { requireAdminToken } = require('../middleware/requireAdminToken');

const router = express.Router();

function extractCookieList(body) {
  const list = Array.isArray(body) ? body : body && body.cookies;
  if (!Array.isArray(list) || list.length === 0) {
    const err = new Error('body must be a JSON array of cookies, or { "cookies": [...] }');
    err.statusCode = 400;
    throw err;
  }
  for (const cookie of list) {
    if (!cookie || typeof cookie.name !== 'string' || typeof cookie.value !== 'string') {
      const err = new Error('every cookie needs at least a string "name" and "value"');
      err.statusCode = 400;
      throw err;
    }
    if (typeof cookie.domain !== 'string' || !cookie.domain) {
      const err = new Error(`cookie "${cookie.name}" is missing a "domain" field`);
      err.statusCode = 400;
      throw err;
    }
  }
  return list;
}

// Just writes the pasted cookie export to secrets/session-cookies.json — the
// same file loadSessionCookies() reads at the start of every /scrape run.
// No browser involved here; whether these cookies actually authenticate is
// found out the normal way, the next time /scrape or run.js uses them.
router.post('/', requireAdminToken, (req, res) => {
  try {
    console.log('[session-cookies] update request received');

    const rawList = extractCookieList(req.body);
    console.log(`[session-cookies] payload validated: ${rawList.length} cookies`);

    const targetPath = config.sessionCookiesPath;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const tmpPath = `${targetPath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(rawList, null, 2));
    fs.renameSync(tmpPath, targetPath);
    console.log(`[session-cookies] wrote ${rawList.length} cookies to ${targetPath}`);

    res.json({ status: 'ok', cookie_count: rawList.length });
  } catch (err) {
    console.error(`[session-cookies] rejected: ${err.message}`);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  }
});

module.exports = router;
