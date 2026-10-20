const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_NODE_MODULES || 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }));

(async () => {
  const contact = { id: 'test-only', storeId: 0, storeName: 'テスト店舗（本番には保存しません）', body: '<script>文字列として表示</script>\nお問い合わせのテスト', email: 'test@example.test', status: 'unread', memo: '', createdAt: '2026-10-21T00:00:00Z', updatedAt: '2026-10-21T00:00:00Z', revision: 1 };
  let empty = false;
  const server = http.createServer(async (req, res) => {
    res.setHeader('content-type', req.url.startsWith('/api/') ? 'application/json' : 'text/html; charset=utf-8');
    if (req.method === 'PUT') {
      let body = ''; for await (const chunk of req) body += chunk;
      const update = JSON.parse(body); assert.equal(update.revision, contact.revision);
      Object.assign(contact, update, { revision: contact.revision + 1 });
      res.end(JSON.stringify({ message: '保存しました。', revision: contact.revision }));
    } else if (req.url.startsWith('/api/')) res.end(JSON.stringify({ items: empty ? [] : [contact], total: empty ? 0 : 1, page: 1 }));
    else res.end(fs.readFileSync('admin/contacts.html'));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    for (const width of [320, 375, 412, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 852 } });
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.locator('.contact').click();
      assert.equal(await page.locator('#body').textContent(), contact.body);
      assert.equal(await page.locator('#body script').count(), 0);
      await page.locator('#status').selectOption('in_progress');
      await page.locator('#memo').fill('幅' + width + 'の保存テスト');
      await page.locator('#save').click();
      await page.locator('#message').filter({ hasText: '保存しました。' }).waitFor();
      await page.locator('.contact').click();
      assert.equal(await page.locator('#memo').inputValue(), '幅' + width + 'の保存テスト');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width === 375) await page.screenshot({ path: path.join(process.env.TEMP, 'ishikawa-contacts-375.png'), fullPage: true });
      await page.close();
    }
    empty = true;
    const page = await browser.newPage(); await page.goto('http://127.0.0.1:' + server.address().port);
    await page.getByText('該当する連絡はありません。').waitFor();
    console.log('contacts UI: 320/375/412/1280px, safe text, selection, status/memo save, empty state OK');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
