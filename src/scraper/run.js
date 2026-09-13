const fs = require('fs');
const path = require('path');
const {
  openPortal,
  restoreSession,
  goToReleve,
  setDateRange,
  submitReleveFilter,
  extractReleve,
} = require('./algeriePoste');
const { createRunLogger } = require('../utils/logger');
const { parseDateRangeArgs } = require('../utils/args');
const { filterTransfersAndDeposits } = require('../utils/transactions');
const config = require('../config');

// No cost ledger yet (planned separately) — submitting is opt-in via --submit
// so a plain run never accidentally triggers a paid query.
const shouldSubmit = process.argv.includes('--submit');

(async () => {
  let dateRange;
  try {
    dateRange = parseDateRangeArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Argument error: ${err.message}`);
    console.error('Usage: node src/scraper/run.js --start YYYY-MM-DD --end YYYY-MM-DD [--submit]');
    process.exit(1);
  }

  const logger = createRunLogger();
  const endLaunch = logger.startStep('session.launch');
  let browser;
  let page;

  try {
    const opened = await openPortal();
    browser = opened.browser;
    page = opened.page;
    endLaunch('success', { url: page.url() });
  } catch (err) {
    endLaunch('fail', { error: err.message });
    logger.summary();
    process.exit(1);
  }

  const endRestore = logger.startStep('session.restore');
  try {
    const loggedIn = await restoreSession(page);
    if (!loggedIn) {
      throw new Error('Session cookies did not result in an authenticated session');
    }
    endRestore('success', { url: page.url() });
    console.log('Logged in via saved session cookies.');
  } catch (err) {
    endRestore('fail', { error: err.message });
    logger.summary();
    if (browser) await browser.close();
    process.exit(1);
  }

  const endNav = logger.startStep('navigate.releve');
  try {
    await goToReleve(page);
    endNav('success', { url: page.url() });
    console.log('Reached the relevé filter page.');
  } catch (err) {
    endNav('fail', { error: err.message });
    logger.summary();
    if (browser) await browser.close();
    process.exit(1);
  }

  const endFill = logger.startStep('fill.dates');
  try {
    await setDateRange(page, dateRange);
    endFill('success', { start: dateRange.start, end: dateRange.end });
    console.log(
      `Filled date range ${dateRange.start.year}-${dateRange.start.month}-${dateRange.start.day} ` +
        `to ${dateRange.end.year}-${dateRange.end.month}-${dateRange.end.day}.`
    );
  } catch (err) {
    endFill('fail', { error: err.message });
    logger.summary();
    if (browser) await browser.close();
    process.exit(1);
  }

  if (!shouldSubmit) {
    console.log('NOT submitting — pass --submit to actually submit (this costs real money).');
    console.log('Browser left open for inspection — close the window or Ctrl+C here to stop.');
    process.on('SIGINT', async () => {
      logger.summary();
      if (browser) await browser.close();
      process.exit(0);
    });
    return;
  }

  const endSubmit = logger.startStep('submit.filter');
  try {
    await submitReleveFilter(page);
    endSubmit('success', { url: page.url() });
    console.log('Submitted. Results page loaded.');
  } catch (err) {
    endSubmit('fail', { error: err.message });
    logger.summary();
    if (browser) await browser.close();
    process.exit(1);
  }

  const endExtract = logger.startStep('extract.releve');
  let result;
  try {
    result = await extractReleve(page);
    endExtract('success', {
      transactionCount: result.transactionCount,
      invalidCount: result.invalidCount,
    });
    console.log(`Extracted ${result.transactionCount} transactions (${result.invalidCount} invalid).`);
  } catch (err) {
    endExtract('fail', { error: err.message });
    logger.summary();
    if (browser) await browser.close();
    process.exit(1);
  }

  const transfers = filterTransfersAndDeposits(result);
  console.log(`Filtered to ${transfers.transactionCount} VIREMENT/VERSEMENT transactions.`);

  const fullPath = path.join(config.dataDir, `releve-${logger.runId}.json`);
  const transfersPath = path.join(config.dataDir, `releve-${logger.runId}-transfers.json`);
  fs.writeFileSync(fullPath, JSON.stringify(result, null, 2));
  fs.writeFileSync(transfersPath, JSON.stringify(transfers, null, 2));
  console.log('Saved:', fullPath);
  console.log('Saved:', transfersPath);

  logger.summary();
  await browser.close();
  process.exit(0);
})();
