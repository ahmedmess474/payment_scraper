const express = require('express');
const cors = require('cors');
const config = require('./config');
const healthRoute = require('./routes/health');
const scrapeRoute = require('./routes/scrape');
const sessionCookiesRoute = require('./routes/sessionCookies');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/health', healthRoute);
app.use('/scrape', scrapeRoute);
app.use('/session-cookies', sessionCookiesRoute);

app.listen(config.port, () => {
  console.log(`payment-scraper listening on port ${config.port}`);
});
