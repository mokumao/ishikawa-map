/* ================================================================
   うるま市石川 飲食店マップ — script.js
   地図: OpenStreetMap + Leaflet
================================================================ */

// ── スマホ：タブバーのスワイプでヘッダー操作・情報パネル表示 ────────
(function () {
  const tabs = document.querySelector('.mobile-tabs');
  if (!tabs) return;
  let startY = 0;

  tabs.addEventListener('touchstart', function (e) {
    startY = e.touches[0].clientY;
  }, { passive: true });

  tabs.addEventListener('touchend', function (e) {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy < -40) {
      // 上にスワイプ → ヘッダーを表示して通常状態に戻す
      document.body.classList.remove('header-collapsed');
    } else if (dy > 40) {
      // 下にスワイプ → 情報パネルを表示
      const appBody = document.getElementById('appBody');
      if (appBody) appBody.dataset.view = 'info';
      document.body.classList.add('info-open');
    }
  }, { passive: true });
})();

// ── 左側スワイプボタン（⬆⬇）のクリックハンドラ ──────────────────
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const upBtn   = document.getElementById('sideSwipeUp');
    const downBtn = document.getElementById('sideSwipeDown');
    if (!upBtn || !downBtn) return;

    upBtn.addEventListener('click', function () {
      // ヘッダー表示/非表示トグル
      document.body.classList.toggle('header-collapsed');
      if (typeof map !== 'undefined') setTimeout(() => map.invalidateSize(), 50);
    });

    downBtn.addEventListener('click', function () {
      // 情報パネルを開く
      const appBody = document.getElementById('appBody');
      if (appBody) {
        appBody.dataset.view = 'info';
        document.body.classList.add('info-open');
      }
    });
  });
})();

// ── 情報パネルの閉じるボタン（▲）・フッタースワイプで地図に戻る ────
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const footer = document.getElementById('infoPanelFooter');
    if (!footer) return;

    function closeInfoPanel() {
      const appBody = document.getElementById('appBody');
      if (appBody) {
        appBody.dataset.view = 'map';
        document.body.classList.remove('info-open');
        setTimeout(() => { if (typeof map !== 'undefined') map.invalidateSize(); }, 50);
      }
    }

    // 左右どちらの↑ボタンを押しても閉じる
    document.querySelectorAll('.info-close-btn').forEach(function(btn) {
      btn.addEventListener('click', closeInfoPanel);
    });

    // フッターを上にスワイプしても閉じる
    let startY = 0;
    footer.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY;
    }, { passive: true });
    footer.addEventListener('touchend', function (e) {
      const dy = e.changedTouches[0].clientY - startY;
      if (dy < -30) closeInfoPanel();
    }, { passive: true });
  });
})();

// ── 情報パネル：各ボタンのセクション表示 ────────────────────────────
function openInfoSection(section) {
  // 将来コンテンツを追加予定。現在は準備中メッセージを表示。
  const labels = {
    'about-site':     'このサイトについて',
    'about-ishikawa': '石川について',
    'faq':            'Q & A',
    'feedback':       'ご意見・ご要望'
  };
  alert('「' + (labels[section] || section) + '」のページは準備中です。');
}

// ── パスワード処理 ──────────────────────────────────────────────
(function () {
  const overlay = document.getElementById('passwordOverlay');
  if (!overlay) return;
  // localhost からのアクセスはパスワードをスキップ（プレビュー確認用）
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    overlay.classList.add('hidden');
    return;
  }
  // 同じブラウザセッションで認証済みならスキップ
  if (sessionStorage.getItem('authenticated') === '1') {
    overlay.classList.add('hidden');
    return;
  }
  // 未認証 → オーバーレイを表示してフォーカス
  document.getElementById('pwInput').focus();
})();

function checkPassword() {
  const input   = document.getElementById('pwInput');
  const errMsg  = document.getElementById('pwError');
  const overlay = document.getElementById('passwordOverlay');
  if (input.value === '321') {
    sessionStorage.setItem('authenticated', '1');
    overlay.classList.add('hidden');
    // オーバーレイ消去後に石川エリアを中央に表示
    setTimeout(() => {
      if (typeof map !== 'undefined') {
        map.setView(ISHIKAWA_CENTER, ISHIKAWA_ZOOM, { reset: true, animate: false });
      }
    }, 500);
  } else {
    errMsg.textContent = 'パスワードが違います。もう一度入力してください。';
    input.value = '';
    input.focus();
  }
}

