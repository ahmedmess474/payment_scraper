const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const { extractReleve } = require('../src/scraper/algeriePoste');
const { filterTransfersAndDeposits } = require('../src/utils/transactions');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const fixturePath = path.join(__dirname, 'fixtures', 'releve-sample.html');
  await page.goto(`file://${fixturePath}`, { waitUntil: 'networkidle0' });

  const result = await extractReleve(page);

  console.log('summary:', result.summary);
  console.log('transactionCount:', result.transactionCount);
  console.log('invalidCount:', result.invalidCount);
  if (result.invalidCount > 0) {
    console.log('invalid rows:', result.transactions.filter((t) => !t.valid));
  }
  console.log('first row:', result.transactions[0]);
  console.log('last row:', result.transactions[result.transactions.length - 1]);

  const outPath = path.join(__dirname, '..', 'data', 'releve-fixture-test.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log('written to:', outPath);

  const transfers = filterTransfersAndDeposits(result);
  console.log('\ntransfers/deposits count:', transfers.transactionCount);

  const transfersOutPath = path.join(__dirname, '..', 'data', 'releve-fixture-test-transfers.json');
  fs.writeFileSync(transfersOutPath, JSON.stringify(transfers, null, 2));
  console.log('written to:', transfersOutPath);

  await browser.close();
})();
