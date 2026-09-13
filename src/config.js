require('dotenv').config();

const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  algeriePoste: {
    baseUrl: process.env.ALGERIE_POSTE_BASE_URL,
    loginUrl: process.env.ALGERIE_POSTE_LOGIN_URL,
    releveUrl: process.env.ALGERIE_POSTE_RELEVE_URL,
    username: process.env.ALGERIE_POSTE_USERNAME,
    password: process.env.ALGERIE_POSTE_PASSWORD,
  },
  puppeteerHeadless: process.env.PUPPETEER_HEADLESS !== 'false',
  puppeteerUserDataDir: path.resolve(
    __dirname,
    '..',
    process.env.PUPPETEER_USER_DATA_DIR || './.puppeteer-profile'
  ),
  cost: {
    perMonthDa: Number(process.env.COST_PER_MONTH_DA || 40),
    perPageDa: Number(process.env.COST_PER_PAGE_DA || 5),
    confirmThresholdDa: Number(process.env.COST_CONFIRM_THRESHOLD_DA || 200),
  },
  sessionCookiesPath: path.resolve(
    __dirname,
    '..',
    process.env.SESSION_COOKIES_PATH || './secrets/session-cookies.json'
  ),
  dataDir: path.join(__dirname, '..', 'data'),
};