// ── 店舗データ ─────────────────────────────────────────────────
const restaurants = [
  {
    name:      "酒楽場うまし家",
    genre:     "居酒屋",
    address:   "沖縄県うるま市石川1丁目28-18",
    hours:     "17:00〜翌1:00",
    closed:    "火曜日",
    note:      "創業40年超。石川社交街の老舗大衆居酒屋。県産無農薬野菜使用",
    sourceUrl: "https://umashiya.com/about/",
    warn:      false,
    lat:       26.430443,
    lng:       127.828701
  },
  {
    name:      "クリームソーダ",
    genre:     "バル（中華・和食・バー）",
    address:   "沖縄県うるま市石川白浜1-2-1 2F",
    hours:     "中華ランチ：月・木・金 11:30〜14:00\nBAR：年中無休 18:00〜\n中華ディナー：土・日 18:00〜21:00",
    closed:    "不定休",
    note:      "営業スタイルが複雑。訪問前に公式サイトで要確認",
    sourceUrl: "https://balcreamsoda.com/",
    warn:      false,
    lat:       26.427302,
    lng:       127.827541
  },
  {
    name:      "杏屋 石川店",
    genre:     "居酒屋・創作料理",
    address:   "沖縄県うるま市石川白浜1-4-7",
    hours:     "18:00〜翌3:00（料理L.O. 翌1:45）",
    closed:    "なし（年中無休）",
    note:      "深夜営業。個室あり。飲み放題コースあり",
    sourceUrl: "https://www.hotpepper.jp/strJ001017974/",
    warn:      false,
    lat:       26.428326,
    lng:       127.827701
  },
  {
    name:      "牛角 うるま石川店",
    genre:     "焼肉",
    address:   "沖縄県うるま市石川1-16-18",
    hours:     "16:00〜23:00",
    closed:    "年中無休",
    note:      "チェーン店（牛角グループ）",
    sourceUrl: "https://map.reins.co.jp/gyukaku/detail/989653529",
    warn:      false,
    lat:       26.431203,
    lng:       127.825063
  },
  {
    name:      "Capful（キャプフル）",
    genre:     "カフェ",
    address:   "沖縄県うるま市石川曙1丁目6-1",
    hours:     "7:30〜15:30（月〜木）\n7:30〜21:00（金・土・日）",
    closed:    "水曜日",
    note:      "元外国人住宅を改装。海が見えるテラス席。朝食営業あり",
    sourceUrl: "https://www.instagram.com/okinawa_capful/",
    warn:      false,
    lat:       26.420088,
    lng:       127.828450
  },
  {
    name:      "HINA CAFE（ヒナカフェ）",
    genre:     "カフェ・イタリアン",
    address:   "沖縄県うるま市石川白浜1-1-1 2F",
    hours:     "ランチ 11:30〜15:30\nディナー（金〜日）16:00〜22:00",
    closed:    "月〜水曜日",
    note:      "2023年6月オープン。本格イタリアン",
    sourceUrl: "https://hitosara.com/0004038163/",
    warn:      false,
    lat:       26.427231,
    lng:       127.827883
  },
  {
    name:      "GENCO（ジェンコ）",
    genre:     "カフェ・バー（ハワイ料理）",
    address:   "沖縄県うるま市石川伊波1515-32",
    hours:     "11:11〜15:00 / 17:00〜23:00",
    closed:    "火曜日",
    note:      "食べログに営業状況「未確認」の記載あり。訪問前に電話確認を推奨（098-988-5863）",
    sourceUrl: "https://tabelog.com/okinawa/A4703/A470302/47031510/",
    warn:      true,
    lat:       26.433345,
    lng:       127.808541
  },
  {
    name:      "Cafe Ajyute（カフェアジュテ）",
    genre:     "カフェ・パン",
    address:   "沖縄県うるま市石川2140-5",
    hours:     "月〜金 10:00〜16:00（L.O. 15:30）\n※パン売り切れ次第終了",
    closed:    "土・日・祝日",
    note:      "就労継続支援施設が運営。焼きたてパン食べ放題（1時間 1,000円・ドリンク込み）",
    sourceUrl: "https://ajyute.com/cafe-ajyute/",
    warn:      false,
    lat:       26.416168,
    lng:       127.832946
  },
  {
    name:      "喜食てんてん",
    genre:     "食堂・居酒屋",
    address:   "沖縄県うるま市石川山城1706-6",
    hours:     "ランチ 11:00〜13:30\n居酒屋 18:00〜24:00",
    closed:    "日曜日",
    note:      "チキンカツ定食が名物（もも肉1.5枚分のボリューム）。地元の人気食堂",
    sourceUrl: "https://tabelog.com/okinawa/A4703/A470302/47013479/",
    warn:      false,
    lat:       26.412381,
    lng:       127.820619
  },
  {
    name:      "居酒屋パラダイス",
    genre:     "居酒屋・食堂",
    address:   "沖縄県うるま市石川2丁目39-15",
    hours:     "ランチ 11:30〜15:00\n居酒屋 18:00〜24:00",
    closed:    "要確認（月・木、または水・第5日曜という情報あり）",
    note:      "ランチの骨汁・カツチャーハンが名物。地元客に人気",
    sourceUrl: "https://tabelog.com/okinawa/A4703/A470302/47007823/",
    warn:      true,
    lat:       26.427576,
    lng:       127.821275
  },

  // ── 追加10店舗（2026-05-08） ─────────────────────────────────────
  {
    name:      "まるみつ食堂",
    genre:     "沖縄そば・食堂",
    address:   "沖縄県うるま市石川東山1丁目22-11",
    hours:     "10:30〜14:30頃（売り切れ次第終了）",
    closed:    "水曜日（年末年始・旧盆休あり）",
    note:      "1949年創業の老舗。てびちそば・三枚肉そばが名物。地元民に愛され続ける昭和の食堂",
    sourceUrl: "https://ryukyu-entertainment.com/marumitu/",
    warn:      false,
    lat:       26.4347222,
    lng:       127.8380556
  },
  {
    name:      "和カフェ Agariyama（アガリヤマ）",
    genre:     "カフェ・八重山そば",
    address:   "沖縄県うるま市石川東山1-8-3",
    hours:     "水〜金 10:00〜15:00 / 17:00〜22:00\n土 10:00〜22:00 / 日 10:00〜19:00",
    closed:    "月・火曜日",
    note:      "2024年5月オープン。石垣島出身オーナーのログハウス風隠れ家カフェ。八重山そばも提供",
    sourceUrl: "https://omalblog.com/2024/12/08/uruma-gariyama/",
    warn:      false,
    lat:       26.4373232,
    lng:       127.8354213
  },
  {
    name:      "大衆酒場 照らす家 石川店",
    genre:     "居酒屋",
    address:   "沖縄県うるま市石川白浜1丁目3-5",
    hours:     "〜翌3:00（詳細は要確認）",
    closed:    "要確認",
    note:      "セルフスタイルの飲み放題（990円〜）が人気。訪問前に営業時間を確認推奨",
    sourceUrl: "https://tabelog.com/okinawa/A4703/A470302/47033173/",
    warn:      false,
    lat:       26.427654,
    lng:       127.8269779
  },
  {
    name:      "榮料理店（さかえりょうりてん）",
    genre:     "沖縄料理",
    address:   "沖縄県うるま市石川伊波1553-463",
    hours:     "18:00〜21:30",
    closed:    "日曜日・不定休",
    note:      "予約必須の本格沖縄料理店。コース料理のみ。地元・米軍関係者にも人気の名店",
    sourceUrl: "http://niraicuisine.com/",
    warn:      false,
    lat:       26.4341514,
    lng:       127.8112099
  },
  {
    name:      "パーラー K's Pit（ケーズピット）",
    genre:     "ハンバーガー",
    address:   "沖縄県うるま市石川曙1丁目2-17",
    hours:     "11:00〜18:00（L.O. 17:00）\n※18時以降は予約営業",
    closed:    "不定休",
    note:      "2022年オープン。本格アメリカンバーガー専門店。屋上にオーシャンビューテラス席あり",
    sourceUrl: "https://www.otv.co.jp/okitive/article/23464/",
    warn:      false,
    lat:       26.421304,
    lng:       127.826424
  },
  {
    name:      "たらの芽",
    genre:     "居酒屋・和食",
    address:   "沖縄県うるま市石川白浜2丁目3-2",
    hours:     "ランチ 12:00〜14:00\n夜 17:30〜翌1:00",
    closed:    "日曜日",
    note:      "地元民に愛される老舗の和食居酒屋。刺身定食・天ぷらが名物",
    sourceUrl: "https://tabelog.com/okinawa/A4703/A470302/47006947/",
    warn:      false,
    lat:       26.4272451,
    lng:       127.8270008
  },
  {
    name:      "石川 柿兵衛（かきべえ）",
    genre:     "焼き鳥・居酒屋",
    address:   "沖縄県うるま市石川1丁目14-2",
    hours:     "17:00〜翌2:00",
    closed:    "なし（年中無休）",
    note:      "備長炭で焼く本格焼き鳥居酒屋。飲み放題コースあり",
    sourceUrl: "https://www.hotpepper.jp/strJ001017977/",
    warn:      false,
    lat:       26.4298734,
    lng:       127.822802
  },
  {
    name:      "麺や KEIJIRO 石川店",
    genre:     "ラーメン",
    address:   "沖縄県うるま市石川1丁目28-19",
    hours:     "11:00〜16:00 / 18:00〜翌4:00",
    closed:    "不定休（月・金の昼営業なし）",
    note:      "石川店限定の濃厚鶏白湯スープが特徴。深夜4時まで営業",
    sourceUrl: "https://www.otv.co.jp/okitive/article/95697/",
    warn:      false,
    lat:       26.4303538,
    lng:       127.8286398
  },
  {
    name:      "石川の駅",
    genre:     "食堂",
    address:   "沖縄県うるま市石川赤崎2丁目2-1",
    hours:     "10:00〜20:00頃（要確認）",
    closed:    "要確認",
    note:      "ホームセンタータバタ石川店内の食堂。ステーキ定食・沖縄そばなどメニュー豊富",
    sourceUrl: "https://tabelog.com/okinawa/A4703/A470302/47011395/",
    warn:      false,
    lat:       26.4342224,
    lng:       127.8353657
  },
  {
    name:      "酒処 金の蔵（きんのくら）",
    genre:     "居酒屋・食堂",
    address:   "沖縄県うるま市石川1丁目28-9",
    hours:     "ランチ 11:00〜15:00\n夜 18:00〜24:00",
    closed:    "要確認",
    note:      "同じ建物に姉妹店「キンクラバーガー」あり",
    sourceUrl: "https://r.goope.jp/kinnokura/",
    warn:      false,
    lat:       26.430094,
    lng:       127.828385
  }
];

