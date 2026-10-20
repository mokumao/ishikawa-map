const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const api = await import(pathToFileURL(path.resolve('admin-notice-api/src/contact-intake.js')));
  const valid = { id: crypto.randomUUID(), storeId: 0, storeName: 'テスト用店舗', body: 'テストの連絡', email: '', consent: false };
  for (const change of [{ body: '' }, { email: 'not-email' }, { email: 'test@example.test', consent: false }, { body: 'x'.repeat(5001) }, { id: '../contact' }, { storeId: -1 }, { website: 'spam' }]) {
    assert.throws(() => api.validateIntake({ ...valid, ...change }), error => error.status === 400);
  }
  assert.equal(api.intakeReady({}), false);
  const env = { CONTACTS_LIVE: 'true', CONTACT_MAIL_URL: 'https://script.google.com/macros/s/test/exec', CONTACT_MAIL_TOKEN: 'test-only-token-for-local-checks-32-chars' };
  assert.equal(api.intakeReady(env), true);
  const rows = new Map(); let notification = null;
  env.DB = {
    prepare(sql) {
      return { args: [], bind(...args) { this.args = args; return this; },
        async first() {
          if (sql.startsWith('SELECT submission_')) return rows.has(this.args[0]) ? { fingerprint: rows.get(this.args[0]) } : null;
          if (sql.includes('RETURNING count')) return { count: 1 };
          throw Error(sql);
        },
        async all() { return { results: notification?.state === 'pending' ? [{ id: notification.id }] : [] }; },
        async run() {
          if (sql.includes('INSERT INTO owner_contacts')) rows.set(this.args[0], this.args[7]);
          if (sql.includes('INSERT INTO contact_notifications')) notification = { id: this.args[0], state: 'pending' };
          if (sql.includes("state = 'sent'")) notification.state = 'sent';
          return { meta: { changes: 1 } };
        }
      };
    },
    async batch(statements) { for (const statement of statements) await statement.run(); }
  };
  const request = data => new Request('https://test/api/v1/contacts', { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '127.0.0.1' }, body: JSON.stringify(data) });
  await assert.rejects(api.receiveContact(request(valid), {}), error => error.status === 503);
  assert.equal((await api.receiveContact(request(valid), env)).id, valid.id);
  assert.equal((await api.receiveContact(request(valid), env)).id, valid.id);
  assert.equal(rows.size, 1);
  await assert.rejects(api.receiveContact(request({ ...valid, body: '変更内容' }), env), error => error.status === 409);
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => { throw Error('test network failure'); };
    await api.deliverNotifications(env); assert.equal(notification.state, 'pending');
    global.fetch = async (url, options) => {
      const data = JSON.parse(options.body);
      assert.equal(data.contactId, valid.id); assert(!('email' in data)); assert(!('body' in data));
      return Response.json({ ok: true, contactId: valid.id });
    };
    await api.deliverNotifications(env); assert.equal(notification.state, 'sent');
  } finally { global.fetch = originalFetch; }
  console.log('intake: validation, disabled gate, receipt, retry deduplication, conflict, durable mail retry OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
