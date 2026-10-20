const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

(async () => {
  const contacts = await import(pathToFileURL(path.resolve('admin-notice-api/src/contacts.js')));
  for (const input of [null, { status: 'published', memo: '', revision: 1 }, { status: 'done', memo: 'x'.repeat(10001), revision: 1 }, { status: 'done', memo: '', revision: 0 }]) {
    assert.throws(() => contacts.validateContactUpdate(input), error => error.status === 400);
  }
  let written;
  const db = { prepare(sql) { return { bind(...args) { written = { sql, args }; return this; }, async run() { return { meta: { changes: 1 } }; }, async first() { return { total: 1 }; }, async all() { return { results: [] }; } }; } };
  const result = await contacts.updateContact(db, 'admin@example.test', 'test-contact', { status: 'done', memo: '<script>test</script>', revision: 3 });
  assert.equal(result.revision, 4);
  assert.equal(written.args[1], '<script>test</script>');
  assert.equal(written.args[3], 'admin@example.test');
  assert.match(written.sql, /WHERE id = \? AND revision = \?/);
  const conflictDb = { prepare() { return { bind() { return this; }, async run() { return { meta: { changes: 0 } }; } }; } };
  await assert.rejects(contacts.updateContact(conflictDb, 'admin', 'x', { status: 'done', memo: '', revision: 1 }), error => error.status === 409);
  await assert.rejects(contacts.listContacts(db, new URL('https://test/?status=published')), error => error.status === 400);
  await assert.rejects(contacts.listContacts(db, new URL('https://test/?page=-1')), error => error.status === 400);
  await contacts.listContacts(db, new URL('https://test/?status=done&page=2'));
  assert.deepEqual(written.args, ['done', 50]);
  const source = fs.readFileSync('admin-notice-api/src/index.js', 'utf8')
    .replace(/^import .*;\r?\n/gm, '');
  const worker = (await import('data:text/javascript;base64,' + Buffer.from(
    'const adminPage="page", contactsPage="contacts"; const listContacts=()=>{throw Error("unexpected database access")};\n' + source
  ).toString('base64'))).default;
  const env = { ADMIN_EMAILS: 'admin@example.test' };
  for (const endpoint of ['/contacts', '/api/v1/admin/contacts', '/api/v1/admin/contacts/test']) {
    const request = new Request('https://test' + endpoint, { method: endpoint.endsWith('/test') ? 'PUT' : 'GET' });
    assert.equal((await worker.fetch(request, env, {})).status, 401);
    assert.equal((await worker.fetch(request, env, { access: { getIdentity: async () => ({ email: 'outsider@example.test' }) } })).status, 403);
  }
  console.log('owner contacts validation, concurrency, pagination, authorization: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