// ── 営業時間の省略表示 ────────────────────────────────────────────
function fmtHours(hours) {
  const lines  = hours.split('\n');
  const first  = lines[0];
  const more   = lines.length > 1;
  // 1行が長い場合は24文字で切る
  if (first.length > 24) return first.slice(0, 22) + '…';
  return more ? first + '…' : first;
}

// ── フィルター定義 ───────────────────────────────────────────────
const FILTERS = [
  { id: 'all',      label: 'すべて',       color: '#546e7a', test: () => true },
  { id: 'izakaya',  label: '居酒屋・食堂', color: '#e53935', test: g => g.includes('居酒屋') || g.includes('食堂') },
  { id: 'cafe',     label: 'カフェ',       color: '#00897b', test: g => g.includes('カフェ') },
  { id: 'yakiniku', label: '焼肉',         color: '#fb8c00', test: g => g.includes('焼肉') },
  { id: 'bar',      label: 'バル',         color: '#8e24aa', test: g => g.includes('バル') },
  { id: 'ramen',    label: 'ラーメン',     color: '#c62828', test: g => g.includes('ラーメン') },
];

let currentFilter = 'all';
let currentSearch  = '';

// ── ジャンル別マーカーカラー ────────────────────────────────────
const GENRE_COLORS = [
  { test: g => g.includes("焼肉"),      color: "#fb8c00" },
  { test: g => g.includes("バル"),      color: "#8e24aa" },
  { test: g => g.includes("カフェ"),    color: "#00897b" },
  { test: g => g.includes("ラーメン"),  color: "#c62828" },
  { test: g => g.includes("ハンバーガー"), color: "#f57f17" },
  { test: g => g.includes("沖縄料理"), color: "#2e7d32" },
  { test: g => g.includes("居酒屋") || g.includes("食堂"), color: "#e53935" },
];
const DEFAULT_COLOR = "#1565c0";
const WARN_COLOR    = "#f57c00";

function genreColor(genre) {
  for (const rule of GENRE_COLORS) {
    if (rule.test(genre)) return rule.color;
  }
  return DEFAULT_COLOR;
}

