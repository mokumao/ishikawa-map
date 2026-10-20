const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sent = [], cache = new Map();
const props = new Map([['CONTACT_MAIL_TOKEN', 'test-secret-32-characters-or-more'], ['ADMIN_EMAIL', 'test@example.test']]);
const context = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
  MailApp: { sendEmail: message => sent.push(message), getRemainingDailyQuota: () => 10 },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
});
vm.runInContext(fs.readFileSync('integrations/google-apps-script/contact-notification.gs', 'utf8'), context);
const contactId = '12345678-1234-1234-1234-123456789abc';
const call = token => context.doPost({ postData: { contents: JSON.stringify({ token, contactId }) } });
assert.equal(call('wrong').ok, false); assert.equal(sent.length, 0);
assert.equal(call(props.get('CONTACT_MAIL_TOKEN')).ok, true);
assert.equal(call(props.get('CONTACT_MAIL_TOKEN')).ok, true); assert.equal(sent.length, 1);
assert.equal(sent[0].to, 'test@example.test');
assert(sent[0].body.includes('/contacts')); assert(!sent[0].body.includes('test@example.test'));
console.log('mail script: secret check, fixed recipient, duplicate suppression, private-data-free message OK');
