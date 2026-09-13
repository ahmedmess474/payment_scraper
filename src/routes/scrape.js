const express = require('express');
const {
  openPortal,
  closeBrowser,
  restoreSession,
  goToReleve,
  setDateRange,
  submitReleveFilter,
  extractReleve,
} = require('../scraper/algeriePoste');
const { filterTransfersAndDeposits } = require('../utils/transactions');
const { createRunLogger } = require('../utils/logger');
const { parseIsoDate, toComparableDate } = require('../utils/dates');
const { requireAdminToken } = require('../middleware/requireAdminToken');

const router = express.Router();

// Triggers a real relevé query against the live Algerie Poste portal and waits
// for the result - this is a paid operation on their side (see config.cost),
// every call to this endpoint costs real money and returns real statement
// data, so it sits behind the same bearer token as /session-cookies. No cost
// ceiling/confirmation beyond that is implemented here (the codebase already
// had this flagged as "planned separately", not built).
router.post('/', requireAdminToken, async (req, res) => {
  let logger;
  let browser;

  try {
    // createRunLogger() touches the filesystem (mkdir + a log file) — if that
    // fails (e.g. a permission mismatch on the Docker data volume) it must
    // not throw before the try block starts, or it becomes an unhandled
    // rejection that can take the whole process down instead of just this request.
    logger = createRunLogger();

    if (!req.body || typeof req.body !== 'object') {
      const err = new Error('request body must be JSON with "start" and "end" date fields');
      err.statusCode = 400;
      throw err;
    }

    const start = parseIsoDate(req.body.start, 'start');
    const end = parseIsoDate(req.body.end, 'end');
    if (toComparableDate(end) < toComparableDate(start)) {
      const err = new Error(`end (${req.body.end}) is before start (${req.body.start})`);
      err.statusCode = 400;
      throw err;
    }

    const endLaunch = logger.startStep('session.launch');
    const opened = await openPortal();
    browser = opened.browser;
    const page = opened.page;
    endLaunch('success', { url: page.url() });

    const endRestore = logger.startStep('session.restore');
    const loggedIn = await restoreSession(page);
    if (!loggedIn) {
      endRestore('fail', { error: 'session cookies did not authenticate' });
      logger.summary();
      return res.status(503).json({
        error: 'session cookies did not result in an authenticated session - needs a human to refresh them',
      });
    }
    endRestore('success', { url: page.url() });

    const endNav = logger.startStep('navigate.releve');
    await goToReleve(page);
    endNav('success', { url: page.url() });

    const endFill = logger.startStep('fill.dates');
    await setDateRange(page, { start, end });
    endFill('success', { start, end });

    const endSubmit = logger.startStep('submit.filter');
    await submitReleveFilter(page);
    endSubmit('success', { url: page.url() });

    const endExtract = logger.startStep('extract.releve');
    const result = await extractReleve(page);
    endExtract('success', { transactionCount: result.transactionCount, invalidCount: result.invalidCount });

    const transfers = filterTransfersAndDeposits(result);
    logger.summary();
    res.json(transfers);
  } catch (err) {
    if (logger) {
      logger.log('http.scrape', 'fail', { error: err.message });
      logger.summary();
    }
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  } finally {
    await closeBrowser(browser);
  }
});

module.exports = router;
