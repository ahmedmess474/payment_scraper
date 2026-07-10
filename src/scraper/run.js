const { openPortal } = require('./algeriePoste');

(async () => {
  const { page } = await openPortal();
  console.log('Portal opened:', page.url());
  console.log('Browser left open for inspection — close the window or Ctrl+C here to stop.');
})();
