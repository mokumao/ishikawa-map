#!/usr/bin/env node
// -*- coding: utf-8 -*-
// 店舗主からの削除・再掲載依頼を、公開データへ個人情報を残さず反映する。

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA_FILE = path.join(PROJECT_ROOT, 'restaurants-data.js');
const DEFAULT_HTML_FILES = [
  path.join(PROJECT_ROOT, 'index.html'),
  path.join(PROJECT_ROOT, 'detail.html'),
  path.join(PROJECT_ROOT, 'owner-request.html'),
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--') || i + 1 >= argv.length) {
      throw new Error(`引数の形式が正しくありません: ${key}`);
    }
    args[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}

function validateInput(input) {
  if (!/^\d{1,6}$/.test(String(input.id || ''))) {
    throw new Error('店舗番号は1〜6桁の整数で指定してください。');
  }
  if (!['hide', 'restore'].includes(input.action)) {
    throw new Error('actionはhideまたはrestoreで指定してください。');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) {
    throw new Error('dateはYYYY-MM-DD形式で指定してください。');
  }
  if (!/^[a-f0-9]{12,64}$/.test(input.requestRef || '')) {
    throw new Error('request-refは12〜64桁の16進数で指定してください。');
  }
  const allowedKinds = ['', '一時的に非表示', '今後掲載しない'];
  if (!allowedKinds.includes(input.deleteKind || '')) {
    throw new Error('delete-kindが許可された値ではありません。');
  }
  if (!['true', 'false'].includes(String(input.reasonProvided || 'false'))) {
    throw new Error('reason-providedはtrueまたはfalseで指定してください。');
  }
}

function loadRestaurants(source, filename) {
  const context = {};
  vm.createContext(context);
  const exposed = `${source}\n;globalThis.__owner_request_restaurants = restaurants;`;
  new vm.Script(exposed, { filename }).runInContext(context, { timeout: 1000 });
  if (!Array.isArray(context.__owner_request_restaurants)) {
    throw new Error('restaurants配列を読み込めませんでした。');
  }
  return context.__owner_request_restaurants;
}

function findTopLevelObject(source, storeId) {
  const arrayStart = source.indexOf('const restaurants = [');
  if (arrayStart < 0) throw new Error('restaurants配列の開始位置が見つかりません。');

  let depth = 0;
  let objectStart = -1;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = source.indexOf('[', arrayStart) + 1; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1] || '';

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; i += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }

    if (char === '{') {
      if (depth === 0) objectStart = i;
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        const objectText = source.slice(objectStart, i + 1);
        if (new RegExp(`^\\s*id\\s*:\\s*${storeId}\\s*,`, 'm').test(objectText)) {
          return { start: objectStart, end: i + 1, text: objectText };
        }
        objectStart = -1;
      }
    }
  }
  throw new Error(`店舗番号${storeId}が見つかりません。`);
}

