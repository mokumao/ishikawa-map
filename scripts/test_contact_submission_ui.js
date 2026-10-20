const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));
(async () => {
  const server = http.createServer((req, res) => {
    const file = req.url.startsWith('/restaurants-data.js') ? 'restaurants-data.js' : 'owner-request.html';
    res.setHeader('content-type', file.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    for (const width of [375, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 852 } });
      let sent = [], google = 0;
      await page.route('**/api/v1/contact-config', route => route.fulfill({ json: { enabled: true }, headers: { 'access-control-allow-origin': '*' } }));
      await page.route('**/api/v1/contacts', async route => {
        const body = route.request().postDataJSON(); sent.push(body);
        await route.fulfill({ status: sent.length === 1 ? 500 : 201, json: sent.length === 1 ? { message: '再送信のテストです' } : { id: body.id, message: 'ご連絡を受け付けました。' }, headers: { 'access-control-allow-origin': '*' } });
      });
      await page.route('https://docs.google.com/**', route => { google++; return route.fulfill({ body: 'test only' }); });
      await page.goto('http://127.0.0.1:' + server.address().port + '/owner-request.html?id=0');
      await page.locator('[data-request-type="other"]').click();
      await page.locator('#otherDetails').fill('ローカルだけの受付テスト');
      await page.locator('#submitBtn').click();
      await page.locator('#formStatus').filter({ hasText: '再送信のテスト' }).waitFor();
      assert.equal(await page.locator('#otherDetails').inputValue(), 'ローカルだけの受付テスト');
      await page.locator('#submitBtn').click();
      await page.locator('#successCard').waitFor({ state: 'visible' });
      assert.equal(sent.length, 2); assert.equal(sent[0].id, sent[1].id); assert.equal(google, 0);
      assert.equal(sent[1].storeId, 0);
      await page.close();
    }
    console.log('submission UI: 375/1280px, error preserves input, same-ID retry, confirmed success, no Google submission OK');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