// ── SVG ピンアイコン生成 ─────────────────────────────────────────
function makePinIcon(fillColor, isWarn) {
  const color = isWarn ? WARN_COLOR : fillColor;
  const inner = isWarn
    ? `<text x="15" y="18" text-anchor="middle" font-size="11"
             font-weight="900" fill="${color}" font-family="sans-serif">!</text>`
    : "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 42" width="30" height="42">
      <path d="M15 1C8.1 1 2.5 6.6 2.5 13.5C2.5 22.9 15 41 15 41
               C15 41 27.5 22.9 27.5 13.5C27.5 6.6 21.9 1 15 1Z"
            fill="${color}" stroke="white" stroke-width="2.2"/>
      <circle cx="15" cy="13.5" r="5.5" fill="white" opacity="0.92"/>
      ${inner}
    </svg>`;
  return L.divIcon({
    className: "",
    html: svg,
    iconSize:   [30, 42],
    iconAnchor: [15, 42],
    popupAnchor:[0, -62]
  });
}

// ── Google マップ URL 生成 ────────────────────────────────────────
function gmapUrl(name, address) {
  return "https://www.google.com/maps/search/?api=1&query="
       + encodeURIComponent(name + " " + address);
}

// ── ポップアップ HTML 生成 ────────────────────────────────────────
function makePopup(r) {
  const hoursHtml  = r.hours.replace(/\n/g, "<br>");
  const closedHtml = (r.closed.includes("要確認"))
    ? `<span style="color:#e65100">${r.closed}</span>`
    : r.closed;
  const noteHtml = r.warn
    ? `<div class="popup-warning">⚠️ ${r.note}</div>`
    : `<tr>
         <td class="label">備考</td>
         <td class="value">${r.note}</td>
       </tr>`;

  return `
    <div class="popup-wrap">
      <div class="popup-name">${r.name}</div>
      <span class="popup-genre">${r.genre}</span>
      <table class="popup-table">
        <tr>
          <td class="label">住所</td>
          <td class="value">${r.address}</td>
        </tr>
        <tr>
          <td class="label">営業時間</td>
          <td class="value">${hoursHtml}</td>
        </tr>
        <tr>
          <td class="label">定休日</td>
          <td class="value">${closedHtml}</td>
        </tr>
        ${r.warn ? "" : noteHtml}
      </table>
      ${r.warn ? noteHtml : ""}
      <div class="popup-links">
        <a href="${gmapUrl(r.name, r.address)}"
           target="_blank" rel="noopener noreferrer"
           class="popup-btn gmap">📍 Googleマップで見る</a>
        <a href="${r.sourceUrl}"
           target="_blank" rel="noopener noreferrer"
           class="popup-btn source">🔗 情報源を見る</a>
      </div>
    </div>`;
}

// ── 地図初期化 ───────────────────────────────────────────────────
const map = L.map("map", {
  center: [26.430, 127.828],
  zoom:   14,
  zoomControl: false,  // デフォルト左上を無効化→左下に再配置
});

// ＋－ボタン：スマホ→左下、PC→左上
L.control.zoom({ position: window.innerWidth <= 767 ? 'bottomleft' : 'topleft' }).addTo(map);

// ダブルクリック/ダブルタップで 0.5 ずつズームイン（デフォルトの1段より細かく）
map.doubleClickZoom.disable();
map.on('dblclick', function () {
  map.zoomIn(0.5);
});


L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
  maxZoom: 19
}).addTo(map);

// 石川エリアの初期表示位置
const ISHIKAWA_CENTER = [26.430, 127.828];
const ISHIKAWA_ZOOM   = window.innerWidth <= 767 ? 13 : 14;

// 初期表示を石川エリアに固定（invalidateSizeを使わず直接setView）
setTimeout(() => {
  map.setView(ISHIKAWA_CENTER, ISHIKAWA_ZOOM, { reset: true, animate: false });
}, 500);

// ── ミニマップ（右上の概要図） ─────────────────────────────────────
(function () {
  const miniMapEl = document.getElementById('minimap');
  if (!miniMapEl) return;

  // ミニマップ中心 = 石川エリア中心（主地図の初期位置と同じ）
  const miniMap = L.map('minimap', {
    center:             ISHIKAWA_CENTER,
    zoom:               12,
    zoomControl:        false,
    attributionControl: false,
    dragging:           false,
    touchZoom:          false,
    doubleClickZoom:    false,
    scrollWheelZoom:    false,
    boxZoom:            false,
    keyboard:           false,
    tap:                false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(miniMap);

  // ★マーカー（メイン地図の中心位置を示す）
  const starIcon = L.divIcon({
    html:       '<span class="mini-star-icon">★</span>',
    className:  '',
    iconSize:   [20, 20],
    iconAnchor: [10, 10]
  });
  const miniStar = L.marker(ISHIKAWA_CENTER, {
    icon: starIcon, zIndexOffset: 1000
  }).addTo(miniMap);

  // ポップアップ中は move イベントで上書きしないためのフラグ
  let _popupOpen = false;

  // メイン地図のパンで★を追従（ポップアップ表示中はスキップ）
  map.on('move', function () {
    if (!_popupOpen) miniStar.setLatLng(map.getCenter());
  });

  // ポップアップ表示時：その店舗位置に★を移動
  // 自動パン（0.4s）完了後に再設定して move による上書きを防ぐ
  map.on('popupopen', function (e) {
    _popupOpen = true;
    const latlng = e.popup.getLatLng();
    if (!latlng) return;
    miniStar.setLatLng(latlng);
    setTimeout(function () {
      if (_popupOpen) miniStar.setLatLng(latlng);
    }, 500);
  });

  // ポップアップを閉じたら地図中心に戻す
  map.on('popupclose', function () {
    _popupOpen = false;
    miniStar.setLatLng(map.getCenter());
  });

  // ミニマップへのクリックが主地図に伝播しないよう防ぐ
  L.DomEvent.disableClickPropagation(miniMapEl);

  // コンテナが完全にレンダリングされてからサイズを再計算
  setTimeout(() => miniMap.invalidateSize(), 300);
})();

// ── 石川エリア境界線 ─────────────────────────────────────────────
// Googleマップのピンク点線境界を参考に更新
L.polygon([
  // OSM全町名座標データから精密算出
  [26.453, 127.803],  // 北西（西海岸・北）
  [26.452, 127.819],  // 北（石川岳）
  [26.449, 127.831],  // 北東
  [26.442, 127.841],  // 東北（石川東山）
  [26.437, 127.845],  // 東上（石川東山・東海岸）
  [26.430, 127.846],  // 東（石川赤崎）
  [26.419, 127.843],  // 東下
  [26.413, 127.840],  // 東南（石川東恩納崎）
  [26.408, 127.833],  // 南東（石川東恩納）
  [26.402, 127.822],  // 南（石川楚南の南）
  [26.400, 127.813],  // 南西
  [26.406, 127.804],  // 西南（石川山城・西海岸）
  [26.420, 127.800],  // 西（石川嘉手苅・西海岸）
  [26.436, 127.801],  // 北西（西海岸）
], {
  color:   '#e53935',
  weight:   3,
  opacity:  0.85,
  fill:     false,
  dashArray: null
}).addTo(map);

// ── マーカー生成・保持 ───────────────────────────────────────────
const markersData = restaurants.map((r, idx) => {
  const color  = genreColor(r.genre);
  const marker = L.marker([r.lat, r.lng], {
    icon:  makePinIcon(color, r.warn),
    title: r.name
  });
  marker.bindPopup(makePopup(r), { maxWidth: 300, autoPan: false });
  marker.bindTooltip(r.name, {
    permanent:  true,
    direction:  'top',
    offset:     [0, -46],
    className:  'shop-label'
  });
  marker.addTo(map);

  marker.on('click', function() {
    // スマホでマーカーをタップした瞬間の地図中心を保存（ポップアップ閉時に復元）
    if (window.innerWidth <= 767) {
      _savedCenterBeforePopup = map.getCenter();
    }

    setActiveItem(idx);

    // スマホでヘッダーが表示中の場合：まず折りたたんで地図を大きくしてからポップアップ表示
    // → ポップアップ・矢印・ピンアイコンがすべて画面内に収まるようにする
    if (window.innerWidth <= 767 && !document.body.classList.contains('header-collapsed')) {
      _isReopening = true;             // 内部close-reopen：popupcloseで復元しない
      marker.closePopup();             // 即座に閉じる
      _isReopening = false;
      document.body.classList.add('header-collapsed'); // ヘッダー折りたたみ
      setTimeout(function() {
        map.invalidateSize();                       // 地図サイズ更新
        marker.openPopup();                         // 拡大した地図でポップアップ表示
      }, 380);                                      // CSSアニメーション(0.35s)完了後
    }
  });

  return { restaurant: r, marker, idx };
});

// ── 店名ラベル 表示/非表示トグルボタン ─────────────────────────────
// スマホは初期状態で非表示、PCは表示
let labelsVisible = window.innerWidth > 767;

if (window.innerWidth <= 767) {
  // スマホ：初期状態で非表示にする（ボタンはボトムバーの #bottomLabelBtn を使用）
  map.getContainer().classList.add('labels-hidden');
} else {
  // PC：Leafletコントロールとして topleft に配置
  const LabelToggleControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const btn = L.DomUtil.create('button', 'label-toggle-btn');
      btn.innerHTML = '店名を隠す';
      btn.title = '店名ラベルの表示／非表示';
      L.DomEvent.on(btn, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        labelsVisible = !labelsVisible;
        map.getContainer().classList.toggle('labels-hidden', !labelsVisible);
        btn.innerHTML = labelsVisible ? '店名を隠す' : '店名を表示';
      });
      return btn;
    }
  });
  new LabelToggleControl().addTo(map);
}

// ── ポップアップ開閉で地図位置を保存・復元（スマホ・地図クリック時のみ） ──
let _savedCenterBeforePopup = null;
let _isReopening = false; // marker.closePopup() の内部close-reopen中フラグ

// 地図アイコン直接クリック時：ポップアップが見えるようパン
focusShop._fromSidebar = false;
map.on('popupopen', function(e) {

  if (focusShop._fromSidebar) return; // サイドバーから開いた場合はスキップ

  setTimeout(function() {
    const popup   = e.popup;
    const popupEl = popup.getElement();
    const mapEl   = map.getContainer();
    if (!popupEl || !mapEl) return;

    const pr  = popupEl.getBoundingClientRect();
    const mr  = mapEl.getBoundingClientRect();

    if (window.innerWidth <= 767) {
      // ── スマホ：ポップアップ＋矢印＋マーカーアイコンがすべて見えるよう自動パン ──
      // マーカーのピクセル位置（地図コンテナ基準）
      const latlng   = popup.getLatLng();
      const mPx      = map.latLngToContainerPoint(latlng);
      // ビューポート基準のマーカーY（iconAnchorがアイコン底辺なのでそのまま使用）
      const markerVY = mr.top + mPx.y;

      // ピン下×ボタンの下端位置
      // iconAnchor.y = -4 → ボタン上端はmarkerVYの4px下、ボタン高さ30px
      const closeBtnBottom = markerVY + 4 + 30; // = markerVY + 34

      const padTop    = 80;   // ＋－ボタン（約70px）をクリアする余白
      const padBottom = 80;   // 中央下の「店名を表示」ボタン（bottom:28px+高さ34px+余白）
      const padSide   = 10;
      let dx = 0, dy = 0;

      // 縦方向：ポップアップ上部を優先し、次にピン下×ボタンが見えるか確認
      if (pr.top < mr.top + padTop) {
        // ポップアップ上部が隠れている → 内容を下に移動
        dy = pr.top - mr.top - padTop;
      } else if (closeBtnBottom > mr.bottom - padBottom) {
        // ピン下×ボタンが画面下に隠れている → ×ボタン全体が見えるよう上に移動
        dy = closeBtnBottom - (mr.bottom - padBottom);
      }

      // 横方向
      if (pr.left < mr.left + padSide) {
        dx = pr.left - mr.left - padSide;
      } else if (pr.right > mr.right - padSide) {
        dx = pr.right - mr.right + padSide;
      }

      if (dx !== 0 || dy !== 0) {
        map.panBy([dx, dy], { animate: true, duration: 0.4 });
      }
    } else {
      // ── デスクトップ：ポップアップが見切れないよう最小限パン ──
      const pad = 10;
      let dx = 0, dy = 0;
      if (pr.top    < mr.top    + pad) dy = pr.top    - mr.top    - pad;
      if (pr.bottom > mr.bottom - pad) dy = pr.bottom - mr.bottom + pad;
      if (pr.left   < mr.left   + pad) dx = pr.left   - mr.left   - pad;
      if (pr.right  > mr.right  - pad) dx = pr.right  - mr.right  + pad;
      if (dx !== 0 || dy !== 0) {
        map.panBy([dx, dy], { animate: true, duration: 1.0, easeLinearity: 0.01 });
      }
    }
  }, 80);
});

// ── ピンの上に「閉じる×」ボタンを追加（スマホ片手操作対応） ──────────
// ポップアップペイン(z-index:700)より上に表示するカスタムペインを作成
const closeBtnPane = map.createPane('closeBtnPane');
closeBtnPane.style.zIndex = 750;   // ポップアップ(700)より前面
closeBtnPane.style.pointerEvents = 'none'; // マーカー要素が個別に制御

let pinCloseMarker = null;

map.on('popupopen', function(e) {
  // 既存の×ボタンマーカーをリセット
  if (pinCloseMarker) { map.removeLayer(pinCloseMarker); pinCloseMarker = null; }

  const latlng = e.popup.getLatLng();
  if (!latlng) return;

  pinCloseMarker = L.marker(latlng, {
    icon: L.divIcon({
      className: '',
      html: '<div class="pin-close-btn">×</div>',
      iconSize:   [30, 30],
      iconAnchor: [15, -4], // ピン先端より下に配置
    }),
    pane:         'closeBtnPane', // ポップアップより前面のペインへ
    interactive:  true,
    keyboard:     false,
  }).addTo(map);

  pinCloseMarker.on('click', function(ev) {
    L.DomEvent.stopPropagation(ev);
    map.closePopup();
  });
});

// ポップアップ開閉時：ミニマップ・中央★・左矢印をポップアップの裏に隠す
map.on('popupopen',  function() { document.body.classList.add('popup-open');    });
map.on('popupclose', function() { document.body.classList.remove('popup-open'); });

map.on('popupclose', function() {
  if (pinCloseMarker) { map.removeLayer(pinCloseMarker); pinCloseMarker = null; }
  if (_isReopening) return; // 内部close-reopen中は復元しない
  // ポップアップを閉じたら元の地図位置にスムーズに戻す
  if (_savedCenterBeforePopup) {
    map.panTo(_savedCenterBeforePopup, { animate: true, duration: 0.5 });
    _savedCenterBeforePopup = null;
  }
});

// ── ポップアップを触っても地図をパンできるようにする ────────────────
map.on('popupopen', function(e) {
  const popupEl = e.popup.getElement();
  if (!popupEl) return;

  // ── スマホ：タッチでパン ──────────────────────────────────────
  let lastX = 0, lastY = 0;

  function onTouchStart(te) {
    if (te.touches.length !== 1) return;
    lastX = te.touches[0].clientX;
    lastY = te.touches[0].clientY;
  }

  function onTouchMove(te) {
    if (te.touches.length !== 1) return;
    const dx = te.touches[0].clientX - lastX;
    const dy = te.touches[0].clientY - lastY;
    lastX = te.touches[0].clientX;
    lastY = te.touches[0].clientY;
    map.panBy([-dx, -dy], { animate: false });
  }

  popupEl.addEventListener('touchstart', onTouchStart, { passive: true });
  popupEl.addEventListener('touchmove',  onTouchMove,  { passive: true });

  // ── PC：マウスでポップアップをつかんで地図をパン ─────────────
  let isDragging = false;
  let lastMouseX = 0, lastMouseY = 0;

  function onMouseDown(me) {
    // ×ボタン・リンク・ボタンはクリック動作を維持
    if (me.target.closest('a, button, .leaflet-popup-close-button, .pin-close-btn')) return;
    if (me.button !== 0) return; // 左クリックのみ
    isDragging  = true;
    lastMouseX  = me.clientX;
    lastMouseY  = me.clientY;
    popupEl.style.cursor = 'grabbing';
    me.preventDefault();
  }

  function onMouseMove(me) {
    if (!isDragging) return;
    const dx = me.clientX - lastMouseX;
    const dy = me.clientY - lastMouseY;
    lastMouseX = me.clientX;
    lastMouseY = me.clientY;
    map.panBy([-dx, -dy], { animate: false });
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    popupEl.style.cursor = 'grab';
  }

  // ── PC：マウスホイールでポップアップ上からも地図をズーム ────────
  // Leafletが .leaflet-popup-content-wrapper に disableScrollPropagation() を
  // 適用しているため、バブルフェーズではイベントが届かない。
  // → mapコンテナにキャプチャフェーズで捕捉し、ポップアップ内からのホイールを処理する。
  var mapContainer = map.getContainer();

  function onWheelCapture(we) {
    var wrapper = document.querySelector('.leaflet-popup-content-wrapper');
    if (!wrapper || !wrapper.contains(we.target)) return; // ポップアップ外は無視
    we.preventDefault();
    we.stopPropagation();
    // マウス位置を中心にズーム（上スクロール＝拡大、下スクロール＝縮小）
    var mapRect = mapContainer.getBoundingClientRect();
    var point   = L.point(we.clientX - mapRect.left, we.clientY - mapRect.top);
    var delta   = we.deltaY < 0 ? 1 : -1;
    map.setZoomAround(point, map.getZoom() + delta, { animate: true });
  }

  mapContainer.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });

  // ポップアップエリアにグラブカーソルを表示
  popupEl.style.cursor = 'grab';

  popupEl.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);

  // ポップアップが閉じたらすべてのイベントリスナーを削除
  map.once('popupclose', function() {
    popupEl.removeEventListener('touchstart', onTouchStart);
    popupEl.removeEventListener('touchmove',  onTouchMove);
    popupEl.removeEventListener('mousedown',  onMouseDown);
    mapContainer.removeEventListener('wheel', onWheelCapture, { capture: true });
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
    popupEl.style.cursor = '';
  });
});

// ── 凡例コントロール ─────────────────────────────────────────────
const legendItems = [
  { color: "#e53935", label: "居酒屋・食堂" },
  { color: "#00897b", label: "カフェ"       },
  { color: "#fb8c00", label: "焼肉"         },
  { color: "#8e24aa", label: "バル"         },
  { color: "#1565c0", label: "その他"       },
];

const LegendControl = L.Control.extend({
  options: { position: "bottomleft" },
  onAdd() {
    const div = L.DomUtil.create("div", "map-legend");
    div.innerHTML =
      `<div class="legend-title">ジャンル</div>` +
      legendItems.map(item =>
        `<div class="legend-item">
           <span class="legend-dot" style="background:${item.color}"></span>
           ${item.label}
         </div>`
      ).join("") +
      `<hr class="legend-sep">
       <div class="legend-warn-note">
         🔶 ピン = 要確認店舗
       </div>`;
    return div;
  }
});
new LegendControl().addTo(map);

// ── フィルターボタン生成 ─────────────────────────────────────────
function buildFilterButtons() {
  const container = document.getElementById('filterButtons');
  FILTERS.forEach(f => {
    const btn = document.createElement('button');
    btn.className   = 'filter-btn' + (f.id === 'all' ? ' active' : '');
    btn.textContent = f.label;
    btn.style.setProperty('--fc', f.color);
    btn.setAttribute('data-filter', f.id);
    btn.addEventListener('click', () => applyFilter(f.id));
    container.appendChild(btn);
  });
}

// ── 表示判定（フィルター＋検索の両方を満たすか） ────────────────
function isVisible(r) {
  const filterObj = FILTERS.find(f => f.id === currentFilter);
  if (!filterObj.test(r.genre)) return false;
  if (!currentSearch) return true;
  const q = currentSearch.toLowerCase();
  return (
    r.name.toLowerCase().includes(q)    ||
    r.genre.toLowerCase().includes(q)   ||
    r.address.toLowerCase().includes(q) ||
    r.hours.toLowerCase().includes(q)   ||
    r.note.toLowerCase().includes(q)
  );
}

// ── フィルター適用 ───────────────────────────────────────────────
function applyFilter(filterId) {
  currentFilter = filterId;

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterId);
  });

  markersData.forEach(({ restaurant: r, marker }) => {
    if (isVisible(r)) {
      if (!map.hasLayer(marker)) marker.addTo(map);
    } else {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    }
  });

  renderShopList();
}

// ── 店舗一覧レンダリング ─────────────────────────────────────────
function renderShopList() {
  const visible = markersData.filter(({ restaurant: r }) => isVisible(r));

  const shopCount = document.getElementById('shopCount');
  shopCount.textContent = `${visible.length} 件表示中`;

  const shopList = document.getElementById('shopList');
  if (visible.length === 0) {
    shopList.innerHTML = '<p class="no-results">該当する店舗がありません</p>';
    return;
  }

  shopList.innerHTML = visible.map(({ restaurant: r, idx }) => {
    const warnBadge = r.warn
      ? `<span class="warn-badge">要確認</span>`
      : '';
    const genreColor_ = genreColor(r.genre);
    return `
      <div class="shop-item" role="listitem" tabindex="0"
           data-idx="${idx}"
           onclick="focusShop(${idx})"
           onkeydown="if(event.key==='Enter'||event.key===' ')focusShop(${idx})">
        <div class="shop-item-name">${r.name}${warnBadge}</div>
        <span class="shop-item-genre" style="background:${genreColor_}22;color:${genreColor_}">${r.genre}</span>
        <div class="shop-item-info">
          <span class="shop-item-hours" title="${r.hours.replace(/\n/g, ' / ')}">${fmtHours(r.hours)}</span>
          <span class="shop-item-closed">定休日：${r.closed}</span>
        </div>
      </div>`;
  }).join('');
}

// ── 店舗フォーカス（リスト→地図） ───────────────────────────────
function focusShop(idx) {
  const data = markersData[idx];
  if (!data) return;

  switchTab('map');
  setActiveItem(idx);

  const lat = data.restaurant.lat;
  const lng = data.restaurant.lng;
  const targetZoom = 16;

  // invalidateSize（switchTab内で50ms後に実行）の完了を待ってから処理
  setTimeout(() => {
    // 既存のポップアップと移動中のイベントをリセット
    map.closePopup();
    map.stop();
    map.off('moveend', focusShop._onMoveEnd);

    // ポップアップの推定高さからオフセットを事前計算（DOM測定に依存しない）
    // ポップアップ高さ ≈ 280px + tip 28px = 308px, anchor = 62px
    // 中央に表示するにはマーカーを (308/2 + 62) ≈ 216px 下にずらす
    const offsetPx = 216;

    // CRS投影で正確なオフセット座標を算出（ビューポート非依存）
    const markerPoint = map.project([lat, lng], targetZoom);
    const centerPoint = L.point(markerPoint.x, markerPoint.y - offsetPx);
    const newCenter   = map.unproject(centerPoint, targetZoom);

    // スムーズなアニメーションで移動
    map.flyTo(newCenter, targetZoom, { duration: 0.8 });

    // アニメーション完了後にポップアップを開く（重複防止）
    focusShop._onMoveEnd = function() {
      focusShop._fromSidebar = true;  // サイドバーから開いたフラグON
      _savedCenterBeforePopup = null; // サイドバー遷移では位置復元しない
      data.marker.openPopup();
      focusShop._fromSidebar = false; // フラグOFF
    };
    map.once('moveend', focusShop._onMoveEnd);
  }, 200);
}

// ── アクティブ店舗ハイライト ─────────────────────────────────────
function setActiveItem(idx) {
  document.querySelectorAll('.shop-item').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.idx) === idx);
  });

  const activeEl = document.querySelector(`.shop-item[data-idx="${idx}"]`);
  if (activeEl) {
    activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ── タブ切り替え（スマホ） ───────────────────────────────────────
function switchTab(tab) {
  const appBody = document.getElementById('appBody');
  appBody.dataset.view = tab;

  // 旧タブバー（DOM上は残存）
  document.getElementById('tabMap').classList.toggle('active',  tab === 'map');
  document.getElementById('tabMap').setAttribute('aria-selected', tab === 'map');
  document.getElementById('tabList').classList.toggle('active', tab === 'list');
  document.getElementById('tabList').setAttribute('aria-selected', tab === 'list');

  // ボトムタブバー
  const bMap  = document.getElementById('bottomTabMap');
  const bList = document.getElementById('bottomTabList');
  if (bMap)  bMap.classList.toggle('active',  tab === 'map');
  if (bList) bList.classList.toggle('active', tab === 'list');

  if (tab === 'map') {
    setTimeout(() => map.invalidateSize(), 50);
  }
}

// ── 店名ラベルトグル（ボトムバーから呼び出し） ──────────────────
function toggleLabels() {
  labelsVisible = !labelsVisible;
  map.getContainer().classList.toggle('labels-hidden', !labelsVisible);
  const btn = document.getElementById('bottomLabelBtn');
  if (btn) btn.textContent = labelsVisible ? '店名を隠す' : '店名を表示';
}

// ── 検索ボックス初期化 ──────────────────────────────────────────
function initSearch() {
  const input    = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');

  function applySearch() {
    currentSearch   = input.value.trim();
    clearBtn.hidden = (currentSearch === '');

    markersData.forEach(({ restaurant: r, marker }) => {
      if (isVisible(r)) {
        if (!map.hasLayer(marker)) marker.addTo(map);
      } else {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
    });
    renderShopList();
  }

  input.addEventListener('input', applySearch);

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.focus();
    applySearch();
  });
}

// ── 初期化 ───────────────────────────────────────────────────────
buildFilterButtons();
initSearch();

// ── スマホ：ダブルタップ＋ドラッグでズーム（グーグルマップ方式）──
// ドラッグ中はCSSスケールで滑らかに表示、指を離した時だけLeafletズームをコミット
(function() {
  const mapEl         = map.getContainer();
  const DOUBLE_TAP_MS = 300;  // ダブルタップ判定時間（ms）
  const PX_PER_ZOOM   = 100;  // 何px動かすと1ズームレベル変わるか

  let lastTapTime = 0;
  let dragging    = false;
  let startY      = 0;
  let startZoom   = 0;
  let tapPoint    = null;  // mapコンテナ相対のタップ座標
  let lastDy      = 0;
  let mapPane     = null;  // .leaflet-map-pane への参照

  mapEl.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) { dragging = false; return; }

    const now   = Date.now();
    const touch = e.touches[0];

    if (now - lastTapTime < DOUBLE_TAP_MS && !dragging) {
      // ダブルタップ検出 → CSS変形ズームモード開始
      dragging    = true;
      startY      = touch.clientY;
      lastDy      = 0;
      startZoom   = map.getZoom();

      // マップペインを取得（CSSスケールを直接適用する対象）
      mapPane = mapEl.querySelector('.leaflet-map-pane');

      // スケールの原点を「ペインのローカル座標系での地図中心」に正確に設定
      // ペインはLeafletのtranslate3d(pos.x, pos.y)で動いているため、
      // コンテナ中心 - paneOffset = ペインローカル座標での地図中心
      if (mapPane) {
        const pos = map._getMapPanePos();
        const originX = mapEl.offsetWidth  / 2 - pos.x;
        const originY = mapEl.offsetHeight / 2 - pos.y;
        mapPane.style.transformOrigin = originX + 'px ' + originY + 'px';
      }

      // Leafletのパン操作を一時停止（干渉防止）
      map.dragging.disable();
      map.doubleClickZoom.disable();

      lastTapTime = 0;
      e.preventDefault();
    } else {
      dragging    = false;
      lastTapTime = now;
    }
  }, { passive: false });

  mapEl.addEventListener('touchmove', function(e) {
    if (!dragging || e.touches.length !== 1) return;
    e.preventDefault();

    lastDy = e.touches[0].clientY - startY;  // 下=拡大、上=縮小
    const scale = Math.pow(2, lastDy / PX_PER_ZOOM);

    if (mapPane) {
      // LeafletのtranslateにCSSスケールを重ねる（GPU処理でスムーズ）
      const pos = map._getMapPanePos();
      mapPane.style.transform =
        'translate3d(' + pos.x + 'px,' + pos.y + 'px,0) scale(' + scale + ')';
    }
  }, { passive: false });

  mapEl.addEventListener('touchend', function() {
    if (!dragging) return;
    dragging = false;

    // CSSスケールをリセット（Leafletのtranslateに戻す）
    if (mapPane) {
      const pos = map._getMapPanePos();
      mapPane.style.transform = 'translate3d(' + pos.x + 'px,' + pos.y + 'px,0)';
      mapPane.style.transformOrigin = '';
      mapPane = null;
    }

    // Leafletの操作を再有効化
    map.dragging.enable();
    map.doubleClickZoom.enable();

    // 指を離した時だけ地図中心を固定したままズームをコミット
    // ドラッグなし（lastDy=0）の場合はダブルタップ単体 → 0.5ズームイン
    if (lastDy === 0) {
      map.zoomIn(0.5);
    } else {
      const newZoom = Math.max(
        map.getMinZoom(),
        Math.min(map.getMaxZoom(), startZoom + lastDy / PX_PER_ZOOM)
      );
      map.setZoom(newZoom, { animate: true });
    }
  });
})();
renderShopList();
