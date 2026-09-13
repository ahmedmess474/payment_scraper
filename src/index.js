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

// Every mounted route already handles its own errors and always resolves
// with res.json(...) — these two are the fallback for what's left: a request
// to a route that doesn't exist, and body-parser's own error (invalid JSON),
// which fires from middleware before any route handler runs. Without this,
// both fall through to Express's default handler, which replies with HTML
// instead of JSON and, outside NODE_ENV=production, includes a stack trace.
app.use((req, res) => {
  res.status(404).json({ error: `not found: ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'request body must be valid JSON' });
  }
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.message || 'internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`payment-scraper listening on port ${config.port}`);
});

server.on('error', (err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
