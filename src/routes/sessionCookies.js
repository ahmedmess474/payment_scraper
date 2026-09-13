const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../config');
const { openPortal, restoreSessionWithCookies, normalizeCookie } = require('../scraper/algeriePoste');

const router = express.Router();

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
      // The browser's setCookie call needs domain (or url) per cookie — catching
      // this here turns a confusing mid-flight protocol error, after a browser
      // has already been launched, into an immediate, specific 400.
      const err = new Error(`cookie "${cookie.name}" is missing a "domain" field`);
      err.statusCode = 400;
      throw err;
    }
  }
  return list;
}

// Lets a session refresh be pushed here instead of SSHing into the server to
// overwrite secrets/session-cookies.json by hand. The pasted cookies are
// tried against the live portal before anything is written to disk, so a bad
// paste never clobbers a working session — and this check is free (it's a
// login check, not a relevé query, so it doesn't cost anything on Algerie
// Poste's side).
router.post('/', requireAdminToken, async (req, res) => {
  let browser;
  try {
    const rawList = extractCookieList(req.body);
    const cookies = rawList.map(normalizeCookie);

    // openPortal() failures are infra/connectivity problems (browser wouldn't
    // launch, portal unreachable) and keep their own statusCode. Once the
    // browser exists, though, any failure trying these specific cookies is
    // about the payload the caller sent — reported as 422 regardless of what
    // it looked like internally, distinct from openPortal's own error classes.
    const opened = await openPortal();
    browser = opened.browser;

    let authenticated;
    try {
      authenticated = await restoreSessionWithCookies(opened.page, cookies);
    } catch (err) {
      const wrapped = new Error(`the browser rejected these cookies: ${err.message}`);
      wrapped.statusCode = 422;
      throw wrapped;
    }

    if (!authenticated) {
      return res.status(422).json({
        status: 'error',
        authenticated: false,
        error: 'these cookies did not authenticate against the portal — existing session file left untouched',
      });
    }

    const targetPath = config.sessionCookiesPath;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const tmpPath = `${targetPath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(rawList, null, 2));
    fs.renameSync(tmpPath, targetPath);

    res.json({ status: 'ok', authenticated: true, cookie_count: cookies.length });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

module.exports = router;
