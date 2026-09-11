#!/usr/bin/env node
// -*- coding: utf-8 -*-

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const requests = [];
const emails = [];
const cacheValues = new Map();
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
  CacheService: {
    getScriptCache: () => ({
      put: (key, value) => cacheValues.set(key, value),
      get: (key) => cacheValues.get(key) || null,
      remove: (key) => cacheValues.delete(key),
    }),
  },
  HtmlService: {
    createHtmlOutput: (html) => ({
      html,
      title: '',
      setTitle(title) { this.title = title; return this; },
    }),
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    getUuid: () => '01234567-89ab-cdef-0123-456789abcdef',
    computeDigest: () => Array.from({ length: 32 }, (_, index) => index),
  },
  console,
};
vm.createContext(context);
const handlerFile = path.resolve(__dirname, '..', 'integrations', 'google-apps-script', 'owner-request-handler.gs');
const source = fs.readFileSync(handlerFile, 'utf8');
new vm.Script(`${source}\n;globalThis.handler = { ownerRequestOnFormSubmit, doGet, doPost };`, { filename: handlerFile }).runInContext(context);

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

const confirmPage = context.handler.doGet({
  parameter: {
    action: 'restore',
    store_id: '0',
    store_name: '【テスト用】石川ビーチ海上店',
  },
});
assert.ok(confirmPage.html.includes('本当に地図に再表示しますか？'));
assert.ok(confirmPage.html.includes('0123456789abcdef0123456789abcdef'));

const restoredPage = context.handler.doPost({
  parameter: { nonce: '0123456789abcdef0123456789abcdef' },
});
assert.ok(restoredPage.html.includes('再表示を受け付けました'));
assert.strictEqual(requests.length, 2);
const restoreDispatch = JSON.parse(requests[1].options.payload);
assert.strictEqual(restoreDispatch.event_type, 'admin_restore_request');
assert.strictEqual(restoreDispatch.client_payload.store_id, '0');
assert.ok(!restoreDispatch.client_payload.store_name);
assert.ok(emails[2].subject.includes('再表示'));

const reusedPage = context.handler.doPost({
  parameter: { nonce: '0123456789abcdef0123456789abcdef' },
});
assert.ok(reusedPage.html.includes('有効期限が切れました'));
assert.strictEqual(requests.length, 2);

console.log('owner_request_handler tests: OK');
