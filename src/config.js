require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  algeriePoste: {
    loginUrl: process.env.ALGERIE_POSTE_LOGIN_URL,
    username: process.env.ALGERIE_POSTE_USERNAME,
    password: process.env.ALGERIE_POSTE_PASSWORD,
  },
  puppeteerHeadless: process.env.PUPPETEER_HEADLESS !== 'false',
  dataDir: require('path').join(__dirname, '..', 'data'),
};
