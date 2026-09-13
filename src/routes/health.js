const fs = require('fs');
const express = require('express');
const config = require('../config');

const router = express.Router();

// Deliberately cheap: no browser launch, no request to the live portal. Algerie
// Poste charges per relevé query, so a health endpoint that gets polled every
// few seconds by a monitoring stack must not be the thing burning that budget.
// This only checks that a session cookie file exists, parses, and isn't empty -
// a real "is our session still authenticated" check belongs to /scrape's result,
// not to a liveness probe.
router.get('/', (req, res) => {
  const path = config.sessionCookiesPath;

  if (!fs.existsSync(path)) {
    return res.status(503).json({ status: 'error', session_cookies_present: false, error: 'session cookie file not found' });
  }

  try {
    const raw = JSON.parse(fs.readFileSync(path, 'utf-8'));
    const list = Array.isArray(raw) ? raw : raw.cookies;
    if (!Array.isArray(list) || list.length === 0) {
      return res.status(503).json({ status: 'error', session_cookies_present: false, error: 'session cookie file has no cookies' });
    }
    res.json({ status: 'ok', session_cookies_present: true, cookie_count: list.length });
  } catch (err) {
    res.status(503).json({ status: 'error', session_cookies_present: false, error: `session cookie file is not valid JSON: ${err.message}` });
  }
});

module.exports = router;
