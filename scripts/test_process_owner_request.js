#!/usr/bin/env node
// -*- coding: utf-8 -*-

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { processRequest, validateInput } = require('./process_owner_request');

function loadFixture(filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const context = {};
  vm.createContext(context);
  new vm.Script(`${source}\n;globalThis.result = restaurants;`).runInContext(context);
  return context.result;
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-request-test-'));
  const dataFile = path.join(root, 'restaurants-data.js');
  const htmlFiles = ['index.html', 'detail.html', 'owner-request.html'].map((name) => path.join(root, name));
  fs.writeFileSync(dataFile, `const restaurants = [
  {
    id:          0,
    status:      "test",
    name:        "テスト店舗",
    revisionHistory: []
  },
  {
    id:          1,
    status:      "published",
    name:        "通常店舗",
    statusHistory: [
      { date: "2026-08-01", from: "pending", to: "published", note: "掲載開始" },
    ],
    revisionHistory: []
  }
];
`, 'utf8');
  htmlFiles.forEach((filename) => fs.writeFileSync(filename, '<script src="restaurants-data.js?v=20260831b"></script>\n', 'utf8'));
  return { root, dataFile, htmlFiles };
}

function run() {
  const fixture = makeFixture();
  let actualFixtureRoot = '';
  try {
    const hidden = processRequest({
      id: '1', action: 'hide', date: '2026-09-06', requestRef: 'abcdef123456',
      deleteKind: '一時的に非表示', reasonProvided: 'true', dataFile: fixture.dataFile, htmlFiles: fixture.htmlFiles,
    });
    assert.strictEqual(hidden.changed, true);
    assert.strictEqual(hidden.to, 'hidden');
    assert.strictEqual(hidden.cacheVersion, '20260906a');
    let stores = loadFixture(fixture.dataFile);
    assert.strictEqual(stores[1].status, 'hidden');
    assert.strictEqual(stores[1].statusHistory.length, 2);
    assert.strictEqual(stores[1].statusHistory[1].requestRef, 'abcdef123456');
    assert.match(stores[1].statusHistory[1].note, /削除理由あり/);
    fixture.htmlFiles.forEach((filename) => {
      assert.match(fs.readFileSync(filename, 'utf8'), /restaurants-data\.js\?v=20260906a/);
    });

    const duplicate = processRequest({
      id: '1', action: 'hide', date: '2026-09-06', requestRef: 'abcdef123456',
      deleteKind: '一時的に非表示', reasonProvided: 'true', dataFile: fixture.dataFile, htmlFiles: fixture.htmlFiles,
    });
    assert.strictEqual(duplicate.changed, false);
    assert.strictEqual(duplicate.reason, 'duplicate');

    const restored = processRequest({
      id: '1', action: 'restore', date: '2026-09-06', requestRef: '123456abcdef',
      deleteKind: '', reasonProvided: 'false', dataFile: fixture.dataFile, htmlFiles: fixture.htmlFiles,
    });
    assert.strictEqual(restored.to, 'published');
    assert.strictEqual(restored.cacheVersion, '20260906b');
    stores = loadFixture(fixture.dataFile);
    assert.strictEqual(stores[1].status, 'published');
    assert.strictEqual(stores[1].statusHistory.length, 3);

    const testHidden = processRequest({
      id: '0', action: 'hide', date: '2026-09-06', requestRef: 'fedcba654321',
      deleteKind: '今後掲載しない', reasonProvided: 'false', dataFile: fixture.dataFile, htmlFiles: fixture.htmlFiles,
    });
    assert.strictEqual(testHidden.to, 'hidden');
    const testRestored = processRequest({
      id: '0', action: 'restore', date: '2026-09-06', requestRef: '654321fedcba',
      deleteKind: '', reasonProvided: 'false', dataFile: fixture.dataFile, htmlFiles: fixture.htmlFiles,
    });
    assert.strictEqual(testRestored.to, 'test');

    assert.throws(() => validateInput({ id: '1; echo bad', action: 'hide', date: '2026-09-06', requestRef: 'abcdef123456' }));
    assert.throws(() => validateInput({ id: '1', action: 'hide', date: '2026-09-06', requestRef: 'not-safe' }));
    assert.throws(() => validateInput({ id: '1', action: 'delete', date: '2026-09-06', requestRef: 'abcdef123456' }));

    actualFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-request-actual-'));
    const projectRoot = path.resolve(__dirname, '..');
    const actualDataFile = path.join(actualFixtureRoot, 'restaurants-data.js');
    const actualHtmlFiles = ['index.html', 'detail.html', 'owner-request.html'].map((name) => path.join(actualFixtureRoot, name));
    fs.copyFileSync(path.join(projectRoot, 'restaurants-data.js'), actualDataFile);
    actualHtmlFiles.forEach((filename) => fs.copyFileSync(path.join(projectRoot, path.basename(filename)), filename));
    const actualFormat = processRequest({
      id: '0', action: 'hide', date: '2026-09-06', requestRef: 'aa11bb22cc33',
      deleteKind: '一時的に非表示', reasonProvided: 'true',
      dataFile: actualDataFile, htmlFiles: actualHtmlFiles,
    });
    assert.strictEqual(actualFormat.changed, true);
    assert.strictEqual(loadFixture(actualDataFile).find((store) => store.id === 0).status, 'hidden');
    console.log('process_owner_request tests: OK');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
    if (actualFixtureRoot) fs.rmSync(actualFixtureRoot, { recursive: true, force: true });
  }
}

run();
