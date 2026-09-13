const path = require('path');
const puppeteer = require('puppeteer-extra');
const { setDateRange } = require('../src/scraper/algeriePoste');
const selectors = require('../src/scraper/selectors');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const fixturePath = path.join(__dirname, 'fixtures', 'releve-filter-sample.html');
  await page.goto(`file://${fixturePath}`, { waitUntil: 'networkidle0' });

  console.log('--- happy path: set start=2026-01-15, end=2026-06-30 ---');
  await setDateRange(page, {
    start: { day: 15, month: 1, year: 2026 },
    end: { day: 30, month: 6, year: 2026 },
  });

  const actual = await page.evaluate((s) => ({
    start: {
      day: document.querySelector(s.releveFilter.start.day).value,
      month: document.querySelector(s.releveFilter.start.month).value,
      year: document.querySelector(s.releveFilter.start.year).value,
    },
    end: {
      day: document.querySelector(s.releveFilter.end.day).value,
      month: document.querySelector(s.releveFilter.end.month).value,
      year: document.querySelector(s.releveFilter.end.year).value,
    },
  }), selectors);
  console.log('read back:', JSON.stringify(actual));

  console.log('\n--- error path: day 32 does not exist as an option ---');
  try {
    await setDateFilterCheck(page);
  } catch (err) {
    console.log('threw as expected:', err.message);
  }

  await browser.close();
})();

async function setDateFilterCheck(page) {
  const { setDateFilter } = require('../src/scraper/algeriePoste');
  const selectors = require('../src/scraper/selectors');
  await setDateFilter(page, selectors.releveFilter.start, { day: 32, month: 1, year: 2026 });
}
