const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('../config');
const selectors = require('./selectors');
const { parseAmount, parseFrenchDate } = require('../utils/parse');

puppeteer.use(StealthPlugin());

// Tolerates the field-name variants different cookie-export browser
// extensions use (Puppeteer-native `expires`/`sameSite` values, or the
// `expirationDate`/lowercase-`sameSite` style common cookie exporters use).
function normalizeCookie(raw) {
  const cookie = {
    name: raw.name,
    value: raw.value,
    domain: raw.domain,
    path: raw.path || '/',
    httpOnly: !!raw.httpOnly,
    secure: raw.secure !== undefined ? !!raw.secure : true,
  };

  const expiresRaw = raw.expires ?? raw.expirationDate;
  if (typeof expiresRaw === 'number' && expiresRaw > 0) {
    cookie.expires = Math.floor(expiresRaw);
  }
  // No expires field left set => session cookie, matches Puppeteer's default.

  if (raw.sameSite) {
    const normalized = String(raw.sameSite).toLowerCase();
    if (normalized === 'strict') cookie.sameSite = 'Strict';
    else if (normalized === 'lax') cookie.sameSite = 'Lax';
    else if (normalized === 'no_restriction' || normalized === 'none') cookie.sameSite = 'None';
  }

  return cookie;
}

function loadSessionCookies(filePath) {
  if (!fs.existsSync(filePath)) {
    const err = new Error(`Session cookie file not found: ${filePath}`);
    err.statusCode = 503;
    throw err;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const list = Array.isArray(raw) ? raw : raw.cookies;

  if (!Array.isArray(list) || list.length === 0) {
    const err = new Error(`Session cookie file has no cookies: ${filePath}`);
    err.statusCode = 503;
    throw err;
  }

  return list.map(normalizeCookie);
}

// Split out of restoreSession() so a cookie payload can be tried against the
// live portal (see routes/sessionCookies.js) before it's ever written to the
// session cookie file — a bad paste should never clobber a working session.
async function restoreSessionWithCookies(page, cookies) {
  const { baseUrl } = config.algeriePoste;

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle2' });
    await page.setCookie(...cookies);
    await page.goto(`${baseUrl}/compte`, { waitUntil: 'networkidle2' });
  } catch (err) {
    const wrapped = new Error(`could not apply the session cookies against the portal: ${err.message}`);
    wrapped.statusCode = 502;
    throw wrapped;
  }

  try {
    await page.waitForSelector(selectors.login.loggedInMarker, { visible: true, timeout: 15000 });
    return true;
  } catch (err) {
    // Bare `false` here gives no way to tell "cookies really are dead" apart from
    // "the marker just took longer than we waited" or "the selector itself is
    // stale" - log what the page actually shows so a failure is diagnosable.
    const url = page.url();
    const title = await page.title().catch(() => '(could not read title)');
    console.error(
      `restoreSession: '${selectors.login.loggedInMarker}' never appeared within 15s. ` +
      `Landed on url=${url} title=${JSON.stringify(title)}`
    );
    return false;
  }
}

async function restoreSession(page) {
  const cookies = loadSessionCookies(config.sessionCookiesPath);
  return restoreSessionWithCookies(page, cookies);
}

async function typeHumanLike(page, selector, text) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char, { delay: 60 + Math.floor(Math.random() * 100) });
  }
}

async function humanClick(page, selector) {
  const el = await page.waitForSelector(selector, { visible: true });
  const box = await el.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 15 });
  await page.mouse.click(x, y);
}