function appendStatusHistory(objectText, entry, eol) {
  const historyStart = objectText.search(/^\s{4}statusHistory\s*:\s*\[/m);
  if (historyStart >= 0) {
    const openBracket = objectText.indexOf('[', historyStart);
    let quote = '';
    let escaped = false;
    let depth = 0;
    for (let i = openBracket; i < objectText.length; i += 1) {
      const char = objectText[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === '[') depth += 1;
      if (char === ']') {
        depth -= 1;
        if (depth === 0) {
          const body = objectText.slice(openBracket + 1, i).trim();
          const separator = body.endsWith(',') ? eol : `,${eol}`;
          const addition = body ? `${separator}      ${entry}` : `${eol}      ${entry}${eol}    `;
          return objectText.slice(0, i) + addition + objectText.slice(i);
        }
      }
    }
    throw new Error('statusHistoryの終了位置が見つかりません。');
  }

  const insertAt = objectText.search(/^\s{4}(revisionHistory|twitter|instagram|website)\s*:/m);
  if (insertAt < 0) throw new Error('statusHistoryの挿入位置が見つかりません。');
  const block = `    statusHistory: [${eol}      ${entry}${eol}    ],${eol}`;
  return objectText.slice(0, insertAt) + block + objectText.slice(insertAt);
}

function nextCacheVersion(currentValues, date) {
  const day = date.replaceAll('-', '');
  let max = -1;
  currentValues.forEach((value) => {
    const match = value.match(/^(\d{8})([a-z]+)$/);
    if (!match || match[1] !== day) return;
    let number = 0;
    for (const char of match[2]) number = number * 26 + (char.charCodeAt(0) - 96);
    max = Math.max(max, number);
  });
  let value = max + 1;
  if (value <= 0) value = 1;
  let suffix = '';
  while (value > 0) {
    value -= 1;
    suffix = String.fromCharCode(97 + (value % 26)) + suffix;
    value = Math.floor(value / 26);
  }
  return day + suffix;
}

function updateCacheVersions(htmlFiles, date) {
  const versionPattern = /restaurants-data\.js\?v=([0-9]{8}[a-z]+)/g;
  const files = htmlFiles.map((filename) => ({ filename, text: fs.readFileSync(filename, 'utf8') }));
  const current = files.flatMap(({ text }) => [...text.matchAll(versionPattern)].map((match) => match[1]));
  if (current.length !== files.length) {
    throw new Error('restaurants-data.jsのキャッシュ番号を持たないHTMLがあります。');
  }
  const version = nextCacheVersion(current, date);
  files.forEach(({ filename, text }) => {
    fs.writeFileSync(filename, text.replace(versionPattern, `restaurants-data.js?v=${version}`), 'utf8');
  });
  return version;
}

function processRequest(options) {
  validateInput(options);
  const dataFile = options.dataFile || DEFAULT_DATA_FILE;
  const htmlFiles = options.htmlFiles || DEFAULT_HTML_FILES;
  const source = fs.readFileSync(dataFile, 'utf8');
  const restaurants = loadRestaurants(source, dataFile);
  const storeId = Number(options.id);
  const store = restaurants.find((item) => item.id === storeId);
  if (!store) throw new Error(`店舗番号${storeId}が見つかりません。`);

  const targetStatus = options.action === 'hide'
    ? 'hidden'
    : (storeId === 0 ? 'test' : 'published');
  const currentStatus = store.status || 'published';
  const existingHistory = Array.isArray(store.statusHistory) ? store.statusHistory : [];
  if (existingHistory.some((item) => item.requestRef === options.requestRef)) {
    return { changed: false, reason: 'duplicate', storeId, storeName: store.name, status: currentStatus };
  }
  if (currentStatus === targetStatus) {
    return { changed: false, reason: 'already-applied', storeId, storeName: store.name, status: currentStatus };
  }

  const object = findTopLevelObject(source, storeId);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let updatedObject = object.text;
  const statusPattern = /^(\s{4}status\s*:\s*)["'][^"']+["'](\s*,)/m;
  if (statusPattern.test(updatedObject)) {
    updatedObject = updatedObject.replace(statusPattern, `$1"${targetStatus}"$2`);
  } else {
    const idLine = /^(\s{4}id\s*:\s*\d+\s*,\s*)$/m;
    if (!idLine.test(updatedObject)) throw new Error('statusの挿入位置が見つかりません。');
    updatedObject = updatedObject.replace(idLine, `$1${eol}    status:      "${targetStatus}",`);
  }

  const reasonLabel = String(options.reasonProvided) === 'true'
    ? '削除理由あり・非公開記録参照'
    : '削除理由の記載なし';
  const note = options.action === 'hide'
    ? (options.deleteKind === '今後掲載しない'
      ? `店舗主からの削除依頼により非表示（今後の掲載拒否は管理者確認待ち・${reasonLabel}）`
      : `店舗主からの削除依頼により非表示（${reasonLabel}）`)
    : '店舗主からの再掲載依頼を管理者が確認し再掲載';
  const entry = `{ date: "${options.date}", from: "${currentStatus}", to: "${targetStatus}", note: "${note}", requestRef: "${options.requestRef}" }`;
  updatedObject = appendStatusHistory(updatedObject, entry, eol);

  const updatedSource = source.slice(0, object.start) + updatedObject + source.slice(object.end);
  loadRestaurants(updatedSource, dataFile);
  fs.writeFileSync(dataFile, updatedSource, 'utf8');
  const cacheVersion = updateCacheVersions(htmlFiles, options.date);
  return { changed: true, storeId, storeName: store.name, from: currentStatus, to: targetStatus, cacheVersion };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = processRequest({
    id: args.id,
    action: args.action,
    date: args.date,
    requestRef: args['request-ref'],
    deleteKind: args['delete-kind'] || '',
    reasonProvided: args['reason-provided'] || 'false',
  });
  console.log(JSON.stringify(result));
}

if (require.main === module) main();

module.exports = { findTopLevelObject, nextCacheVersion, processRequest, validateInput };
