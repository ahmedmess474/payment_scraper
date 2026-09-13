const express = require('express');
const cors = require('cors');
const config = require('./config');
const healthRoute = require('./routes/health');
const scrapeRoute = require('./routes/scrape');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/health', healthRoute);
app.use('/scrape', scrapeRoute);

app.listen(config.port, () => {
  console.log(`payment-scraper listening on port ${config.port}`);
});
