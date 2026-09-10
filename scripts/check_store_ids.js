// 店舗ID移行後の不変条件とサイトマップ整合を検査する。
// 実行: node scripts/check_store_ids.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

// ファイル実行と標準入力経由の検証のどちらでも、リポジトリ直下から実行する。
const ROOT = process.cwd();
const BASELINE_MAX_ID = 73;
const BASELINE_HASH = '23d3211082d0325726c32e433c7299d85573fa6a69f3012eee3aa151617277e0';

function loadRestaurants() {
  const source = fs.readFileSync(path.join(ROOT, 'restaurants-data.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source};this.__restaurants = restaurants;`, context);
  return JSON.parse(JSON.stringify(context.__restaurants));
}

function fail(messages) {
  messages.forEach((message) => console.error(`ERROR: ${message}`));
  process.exitCode = 1;
}

const restaurants = loadRestaurants();
const errors = [];
const ids = restaurants.map((item) => item.id);
const codes = restaurants.map((item) => item.code);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
const duplicateCodes = codes.filter((code, index) => codes.indexOf(code) !== index);

if (duplicateIds.length) errors.push(`idが重複しています: ${[...new Set(duplicateIds)].join(', ')}`);
if (duplicateCodes.length) errors.push(`codeが重複しています: ${[...new Set(duplicateCodes)].join(', ')}`);

for (const item of restaurants) {
  if (item.code !== `47213-IS-${item.id}`) {
    errors.push(`idとcodeが一致しません: id=${item.id}, code=${item.code}, name=${item.name}`);
  }
}

const demo = restaurants.find((item) => item.id === 0);
if (!demo || demo.status !== 'test' || demo.publicDemo !== true) {
  errors.push('id: 0はstatus: testかつpublicDemo: trueの公開テスト店舗である必要があります');
}
if (restaurants.some((item) => item.id > 0 && item.publicDemo)) {
  errors.push('id: 0以外にpublicDemo店舗があります');
}

const baseline = restaurants
  .filter((item) => item.id <= BASELINE_MAX_ID)
  .sort((a, b) => a.id - b.id)
  .map((item) => [item.id, item.code, item.name].join('\t'))
  .join('\n');
const baselineHash = crypto.createHash('sha256').update(baseline).digest('hex');
if (baselineHash !== BASELINE_HASH) {
  errors.push('確定済みのid・code・店舗名対応が変更されています。意図的な店名変更でも管理者確認後に基準更新が必要です');
}

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapIds = [...sitemap.matchAll(/detail\.html\?id=(\d+)/g)].map((match) => Number(match[1]));
const publishedIds = restaurants
  .filter((item) => !item.status || item.status === 'published')
  .map((item) => item.id)
  .sort((a, b) => a - b);
if (JSON.stringify(sitemapIds) !== JSON.stringify(publishedIds)) {
  errors.push('sitemap.xmlの店舗ID一覧がpublished店舗と一致しません。サイトマップを再生成してください');
}

if (errors.length) {
  fail(errors);
} else {
  console.log(`OK: 店舗${restaurants.length}件、確定済みID 0-${BASELINE_MAX_ID}、サイトマップ${sitemapIds.length}件を確認しました`);
}
