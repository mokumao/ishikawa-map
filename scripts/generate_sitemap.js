#!/usr/bin/env node
// -*- coding: utf-8 -*-
// restaurants-data.js から sitemap.xml を自動生成する。
// 実行: node scripts/generate_sitemap.js
// 出力: プロジェクトルートの sitemap.xml（上書き生成）
//
// 含めるURL:
//   - トップページ
//   - 既存の固定ページ（about-*.html, news/index.html）
//   - 各店舗ページ（detail.html?id=N）※ status が "published"（または未指定）のみ
//     test / hidden / pending / refused の店舗は除外する（CLAUDE.md参照）

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE_URL = 'https://mokumao.github.io/ishikawa-map';

// restaurants-data.js を実行して restaurants 配列を取得する
// （ファイル自体は読み込むだけで一切変更しない）
function loadRestaurants() {
  const src = fs.readFileSync(path.join(ROOT, 'restaurants-data.js'), 'utf8');
  const wrapped = src.replace('const restaurants', 'global.__restaurants_for_sitemap');
  eval(wrapped);
  return global.__restaurants_for_sitemap;
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

function urlEntry(loc, { changefreq, priority } = {}) {
  let xml = '  <url>\n';
  xml += `    <loc>${xmlEscape(loc)}</loc>\n`;
  xml += `    <lastmod>${todayISO()}</lastmod>\n`;
  if (changefreq) xml += `    <changefreq>${changefreq}</changefreq>\n`;
  if (priority !== undefined) xml += `    <priority>${priority.toFixed(1)}</priority>\n`;
  xml += '  </url>\n';
  return xml;
}

const restaurants = loadRestaurants();
// statusが"published"、または未指定の店舗のみ対象（CLAUDE.mdの表示制御ルールに準拠）
const published = restaurants.filter((r) => !r.status || r.status === 'published');

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

// トップページ
xml += urlEntry(`${BASE_URL}/`, { changefreq: 'daily', priority: 1.0 });

// 既存の固定ページ
const staticPages = [
  'about-site.html',
  'about-ishikawa.html',
  'about-purpose.html',
  'about-accuracy.html',
  'about-management.html',
  'about-recruit.html',
];
staticPages.forEach((p) => {
  xml += urlEntry(`${BASE_URL}/${p}`, { changefreq: 'monthly', priority: 0.5 });
});

// 「今日の石川ニュース」
xml += urlEntry(`${BASE_URL}/news/index.html`, { changefreq: 'daily', priority: 0.6 });

// ニュース・店舗主・管理者のお知らせをまとめたページ
xml += urlEntry(`${BASE_URL}/updates/index.html`, { changefreq: 'daily', priority: 0.6 });

// 店舗詳細ページ（公開中のみ、id昇順）
published
  .slice()
  .sort((a, b) => a.id - b.id)
  .forEach((r) => {
    xml += urlEntry(`${BASE_URL}/detail.html?id=${r.id}`, { changefreq: 'weekly', priority: 0.8 });
  });

xml += '</urlset>\n';

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');

const totalUrls = 1 + staticPages.length + 2 + published.length;
console.log(`sitemap.xml generated: total ${totalUrls} URLs`);
console.log(`  - top page: 1`);
console.log(`  - static pages: ${staticPages.length}`);
console.log(`  - news: 1`);
console.log(`  - updates: 1`);
console.log(`  - shop pages (published): ${published.length} / ${restaurants.length} total`);
