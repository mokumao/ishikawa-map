#!/usr/bin/env node
// -*- coding: utf-8 -*-

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const requests = [];
const emails = [];
const context = {
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => ({ GITHUB_TOKEN: 'test-token', ADMIN_EMAIL: 'admin@example.test' })[key] || '',
    }),
  },
  UrlFetchApp: {
    fetch: (url, options) => {
      requests.push({ url, options });
      return { getResponseCode: () => 204, getContentText: () => '' };
    },
  },
  MailApp: { sendEmail: (message) => emails.push(message) },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    computeDigest: () => Array.from({ length: 32 }, (_, index) => index),
  },
  console,
};
vm.createContext(context);
const handlerFile = path.resolve(__dirname, '..', 'integrations', 'google-apps-script', 'owner-request-handler.gs');
const source = fs.readFileSync(handlerFile, 'utf8');
new vm.Script(`${source}\n;globalThis.handler = { ownerRequestOnFormSubmit };`, { filename: handlerFile }).runInContext(context);

function eventWith(payload) {
  return {
    response: {
      getId: () => 'response-id',
      getTimestamp: () => new Date('2026-09-06T01:02:03Z'),
      getItemResponses: () => [{ getResponse: () => payload }],
    },
  };
}

context.handler.ownerRequestOnFormSubmit(eventWith([
  '【店舗主向け依頼】',
  '依頼種別：削除依頼',
  '店舗番号：0',
  '店舗名：【テスト用】石川ビーチ海上店',
  '店舗主確認：はい',
  '希望対応：一時的に非表示',
  '理由（任意）：閉店したため',
  'メールアドレス：owner@example.test',
].join('\n')));

assert.strictEqual(requests.length, 1);
const dispatched = JSON.parse(requests[0].options.payload);
assert.strictEqual(dispatched.event_type, 'owner_delete_request');
assert.strictEqual(dispatched.client_payload.store_id, '0');
assert.strictEqual(dispatched.client_payload.reason_provided, true);
assert.ok(!requests[0].options.payload.includes('閉店したため'));
assert.ok(!requests[0].options.payload.includes('owner@example.test'));
assert.ok(emails[0].body.includes('閉店したため'));

context.handler.ownerRequestOnFormSubmit(eventWith([
  '【店舗再掲載依頼】',
  '店舗番号：0',
  '店舗名：【テスト用】石川ビーチ海上店',
  '再掲載を希望する理由：営業再開',
].join('\n')));
assert.strictEqual(requests.length, 1);
assert.ok(emails[1].subject.includes('再掲載依頼'));

assert.throws(() => context.handler.ownerRequestOnFormSubmit(eventWith([
  '【店舗主向け依頼】',
  '依頼種別：削除依頼',
  '店舗番号：0',
  '店舗主確認：いいえ',
  '希望対応：一時的に非表示',
].join('\n'))), /店舗主確認/);

console.log('owner_request_handler tests: OK');
