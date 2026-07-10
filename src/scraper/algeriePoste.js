const puppeteer = require('puppeteer');
const config = require('../config');

async function openPortal() {
  const { loginUrl } = config.algeriePoste;

  if (!loginUrl) {
    throw new Error('ALGERIE_POSTE_LOGIN_URL is not set in .env');
  }

  const browser = await puppeteer.launch({
    // headless: config.puppeteerHeadless,
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto(loginUrl, { waitUntil: 'networkidle2' });

  return { browser, page };
}

module.exports = { openPortal };
