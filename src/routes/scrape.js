const express = require('express');
const {
  openPortal,
  restoreSession,
  goToReleve,
  setDateRange,
  submitReleveFilter,
  extractReleve,
} = require('../scraper/algeriePoste');
const { filterTransfersAndDeposits } = require('../utils/transactions');
const { createRunLogger } = require('../utils/logger');

const router = express.Router();

function parseIsoDate(value, label) {
  const match = value && String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const err = new Error(`${label} must be in YYYY-MM-DD format, got: ${value ?? '(missing)'}`);
    err.statusCode = 400;
    throw err;
  }
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function toComparableDate({ year, month, day }) {
  return new Date(year, month - 1, day);
}

// Triggers a real relevé query against the live Algerie Poste portal and waits
// for the result - this is a paid operation on their side (see config.cost),
// every call to this endpoint costs real money. No cost ceiling/confirmation
// is implemented here (the codebase already had this flagged as "planned
// separately", not built) - the caller is currently trusted not to hammer it.
router.post('/', async (req, res) => {
  const logger = createRunLogger();
  let browser;

  try {
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
    logger.log('http.scrape', 'fail', { error: err.message });
    logger.summary();
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

module.exports = router;