async function goToReleve(page) {
  await humanClick(page, selectors.nav.releveDropdownToggle);
  await page.waitForSelector(selectors.nav.releveLink, { visible: true });
  await humanClick(page, selectors.nav.releveLink);
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  const onFilterPage = await page
    .waitForSelector(selectors.releveFilter.start.day, { visible: true, timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (!onFilterPage) {
    const err = new Error(`Did not land on the relevé filter page (landed on ${page.url()})`);
    err.statusCode = 502;
    throw err;
  }
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

async function setDateFilter(page, group, { day, month, year }) {
  const dayValue = pad2(day);
  const monthValue = pad2(month);
  const yearValue = String(year);

  await page.select(group.year, yearValue);
  await page.select(group.month, monthValue);

  const dayAvailable = await page.$eval(
    group.day,
    (select, value) => Array.from(select.options).some((o) => o.value === value),
    dayValue
  );

  if (!dayAvailable) {
    const err = new Error(`Day ${dayValue} is not a valid option for ${monthValue}/${yearValue}`);
    err.statusCode = 502;
    throw err;
  }

  await page.select(group.day, dayValue);

  const actual = await page.evaluate(
    (g) => ({
      day: document.querySelector(g.day).value,
      month: document.querySelector(g.month).value,
      year: document.querySelector(g.year).value,
    }),
    group
  );

  if (actual.day !== dayValue || actual.month !== monthValue || actual.year !== yearValue) {
    const err = new Error(
      `Date did not stick: expected ${yearValue}-${monthValue}-${dayValue}, got ${actual.year}-${actual.month}-${actual.day}`
    );
    err.statusCode = 502;
    throw err;
  }
}

async function setDateRange(page, { start, end }) {
  await setDateFilter(page, selectors.releveFilter.start, start);
  await setDateFilter(page, selectors.releveFilter.end, end);
}

async function submitReleveFilter(page) {
  await humanClick(page, selectors.releveFilter.submitButton);
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  const hasResultsTable = await page
    .waitForSelector(selectors.releveResults.table, { visible: true, timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  if (!hasResultsTable) {
    const err = new Error(`No results table appeared after submit (landed on ${page.url()})`);
    err.statusCode = 502;
    throw err;
  }
}

async function extractReleveSummary(page) {
  const text = await page
    .$eval(selectors.releveResults.summaryBlock, (el) => el.innerText)
    .catch(() => '');

  const accountMatch = text.match(/Compte\s*:\s*(\d+)/);
  const fromMatch = text.match(/Relevé du\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
  const toMatch = text.match(/Au\s*:\s*(\d{2}\/\d{2}\/\d{4})/);

  return {
    account: accountMatch ? accountMatch[1] : null,
    fromDate: fromMatch ? parseFrenchDate(fromMatch[1]) : null,
    toDate: toMatch ? parseFrenchDate(toMatch[1]) : null,
  };
}

async function extractReleveRows(page) {
  const rawRows = await page.$$eval(selectors.releveResults.tableRowSelector, (rows) =>
    rows.map((row) => {
      const cells = row.querySelectorAll('td');
      const amountCell = cells[4];
      const amountSpan = amountCell ? amountCell.querySelector('span') : null;
      return {
        date: cells[0] ? cells[0].textContent.trim() : null,
        operationCode: cells[1] ? cells[1].textContent.trim() : null,
        details: cells[2] ? cells[2].textContent.trim() : null,
        counterAccount: cells[3] ? cells[3].textContent.trim() : null,
        amountRaw: amountCell ? amountCell.textContent.trim() : null,
        amountClass: amountSpan
          ? amountSpan.classList.contains('success')
            ? 'credit'
            : amountSpan.classList.contains('danger')
            ? 'debit'
            : null
          : null,
        taxRaw: cells[5] ? cells[5].textContent.trim() : null,
        balanceRaw: cells[6] ? cells[6].textContent.trim() : null,
      };
    })
  );

  return rawRows.map((row) => {
    const amount = parseAmount(row.amountRaw);
    const rowErrors = [];

    if (amount === null) rowErrors.push('unparsable amount');
    if (!row.date || !parseFrenchDate(row.date)) rowErrors.push('unparsable date');
    if (amount !== null && row.amountClass) {
      const signMatchesClass =
        (amount >= 0 && row.amountClass === 'credit') || (amount < 0 && row.amountClass === 'debit');
      if (!signMatchesClass) rowErrors.push('amount sign does not match credit/debit styling');
    }

    return {
      date: parseFrenchDate(row.date),
      operationCode: row.operationCode ? row.operationCode.trim() : null,
      details: row.details,
      counterAccount: row.counterAccount,
      amount,
      tax: parseAmount(row.taxRaw),
      balance: parseAmount(row.balanceRaw),
      valid: rowErrors.length === 0,
      errors: rowErrors,
    };
  });
}

async function extractReleve(page) {
  const summary = await extractReleveSummary(page);
  const transactions = await extractReleveRows(page);

  return {
    extractedAt: new Date().toISOString(),
    summary,
    transactionCount: transactions.length,
    invalidCount: transactions.filter((t) => !t.valid).length,
    transactions,
  };
}

async function openPortal() {
  const { loginUrl } = config.algeriePoste;

  if (!loginUrl) {
    const err = new Error('ALGERIE_POSTE_LOGIN_URL is not set in .env');
    err.statusCode = 500;
    throw err;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: config.puppeteerHeadless,
      defaultViewport: { width: 1366, height: 900 },
      userDataDir: config.puppeteerUserDataDir,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      // --disable-dev-shm-usage: Docker's default /dev/shm is 64MB, too small for
      // Chrome's shared memory use — without this flag Chrome renders pages fine
      // then crashes mid-run inside a container. Harmless outside Docker too.
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (err) {
    const wrapped = new Error(`failed to launch the browser: ${err.message}`);
    wrapped.statusCode = 500;
    throw wrapped;
  }

  // Past this point the browser exists — if anything below fails, close it
  // here rather than leaving it to the caller, which only learns about the
  // browser from this function's return value and never gets one on failure.
  try {
    const page = await browser.newPage();
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });
    return { browser, page };
  } catch (err) {
    await browser.close().catch(() => {});
    const wrapped = new Error(`could not reach the Algerie Poste portal at ${loginUrl}: ${err.message}`);
    wrapped.statusCode = 502;
    throw wrapped;
  }
}

module.exports = {
  openPortal,
  restoreSession,
  restoreSessionWithCookies,
  normalizeCookie,
  goToReleve,
  setDateFilter,
  setDateRange,
  submitReleveFilter,
  extractReleve,
};
