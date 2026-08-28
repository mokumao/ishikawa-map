/* ================================================================
   うるま市石川 飲食店マップ — script.js
   地図: OpenStreetMap + Leaflet
================================================================ */

// ── 多言語対応 (i18n) ─────────────────────────────────────────────
var _currentLang = 'ja';

var TRANSLATIONS = {
  ja: {
    'header.title':        '石川マップ',
    'header.sub1':         '石川マップの情報は不正確な場合もあります',
    'header.refbtn':       '詳細',
    'header.sub2':         'あなたの知らない石川が見つかるかも',
    'wip.text':            'このサイトは現在作成中です。掲載情報が間違っている場合があります。正式公開前の確認用ページです。',
    'tab.map':             '地図',
    'tab.list':            '一覧',
    'search.placeholder':  '店名・ジャンル・住所・営業時間で検索…',
    'filter.label':        'ジャンルで絞り込み',
    'btn.showNames':       '店名',
    'bottom.map':          '地図',
    'bottom.list':         '一覧',
    'gear.back':           '戻る',
    'lang.ja':             '日本語',
    'lang.en':             '英語',
    'lang.zh':             '中国語',
    'lang.back':           '戻る',
    'info.about-site':     'このサイトについて',
    'info.about-site.desc': '石川マップの目的や使い方をご紹介します',
    'info.about-ishikawa': '石川について',
    'info.about-ishikawa.desc': '石川エリアの魅力や基本情報をお届けします',
    'info.faq':            'Q & A',
    'info.faq.desc':       'よくある質問とその回答をまとめました',
    'info.feedback':       'ご意見・ご要望',
    'info.feedback.desc':  '皆さまの声をお聞かせください',
    'info.today':          '今日の石川ニュース',
    'info.today.desc':     '石川の最新情報をお届けします',
    'popup.address':       '住所',
    'popup.hours':         '営業時間',
    'popup.closed':        '定休日',
    'popup.note':          '備考',
    'popup.noteEmpty':     'Googleマップや詳細を参照',
    'popup.gmap':          'Googleマップで見る',
    'popup.detail':        '詳細を見る',
    'count.results':       '{n} 件表示中',
    'list.closed':         '定休日：',
    'filter.all':          'すべて',
    // filter.<カテゴリキー> はCATEGORIES（下部で定義）から自動注入される
    'footer.main':         '🌊 うるま市石川 飲食店マップ  |  掲載情報は調査時点のものです',
    'visitor.today':       '本日のアクセス数 {n} 回',
    'visitor.total':       '累計アクセス数 {n} 回',
  },
};

// 翻訳キーから文字列を返す
function t(key, vars) {
  var dict = TRANSLATIONS[_currentLang] || TRANSLATIONS['ja'];
  var str  = dict[key] || TRANSLATIONS['ja'][key] || key;
  if (vars) {
    Object.keys(vars).forEach(function(k) {
      str = str.replace('{' + k + '}', vars[k]);
    });
  }
  return str;
}

// data-i18n属性を持つ静的要素を一括更新
function applyLangToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
}

// ── カテゴリ中央設定リスト ──────────────────────────────────────
// 大分類＝マーカー色・チップ・歯車ボタン・凡例を持つ層
// 小分類（sub）＝一覧の絞り込みのみに使う。マーカー色は大分類を継承
// 新しいカテゴリ・業種を追加するときは、この配列に1エントリ足すだけでよい
// （地図のピン色・チップバー・歯車パネル・一覧の絞り込み・凡例・多言語表記に自動反映される）
// ※このファイル内の複数のIIFEが即時実行時に参照するため、必ずファイルの
//   早い位置（他のコードより前）で定義すること
const CATEGORIES = [
  {
    key: 'shokuji',
    label: { ja: '食事処', en: 'Restaurant' },
    color: '#f57c00',
    tint: '#ffcdd2',   // 選択時の薄色背景（歯車ボタン・チップ共通。従来のデフォルト色を維持）
    isDefault: true,   // 他のどの大分類にも一致しないジャンルはここに落ちる
    sub: [
      { key: 'cafe',     label: { ja: 'カフェ',   en: 'Café'  }, match: g => g.includes('カフェ') },
      { key: 'yakiniku', label: { ja: '焼肉',     en: 'BBQ'   }, match: g => g.includes('焼肉') },
      { key: 'bar',      label: { ja: 'バル',     en: 'Bar'   }, match: g => g.includes('バル') },
      { key: 'ramen',    label: { ja: 'ラーメン', en: 'Ramen' }, match: g => g.includes('ラーメン') },
    ],
  },
  { key: 'izakaya',   label: { ja: '居酒屋等',   en: 'Izakaya' },           color: '#e53935', match: g => g === '居酒屋等', tint: '#ffcdd2' },
  { key: 'conbini',   label: { ja: 'コンビニ',   en: 'Convenience Store' }, color: '#fb8c00', match: g => g === 'コンビニ', sidebarHidden: true, tint: '#ffe0b2' },
  { key: 'gas',       label: { ja: 'ガソリン',   en: 'Gas Station' },       color: '#1565c0', match: g => g === 'ガソリン', sidebarHidden: true, tint: '#bbdefb' },
  { key: 'stay',      label: { ja: '宿泊',       en: 'Accommodation' },     color: '#7b1fa2', match: g => g === '宿泊', tint: '#e1bee7' },
  { key: 'finance',   label: { ja: '金融',       en: 'Finance' },           color: '#2e7d32', match: g => g === '金融', tint: '#c8e6c9' },
  { key: 'education', label: { ja: '教育',       en: 'Education' },         color: '#00695c', match: g => g === '教育', tint: '#b2dfdb' },
  { key: 'tourism',   label: { ja: '観光',       en: 'Tourism' },           color: '#0097a7', match: g => g === '観光', tint: '#b2ebf2' },
  { key: 'beauty',    label: { ja: '美容・理容', en: 'Beauty & Barber' },   color: '#d81b60', match: g => g === '美容・理容', chipLabel: '美容', tint: '#f8bbd0' },
  // 将来、鍵屋・水道屋・自転車屋のような細かい業種を追加する場合は、
  // 既存または新設の大分類の sub にエントリを足す（飲食店のcafe/yakiniku等と同じパターン）。
  // 例：
  // {
  //   key: 'lifeservice', label: { ja: '生活サービス', en: 'Local Services' }, color: '#5d4037',
  //   match: g => ['鍵屋','水道屋','自転車屋'].includes(g),
  //   sub: [
  //     { key: 'locksmith', label: { ja: '鍵屋',     en: 'Locksmith' }, match: g => g === '鍵屋' },
  //     { key: 'plumber',   label: { ja: '水道屋',   en: 'Plumber' },   match: g => g === '水道屋' },
  //     { key: 'bike',      label: { ja: '自転車屋', en: 'Bike Shop' }, match: g => g === '自転車屋' },
  //   ],
  // },
];

// ジャンル文字列 → 大分類オブジェクトを解決する（isDefault大分類にキャッチオールで落ちる）
function macroOf(genre) {
  const hit = CATEGORIES.find(c => !c.isDefault && c.match(genre));
  return hit || CATEGORIES.find(c => c.isDefault);
}

// 大分類の色(#rrggbb)から、選択中UI用の薄い背景色を自動生成する
// （tintフィールドを個別指定しなければ、この関数が自動計算する）
function autoTint(hex, ratio = 0.82) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = c => Math.round(c + (255 - c) * ratio);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// CATEGORIESのラベルを翻訳テーブル(filter.<key>)に自動注入する（日本語のみ）。
// 既存のキーがあれば上書きしない（個別に手を加えたい場合はそちらを優先する）。
// これにより新カテゴリ追加時、TRANSLATIONSの手動編集が不要になる
(function injectCategoryTranslations() {
  function inject(key, label) {
    if (!(('filter.' + key) in TRANSLATIONS.ja)) TRANSLATIONS.ja['filter.' + key] = label.ja;
  }
  CATEGORIES.forEach(function(c) {
    inject(c.key, c.label);
    (c.sub || []).forEach(function(s) { inject(s.key, s.label); });
  });
})();

// フィールド取得ヘルパー（日本語専用。多言語表示は2026-08-16に廃止）
function rGenre(r)  { return r.genre;  }
function rHours(r)  { return r.hours;  }
function rClosed(r) { return r.closed; }
function rNote(r)   { return r.note;   }

// ── 本日のアクセス数（訪問回数）を表示（JST 0:00〜現在） ────────
// メインの集計源はGoogleアナリティクス(GA4)。gh-dataブランチの
// ga4-today.json（1時間ごとに自動更新）から「今日のセッション数（＝訪問回数。
// 同じ人が複数回訪れれば複数回とカウントする）」をそのまま表示する。
// GA4側に問題があった場合は、従来のGoatCounter集計
// （visitor-log.jsonの差分計算→ダメなら累計API）に自動フォールバックする。
(function () {
  var el = document.getElementById('visitorCount');
  if (!el) return;

  var GA4_URL = 'https://raw.githubusercontent.com/mokumao/ishikawa-map/gh-data/ga4-today.json';
  var LOG_URL = 'https://raw.githubusercontent.com/mokumao/ishikawa-map/gh-data/visitor-log.json';

  // JST今日0時のUTCタイムスタンプ（ミリ秒）を返す
  function todayMidnightJST() {
    var now = new Date();
    var jstMs = now.getTime() + 9 * 60 * 60 * 1000;
    var jst = new Date(jstMs);
    return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate())
           - 9 * 60 * 60 * 1000;
  }

  // JST今日の日付文字列（YYYY-MM-DD）を返す（ga4-today.jsonのdateと比較用）
  function todayStrJST() {
    var jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
  }

  function fallbackToGoatCounter() {
    fetch(LOG_URL + '?_=' + Date.now())  // キャッシュ回避
      .then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || data.length === 0) throw new Error('empty');

        var midnight = todayMidnightJST();

        // 最新エントリの累計
        var latestCount = data[data.length - 1].count;

        // 今日0時以前の最後のエントリを探す（その時点の累計が「今日の起点」）
        var baseCount = null;
        for (var i = data.length - 1; i >= 0; i--) {
          if (new Date(data[i].ts).getTime() <= midnight) {
            baseCount = data[i].count;
            break;
          }
        }
        // 0時前のデータがなければ最も古いエントリを起点とする
        if (baseCount === null) baseCount = data[0].count;

        var todayCount = Math.max(0, latestCount - baseCount);
        el.textContent = t('visitor.today', { n: todayCount });
      })
      .catch(function () {
        // visitor-log.jsonが未整備の間は累計APIにフォールバック
        fetch('https://ishikawamap.goatcounter.com/counter//ishikawa-map/.json')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            // GoatCounter APIが件数を「1 056」のように桁区切り文字付きで
            // 返すことがあるため、数字だけ抜き出してから表示する
            // アクセス数（総訪問回数）を表示するため count を優先する
            var raw = String(d.count || d.count_unique || '');
            var digits = raw.replace(/[^\d]/g, '');
            el.textContent = t('visitor.total', { n: digits || '?' });
          })
          .catch(function () { el.textContent = ''; });
      });
  }

  fetch(GA4_URL + '?_=' + Date.now())  // キャッシュ回避
    .then(function (r) {
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    })
    .then(function (data) {
      // dateが今日のJST日付と一致しない場合（更新が止まっている等）は
      // 古いデータを表示しないようフォールバックする。
      // countが0の場合も、GA4の標準レポートには反映まで数時間のタイム
      // ラグがあり「実際は訪問があるのに0と表示される」ことがあるため、
      // 信頼せずGoatCounter側にフォールバックする（本当に0人の場合も
      // GoatCounter側がほぼ同じ0を返すだけなので実害はない）。
      if (!data || data.date !== todayStrJST() || typeof data.count !== 'number' || data.count === 0) {
        throw new Error('stale, invalid, or zero ga4 data');
      }
      el.textContent = t('visitor.today', { n: data.count });
    })
    .catch(function () {
      fallbackToGoatCounter();
    });
})();

// ── 石川全域ボタン（カテゴリIIFE内で定義）─────────────────────────
// ※ openedViaPin / savedPanPixels へのアクセスが必要なためカテゴリIIFE内に移動

// ── 現在地ボタン（リアルタイム追跡） ────────────────────────────
(function () {
  const btn = document.getElementById('locateBtn');
  if (!btn) return;

  let locationMarker = null;
  let watchId        = null;  // watchPosition の ID
  let isFirstFix     = true;  // 初回取得フラグ

  // ── マーカー生成（ソナードット + 「現在地」ラベル） ──────────
  function createMarker(lat, lng) {
    if (locationMarker) { locationMarker.remove(); locationMarker = null; }

    locationMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="location-marker-wrap">' +
                '<div class="location-sonar-dot"></div>' +
                '<div class="location-label-tag">現在地</div>' +
              '</div>',
        iconSize:   [90, 46],
        iconAnchor: [45, 7]
      }),
      zIndexOffset: 1000,
      interactive:  false   // クリックを透過→下の店舗マーカーが反応できる
    }).addTo(map);
    locationMarker._isLocationMarker = true;

    // 5秒後にラベルを0.5秒フェードアウト
    ;(function(m) {
      setTimeout(function() {
        if (!m || !m.getElement()) return;
        var tag = m.getElement().querySelector('.location-label-tag');
        if (!tag) return;
        tag.style.transition = 'opacity 0.5s ease';
        tag.style.opacity    = '0';
        setTimeout(function() { if (tag) tag.style.display = 'none'; }, 500);
      }, 5000);
    })(locationMarker);
  }

  // ボタンの元のSVGを保存しておく
  var _locateBtnOrigHTML = btn.innerHTML;

  btn.addEventListener('click', function () {
    if (!navigator.geolocation) {
      alert('このブラウザは位置情報に対応していません。');
      return;
    }

    // ポップアップを閉じる
    map.closePopup();

    // 前のウォッチを停止してリセット
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (locationMarker) { locationMarker.remove(); locationMarker = null; }

    isFirstFix = true;
    btn.classList.add('locating');
    // SVGアイコンはそのまま保持（locatingクラスのアニメーションで状態を示す）

    // watchPosition でリアルタイム追跡開始
    watchId = navigator.geolocation.watchPosition(
      function (pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (isFirstFix) {
          // ── 初回：地図を現在地に移動してマーカー新規作成 ──
          isFirstFix = false;
          btn.classList.remove('locating');
          btn.innerHTML = _locateBtnOrigHTML; // SVGアイコンを復元
          createMarker(lat, lng);

          // ── 2ステップアニメーション ──
          // Step1: ゆっくり広域に引いて「現在地がどこか」を見せる
          map.flyTo([lat, lng], 13, { duration: 1.0, easeLinearity: 0.25 });
          // Step2: moveend後に少し停止してからゆっくりズームイン
          map.once('moveend', function () {
            setTimeout(function () {
              map.flyTo([lat, lng], 16, { duration: 2.2, easeLinearity: 0.25 });
            }, 500); // 広域で約0.5秒停止
          });
        } else {
          // ── 以降：マーカーを新しい位置に移動するだけ（地図は動かさない） ──
          if (locationMarker) {
            locationMarker.setLatLng([lat, lng]);
          } else {
            createMarker(lat, lng);
          }
        }
      },
      function (err) {
        // 初回取得失敗時のみUIリセット＆エラー表示
        if (isFirstFix) {
          isFirstFix = false;
          btn.classList.remove('locating');
          btn.innerHTML = _locateBtnOrigHTML; // SVGアイコンを復元
          if (err.code === 1) {
            alert('位置情報の使用が拒否されました。\nスマホの設定でブラウザの位置情報を許可してください。');
            if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
          }
        }
        // 追跡中の一時エラーは無視（次の取得を待つ）
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
  });

  // ページを離れるときにGPS追跡を自動停止（バッテリー節約）
  window.addEventListener('pagehide', function () {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  });
})();

// ── 歯車メニュー ─────────────────────────────────────────────────
(function () {
  var menu         = document.getElementById('gearMenu');
  var panelMain    = document.getElementById('gearMenuMain');
  var panelCategory= document.getElementById('gearMenuCategory');
  var overlay      = document.getElementById('gearOverlay');

  // 地図操作を完全に停止する
  function disableMap() {
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    if (map.tap) map.tap.disable();
  }
  // 地図操作を再開する
  function enableMap() {
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    if (map.tap) map.tap.enable();
  }

  function showMain() {
    menu.classList.remove('cat-mode');
    menu.style.display = 'block';
    panelMain.style.display     = 'flex';
    panelCategory.style.display = 'none';
    overlay.classList.add('active');    // 背景をグレーオーバーレイで封鎖
    // display:none→blockの直後だと稀にフェードが発火しない端末があるため二重rAFで確実に次の描画後に切り替える
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        menu.classList.add('gear-visible');
        overlay.classList.add('gear-visible');
      });
    });
    disableMap();                       // 地図操作を停止
  }
  function showCategory() {
    menu.classList.add('cat-mode');  // 画面下2/3シートに展開
    panelMain.style.display     = 'none';
    panelCategory.style.display = 'flex';
    document.getElementById('minimap').style.display = 'none'; // ミニマップ非表示
  }
  function closeMenu() {
    menu.classList.remove('cat-mode', 'gear-visible');
    overlay.classList.remove('gear-visible');
    // フェードアウト(.15s)が終わってからdisplay:noneにする（即座に消すと透明化が見えない）
    setTimeout(function () {
      menu.style.display = 'none';
      overlay.classList.remove('active', 'map-interactive'); // オーバーレイ解除
    }, 150);
    panelMain.style.display     = 'flex';
    panelCategory.style.display = 'none';
    document.getElementById('minimap').style.display = ''; // ミニマップ再表示
    setTimeout(function () { if (window._resetMinimap) window._resetMinimap(); }, 50); // サイズ再計算
    // ブロッキングdiv・サイドボタンを復元
    var blocker = document.getElementById('catModeBlocker');
    if (blocker) blocker.parentNode.removeChild(blocker);
    document.getElementById('sideSwipeCtrl').style.zIndex = ''; // z-indexを元に戻す
    ['sideSwipeDown','locateBtn','categoryPinBtn','gearBtn'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
    });
    // 「地図」「一覧」ボタンを再度押せるように戻す（カテゴリパネル表示中のみ無効化していた）
    var bTabList = document.getElementById('bottomTabList');
    if (bTabList) bTabList.style.pointerEvents = '';
    var bTabMap = document.getElementById('bottomTabMap');
    if (bTabMap) { bTabMap.style.pointerEvents = ''; bTabMap.classList.remove('cat-locked'); }
    // ピンボタン経由で開いた場合、panByの逆操作で元の位置に戻す
    // ※ enableMap()より前に実行（dragging.enable等のリセットで打ち消されないよう）
    if (openedViaPin && savedPanPixels > 0) {
      var _px = savedPanPixels;
      savedPanPixels = 0;
      map.panBy([0, -_px], { animate: true, duration: 0.7 });
    }
    // ピンモードに入る前にチップバーが表示されていた場合は、閉じたときに
    // 元の表示状態へ戻す（通常のトランジションで滑らかに戻ってよい）
    if (openedViaPin && chipBarWasVisibleBeforePin) {
      document.body.classList.remove('cat-controls-hidden');
    }
    openedViaPin = false;
    enableMap();                        // 地図操作を再開（map.tap.enable含む）
  }

  // ── カテゴリ選択モード（ピンボタン経由）────────────────────────
  // openedViaPin=true のとき：トグル選択・地図上に表示のみ・タップ不可
  // openedViaPin=false のとき：従来の動作（フィルター変更→一覧へ）
  let openedViaPin  = false;
  let savedPanPixels = 0;   // ピンパネル表示時にずらしたピクセル量（復元用）
  let chipBarWasVisibleBeforePin = false; // ピンモードに入る前、下部チップバーが表示中だったか（閉時の復元用）
  const catSel      = new Set(); // 'shokuji' | 'izakaya' | 'conbini' | 'gas'（現在表示中）
  const catChipSet  = new Set(); // チップバーに表示するカテゴリ（パネル閉時に記憶）
  const btnAll      = document.getElementById('gearCatAll');
  const btnClear    = document.getElementById('gearCatClear');
  // 地図下部チップバー上の「すべて選択/すべて解除」ボタン
  const btnSelectAllChips = document.getElementById('catSelectAllBtn');
  const btnClearAllChips  = document.getElementById('catClearAllBtn');
  // ※ map は後で定義されるため、markerPane はイベントハンドラ内で取得する


  // 「すべて選択/すべて解除」ボタンのグレーアウトを catSel/catChipSet の状態に合わせて更新
  // 「すべて選択」：表示中の全カテゴリが既に選択済みならグレーアウト
  // 「すべて解除」：1つも選択されていなければグレーアウト
  function updateSelectAllChipsBtns() {
    if (!btnSelectAllChips || !btnClearAllChips) return;
    var allSelected = catChipSet.size > 0 &&
      Array.from(catChipSet).every(function(k) { return catSel.has(k); });
    btnSelectAllChips.classList.toggle('cat-selectall-disabled', allSelected);
    btnClearAllChips.classList.toggle('cat-selectall-disabled', catSel.size === 0);
  }

  // 「すべて」ボタンのグレーアウトを catSel の状態に合わせて更新
  function updateAllBtn() {
    var allSelected = CATEGORIES.every(function(c) { return catSel.has(c.key); });
    if (allSelected) {
      btnAll.classList.add('cat-all-active');
    } else {
      btnAll.classList.remove('cat-all-active');
    }
  }

  // 「解除」ボタンのグレーアウトを catSel の状態に合わせて更新
  function updateClearBtn() {
    if (catSel.size === 0) {
      btnClear.classList.add('cat-clear-inactive');
    } else {
      btnClear.classList.remove('cat-clear-inactive');
    }
  }

  // カテゴリキー(shokuji等)から対応する歯車パネルのボタン要素を取得
  // （既存のDOM id命名規則 "gearCat" + キー先頭大文字化 に合わせている）
  function gearBtnEl(key) {
    return document.getElementById('gearCat' + key.charAt(0).toUpperCase() + key.slice(1));
  }

  // 選択中カテゴリに合わせてマーカーを表示（タップ不可モード）
  function updateCatPreview() {
    markersData.forEach(function({ restaurant: r, marker }) {
      var show = catSel.has(macroOf(r.genre).key);
      if (show && isStatusVisible(r)) { if (!map.hasLayer(marker)) marker.addTo(map); }
      else       { if (map.hasLayer(marker))  map.removeLayer(marker); }
    });
    updateAllBtn();
    updateClearBtn();
    updateSelectAllChipsBtns();
    updateCatLabel();
    syncLabelBtnWithMarkers();
  }

  // カテゴリラベルバーを更新（catChipSet のチップを表示、catSel で色決定）
  // showAll=true のとき catSel の内容を catChipSet にコピーしてからバーを描画
  function updateCatLabel(showAll) {
    var bar = document.getElementById('catLabelBar');
    if (!bar) return;
    var prevScroll = bar.scrollLeft; // チップタップによる再描画後もスクロール位置を維持
    if (showAll) {
      catChipSet.clear();
      CATEGORIES.forEach(function(c) {
        if (catSel.has(c.key)) catChipSet.add(c.key);
      });
    }
    var wrapper = document.getElementById('catLabelWrapper');
    var selectAllRow = document.getElementById('catSelectAllRow');
    if (catChipSet.size === 0) {
      if (wrapper) wrapper.style.display = 'none';
      if (selectAllRow) selectAllRow.style.display = 'none';
      return;
    }
    // チップ定義（catChipSet の順で表示）
    var defs = CATEGORIES.map(function(c) {
      return { key: c.key, label: c.chipLabel || c.label.ja, tint: c.tint || autoTint(c.color) };
    }).filter(function(d) { return catChipSet.has(d.key); });

    bar.innerHTML = defs.map(function(d) {
      var active = catSel.has(d.key) ? ' chip-active' : '';
      return '<span class="cat-label-chip' + active + '" data-cat="' + d.key + '" style="--fc-tint:' + d.tint + '">'
           + d.label + '</span>';
    }).join('');

    // ラッパーを表示（一括選択/解除ボタンの行も連動して表示）
    if (wrapper) wrapper.style.display = 'flex';
    if (selectAllRow) selectAllRow.style.display = 'flex';
    updateSelectAllChipsBtns();

    // チップクリック：ピン表示トグル
    bar.querySelectorAll('.cat-label-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var key = chip.getAttribute('data-cat');
        if (catSel.has(key)) {
          catSel.delete(key);
          chip.classList.remove('chip-active');
        } else {
          catSel.add(key);
          chip.classList.add('chip-active');
        }
        updateCatPreview();
      });
    });

    // 矢印ボタンをセットアップ
    setupChipScrollBtns();
    // showAll（パネルを閉じて新規表示）のときだけ先頭から表示。
    // チップタップによる再描画では元のスクロール位置を復元し、バーが左右に動かないようにする
    bar.scrollLeft = showAll ? 0 : prevScroll;
  }

  function hideCatLabel() {
    var wrapper = document.getElementById('catLabelWrapper');
    if (wrapper) wrapper.style.display = 'none';
    var selectAllRow = document.getElementById('catSelectAllRow');
    if (selectAllRow) selectAllRow.style.display = 'none';
    catChipSet.clear();
  }

  // 矢印ボタンの表示/非表示を更新
  function updateChipArrows() {
    var bar   = document.getElementById('catLabelBar');
    var left  = document.getElementById('catScrollLeft');
    var right = document.getElementById('catScrollRight');
    if (!bar || !left || !right) return;
    var atLeft  = bar.scrollLeft <= 1;
    var atRight = bar.scrollLeft >= bar.scrollWidth - bar.clientWidth - 1;
    left.classList.toggle('arrow-hidden', atLeft);
    right.classList.toggle('arrow-hidden', atRight);
  }

  // 矢印クリック＋タッチスクロールのセットアップ（updateCatLabel後に呼ぶ）
  function setupChipScrollBtns() {
    var bar   = document.getElementById('catLabelBar');
    var left  = document.getElementById('catScrollLeft');
    var right = document.getElementById('catScrollRight');
    if (!bar || !left || !right) return;

    // updateCatLabelの再描画ごとに同じタッチリスナーを重ねない
    if (bar._chipScrollSetup) {
      setTimeout(updateChipArrows, 50);
      return;
    }
    bar._chipScrollSetup = true;

    // 矢印ボタン：クリックでスクロール。ネイティブのbehavior:'smooth'は
    // 速度をこちらで調整できない（ブラウザ任せで比較的速い）ため、
    // requestAnimationFrameで自前アニメーションし、速度を指定できるようにする。
    var scrollAmt = 90;
    var cancelChipScroll = null;
    var cancelChipInertia = null;
    function animateChipScroll(deltaX, duration) {
      if (cancelChipScroll) { cancelChipScroll(); cancelChipScroll = null; }
      if (cancelChipInertia) { cancelChipInertia(); cancelChipInertia = null; }
      // OS側の「視差効果を減らす」設定に関わらず、常にアニメーションさせる方針
      // （2026-08-23、ユーザーの明示的な判断により決定。一般的なアクセシビリティ
      // 推奨とは異なる選択だが、石川マップではこの見た目の一貫性を優先する）
      var startX    = bar.scrollLeft;
      var maxX      = bar.scrollWidth - bar.clientWidth;
      var targetX   = Math.max(0, Math.min(maxX, startX + deltaX));
      var startTime = null;
      var cancelled = false;
      cancelChipScroll = function () { cancelled = true; };
      function step(ts) {
        if (cancelled) return;
        if (!startTime) startTime = ts;
        var t = Math.min(1, (ts - startTime) / duration);
        var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic：滑り出しは速く、最後にゆっくり止まる
        bar.scrollLeft = startX + (targetX - startX) * eased;
        updateChipArrows();
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          cancelChipScroll = null;
        }
      }
      requestAnimationFrame(step);
    }
    left.onclick  = function() { animateChipScroll(-scrollAmt * 3, 700); };
    right.onclick = function() { animateChipScroll( scrollAmt * 3, 700); };

    // スクロールイベントで矢印更新
    bar.addEventListener('scroll', updateChipArrows, { passive: true });

    // タッチ／マウスドラッグでの横スクロール（差分方式・即時反応）。左右端では実際の
    // scrollLeftを端に保ち、見た目だけ抵抗付きで動かしてラバーバンド感を出す。
    var _lastX = 0, _dragging = false, _overscrollRaw = 0;
    var _overscrollReturnTimer = null;
    var _overscrollCleanup = null;
    var _mouseActive = false;
    var _suppressChipClick = false;
    var _lastTouchTime = 0;
    var _lastMoveTime = 0;
    var _velocityX = 0;
    var _dragDistance = 0;
    var CHIP_OVERSCROLL_RETURN_MS = 600;
    function setChipOverscroll(rawOffset) {
      _overscrollRaw = rawOffset;
      var maxOffset = Math.min(window.innerWidth / 3, 140);
      var resisted = Math.sign(rawOffset) * maxOffset *
        (1 - Math.exp(-Math.abs(rawOffset) / (maxOffset * 0.58)));
      bar.style.setProperty('--cat-overscroll-x', resisted + 'px');
    }
    function resetChipOverscroll() {
      if (!_overscrollRaw) return;
      _overscrollRaw = 0;
      bar.classList.add('cat-overscroll-returning');
      bar.style.setProperty('--cat-overscroll-x', '0px');
      var cleanup = function(e) {
        if (e && !e.target.classList.contains('cat-label-chip')) return;
        clearTimeout(_overscrollReturnTimer);
        _overscrollReturnTimer = null;
        _overscrollCleanup = null;
        bar.classList.remove('cat-overscroll-returning');
        bar.style.removeProperty('--cat-overscroll-x');
        bar.removeEventListener('transitionend', cleanup);
      };
      _overscrollCleanup = cleanup;
      bar.addEventListener('transitionend', cleanup);
      _overscrollReturnTimer = setTimeout(cleanup, CHIP_OVERSCROLL_RETURN_MS + 80);
    }
    function startChipDrag(clientX) {
      // 矢印ボタンによるアニメーション中にアイコンへ触れた場合は即座に止める
      if (cancelChipScroll) { cancelChipScroll(); cancelChipScroll = null; }
      if (cancelChipInertia) { cancelChipInertia(); cancelChipInertia = null; }
      clearTimeout(_overscrollReturnTimer);
      _overscrollReturnTimer = null;
      if (_overscrollCleanup) {
        bar.removeEventListener('transitionend', _overscrollCleanup);
        _overscrollCleanup = null;
      }
      bar.classList.remove('cat-overscroll-returning');
      bar.style.removeProperty('--cat-overscroll-x');
      _overscrollRaw = 0;
      _lastX = clientX;
      _lastMoveTime = performance.now();
      _velocityX = 0;
      _dragDistance = 0;
      _dragging = false;
    }
    function moveChipDrag(currentX) {
      var now = performance.now();
      var movement = currentX - _lastX;
      var elapsed = Math.max(1, now - _lastMoveTime);
      if (!_dragging && Math.abs(movement) > 1) _dragging = true;
      if (!_dragging) return;

      // 直近の指／マウス速度を少し平滑化し、離した後の慣性へ引き継ぐ
      var instantVelocity = movement / elapsed;
      _velocityX = _velocityX * 0.35 + instantVelocity * 0.65;
      _dragDistance += Math.abs(movement);

      var maxScroll = Math.max(0, bar.scrollWidth - bar.clientWidth);
      var proposedScroll;
      if (_overscrollRaw) {
        var previousSign = Math.sign(_overscrollRaw);
        var nextRaw = _overscrollRaw + movement;
        if (!nextRaw || Math.sign(nextRaw) === previousSign) {
          setChipOverscroll(nextRaw);
        } else {
          // 引っ張った向きを反転して端を越えた分は、通常スクロールへ戻す
          _overscrollRaw = 0;
          bar.style.removeProperty('--cat-overscroll-x');
          proposedScroll = bar.scrollLeft - nextRaw;
          bar.scrollLeft = Math.max(0, Math.min(maxScroll, proposedScroll));
        }
      } else {
        proposedScroll = bar.scrollLeft - movement;
        if (proposedScroll < 0) {
          bar.scrollLeft = 0;
          setChipOverscroll(-proposedScroll);
        } else if (proposedScroll > maxScroll) {
          bar.scrollLeft = maxScroll;
          setChipOverscroll(maxScroll - proposedScroll);
        } else {
          bar.scrollLeft = proposedScroll;
        }
      }
      _lastX = currentX;
      _lastMoveTime = now;
      updateChipArrows();
    }
    function startChipInertia() {
      var velocity = Math.max(-1.4, Math.min(1.4, _velocityX));
      if (Math.abs(velocity) < 0.06) return;
      // 短いスワイプだけで端まで飛ばないよう、慣性距離は実際に払った距離に連動させる
      var maxInertiaDistance = Math.min(140, _dragDistance * 2.2);
      var inertiaDistance = 0;
      var previousTime = null;
      var cancelled = false;
      cancelChipInertia = function() { cancelled = true; };
      function step(now) {
        if (cancelled) return;
        if (previousTime === null) previousTime = now;
        var elapsed = Math.min(32, now - previousTime);
        previousTime = now;
        var maxScroll = Math.max(0, bar.scrollWidth - bar.clientWidth);
        var frameDistance = -velocity * elapsed;
        var remainingDistance = maxInertiaDistance - inertiaDistance;
        if (Math.abs(frameDistance) > remainingDistance) {
          frameDistance = Math.sign(frameDistance) * remainingDistance;
        }
        inertiaDistance += Math.abs(frameDistance);
        var nextScroll = bar.scrollLeft + frameDistance;
        if (nextScroll <= 0 || nextScroll >= maxScroll) {
          bar.scrollLeft = Math.max(0, Math.min(maxScroll, nextScroll));
          cancelChipInertia = null;
          updateChipArrows();
          return;
        }
        bar.scrollLeft = nextScroll;
        velocity *= Math.pow(0.88, elapsed / 16.67);
        updateChipArrows();
        if (Math.abs(velocity) >= 0.025 && inertiaDistance < maxInertiaDistance) {
          requestAnimationFrame(step);
        } else {
          cancelChipInertia = null;
        }
      }
      requestAnimationFrame(step);
    }
    function finishChipDrag(useInertia) {
      var wasDragging = _dragging;
      _dragging = false;
      if (_overscrollRaw) {
        resetChipOverscroll();
      } else if (wasDragging && useInertia) {
        startChipInertia();
      }
      updateChipArrows();
      return wasDragging;
    }

    bar.addEventListener('touchstart', function(e) {
      _lastTouchTime = Date.now();
      startChipDrag(e.touches[0].clientX);
      e.stopPropagation();
    }, { passive: false });

    bar.addEventListener('touchmove', function(e) {
      moveChipDrag(e.touches[0].clientX);
      if (_dragging) {
        // ネイティブの横スクロール・バウンス処理を無効化し、JSの差分方式に
        // 一本化する（両方が同時に効くと、指を離したときの戻り方が
        // タイミングによって不安定になるため）
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });

    bar.addEventListener('touchend', function(e) {
      if (finishChipDrag(true)) e.stopPropagation();
    }, { passive: false });

    bar.addEventListener('touchcancel', function() {
      finishChipDrag(false);
    }, { passive: true });

    // パソコンでもカテゴリー欄を掴んで左右へ動かせるようにする。
    // barでmousedownを止めることで、背面のLeaflet地図へドラッグを伝えない。
    bar.addEventListener('mousedown', function(e) {
      if (e.button !== 0 || Date.now() - _lastTouchTime < 700) return;
      _mouseActive = true;
      _suppressChipClick = false;
      bar.classList.add('cat-mouse-dragging');
      startChipDrag(e.clientX);
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener('mousemove', function(e) {
      if (!_mouseActive) return;
      moveChipDrag(e.clientX);
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false });
    document.addEventListener('mouseup', function(e) {
      if (!_mouseActive) return;
      _mouseActive = false;
      bar.classList.remove('cat-mouse-dragging');
      _suppressChipClick = finishChipDrag(true);
      if (_suppressChipClick) {
        setTimeout(function() { _suppressChipClick = false; }, 0);
      }
      e.preventDefault();
      e.stopPropagation();
    });
    bar.addEventListener('click', function(e) {
      if (!_suppressChipClick) return;
      _suppressChipClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);

    // スクロール位置はここでは変更しない（呼び出し元 updateCatLabel が管理）
    setTimeout(updateChipArrows, 50);
  }

  // ピンボタン：カテゴリ選択モードで開く（オーバーレイなし・地図パン可）
  document.getElementById('categoryPinBtn').addEventListener('click', function (e) {
    L.DomEvent && L.DomEvent.stopPropagation(e);
    openedViaPin = true;
    // 地図下部チップバーが表示中の状態からピンモードに入ると、新しいカテゴリ
    // パネルの裏にチップバーが残って重なって見える不具合があったため、
    // ピンモードに入る瞬間にチップバーを非表示にする（閉じるときは元の状態に復元）。
    // cat-controls-hiddenは「隠すときは3秒かけてゆっくり」演出用のtransitionを
    // 持つため、そのまま付与すると新パネルと重なって見える時間が長引く。
    // 他の初期非表示処理と同じ要領でtransitionを一時的に無効化してから隠す。
    chipBarWasVisibleBeforePin = !document.body.classList.contains('cat-controls-hidden');
    if (chipBarWasVisibleBeforePin) {
      var chipBarEls = [
        document.getElementById('catSelectAllRow'),
        document.getElementById('catLabelWrapper'),
        document.getElementById('catControlsRestoreBtn'),
        document.getElementById('catControlsHideBtn')
      ];
      chipBarEls.forEach(function (el) { if (el) el.style.transition = 'none'; });
      document.body.classList.add('cat-controls-hidden', 'cat-controls-restore-ready');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          chipBarEls.forEach(function (el) { if (el) el.style.transition = ''; });
        });
      });
    }
    if (catSel.size === 0) {
      // マーカーが表示中かどうか確認して自動的に catSel へ反映
      var hasAnyVisible = false;
      CATEGORIES.forEach(function(c) {
        var hasThis = markersData.some(function(d) { return macroOf(d.restaurant.genre).key === c.key && map.hasLayer(d.marker); });
        if (hasThis) {
          hasAnyVisible = true;
          catSel.add(c.key);
          var b = gearBtnEl(c.key);
          if (b) b.classList.add('cat-selected');
        }
      });
      if (hasAnyVisible) {
        updateAllBtn();   // 全選択状態ならすべてボタンをグレーアウト
        updateClearBtn(); // 選択があれば解除ボタンをアクティブに
        // マーカーはそのまま維持
      } else {
        // 何も表示されていない → 全マーカーを非表示にして新規選択
        hideCatLabel();
        markersData.forEach(function({ marker }) {
          if (map.hasLayer(marker)) map.removeLayer(marker);
        });
        updateClearBtn(); // 何も選択なし → 解除ボタンをグレーアウト
      }
    } else {
      // catSel に選択済みがある場合（状態Bからの復帰）：ボタン状態・マーカーをそのまま維持
      updateAllBtn();
      updateClearBtn();
    }
    // マーカーのタップを無効化（mapは初期化済みなのでここで取得）
    map.getPane('markerPane').style.pointerEvents = 'none';
    // ヘッダーを非表示にして地図エリアを広げる
    document.querySelector('header').style.display = 'none';
    // パネルを開く＋オーバーレイ（グレー表示のみ・地図操作は維持）
    menu.style.display = 'block';
    showCategory();
    overlay.classList.add('active', 'map-interactive'); // pointer-events:none で地図操作を通す
    // パネルが描画されてから地図を上にシフト（panByで確実に移動）
    requestAnimationFrame(function () {
      menu.classList.add('gear-visible');
      overlay.classList.add('gear-visible');
      var panelTop  = menu.getBoundingClientRect().top;
      var px        = Math.round((window.innerHeight - panelTop) / 2);
      if (px > 0) {
        savedPanPixels = px; // ずらした量を保存（復元用）
        map.panBy([0, px], { animate: true, duration: 0.7 });
      }
    });
    // disableMap() は呼ばない → ドラッグ・ピンチ・ダブルタップズームは動作継続

    // クリック操作を遮断するブロッキングdivを#map内に挿入
    // z-index 700 = markerPane(600)より上・gearMenu(1501)/zoomCtrl(1502)より下
    // touchイベントは通過 → ドラッグ・ダブルタップズームは維持
    var blocker = document.createElement('div');
    blocker.id = 'catModeBlocker';
    blocker.style.cssText = 'position:absolute;inset:0;z-index:700;background:transparent;pointer-events:auto;';
    blocker.addEventListener('click', function(e) { e.stopPropagation(); });
    document.getElementById('map').appendChild(blocker);
    // 石川ボタン以外をグレーアウト＋操作不可に（石川ボタンはオーバーレイより手前で有効のまま）
    document.getElementById('sideSwipeCtrl').style.zIndex = '1501'; // コンテナ全体をオーバーレイより上へ
    ['sideSwipeDown','locateBtn','categoryPinBtn','gearBtn'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.style.opacity = '0.35'; el.style.pointerEvents = 'none'; }
    });
    // ishikawaBtnはそのまま（通常表示・クリック可能）
    // 「一覧」ボタンは押せないようにする（「地図」「店名」ボタンは操作可能のまま維持。
    // 「地図」は押すとパネルを閉じてメイン地図に戻る = handleMapTabClick()）
    var bTabListOpen = document.getElementById('bottomTabList');
    if (bTabListOpen) bTabListOpen.style.pointerEvents = 'none';
    // 「地図」ボタンは押せるが、オーバーレイ(黒半透明)の下にあると暗く見えてしまうため
    // 「店名」ボタンと同じく白背景・黒文字＋前面表示にする（cat-lockedクラスで対応）
    var bTabMapOpen = document.getElementById('bottomTabMap');
    if (bTabMapOpen) bTabMapOpen.classList.add('cat-locked');
    // Leafletのタップ合成クリックも無効化
    if (map.tap) map.tap.disable();
  });

  // ── 初期表示：地図下部にカテゴリチップバー（施設アイコン）を常時表示 ──
  // ページを開いた直後から全カテゴリのチップを並べ、表示中のカテゴリを色付きにする。
  // markersData 生成・applyFilter('all') 実行後に走らせるため setTimeout(0) を使用
  setTimeout(function () {
    if (catChipSet.size > 0) return; // 既に表示済みなら何もしない
    CATEGORIES.forEach(function (c) {
      catChipSet.add(c.key); // チップは全カテゴリ分並べる
      var visible = markersData.some(function (d) {
        return macroOf(d.restaurant.genre).key === c.key && map.hasLayer(d.marker);
      });
      if (visible) {
        catSel.add(c.key);
        var b = gearBtnEl(c.key);
        if (b) b.classList.add('cat-selected');
      }
    });
    updateAllBtn();
    updateClearBtn();
    updateCatLabel(); // catChipSet の全チップを描画（表示中カテゴリは色付き）
    updateSelectAllChipsBtns();

    // サイトを開いた直後は、下部カテゴリチップバーを最初から畳んだ状態
    // （⬆ボタンのみ表示）にする。cat-controls-hiddenのCSSは「表示中のものを
    // ユーザー操作で隠す」演出用に3秒かけてゆっくりフェードアウトする設計のため、
    // そのまま付与すると一瞬表示されてからフェードして消える誤動作になる。
    // 今日の石川ニュースバナーのhideBannerInstant()と同じ要領で、対象要素の
    // transitionを一時的に無効化してから最初から隠れた状態にする。
    var catCtrlEls = [
      document.getElementById('catSelectAllRow'),
      document.getElementById('catLabelWrapper'),
      document.getElementById('catControlsRestoreBtn'),
      document.getElementById('catControlsHideBtn')
    ];
    catCtrlEls.forEach(function (el) { if (el) el.style.transition = 'none'; });
    document.body.classList.add('cat-controls-hidden', 'cat-controls-restore-ready');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        catCtrlEls.forEach(function (el) { if (el) el.style.transition = ''; });
      });
    });
  }, 0);

  // 歯車ボタン：メニュー開閉トグル
  document.getElementById('gearBtn').addEventListener('click', function (e) {
    L.DomEvent && L.DomEvent.stopPropagation(e);
    if (menu.style.display === 'none') { showMain(); } else { closeMenu(); }
  });

  // 左右切り替え：右手操作用にサイドボタン列を左右反転
  (function () {
    var ctrl      = document.getElementById('sideSwipeCtrl');
    var rightBtn  = document.getElementById('sideSwitchRightBtn');
    var leftBtn   = document.getElementById('sideSwitchLeftBtn');
    if (!ctrl || !rightBtn || !leftBtn) return;

    function applySide(isRight) {
      ctrl.classList.toggle('side-right', isRight);
      document.body.classList.toggle('side-swipe-right', isRight);
      rightBtn.style.display = isRight ? 'none' : '';
      leftBtn.style.display  = isRight ? '' : 'none';
    }

    rightBtn.addEventListener('click', function (e) {
      L.DomEvent && L.DomEvent.stopPropagation(e);
      applySide(true);
    });
    leftBtn.addEventListener('click', function (e) {
      L.DomEvent && L.DomEvent.stopPropagation(e);
      applySide(false);
    });
  })();

  // メインメニュー
  document.getElementById('gearCloseBtn').addEventListener('click', closeMenu);

  // カテゴリサブメニュー
  // 「すべて」ボタン：全カテゴリを選択
  btnAll.addEventListener('click', function () {
    if (!openedViaPin) return;
    CATEGORIES.forEach(function(c) {
      catSel.add(c.key);
      var b = gearBtnEl(c.key);
      if (b) b.classList.add('cat-selected');
    });
    updateCatPreview();
  });
  // 「解除」ボタン：全選択を解除
  btnClear.addEventListener('click', function () {
    if (!openedViaPin) return;
    catSel.clear();
    CATEGORIES.forEach(function(c) {
      var b = gearBtnEl(c.key);
      if (b) b.classList.remove('cat-selected');
    });
    updateCatPreview();
  });

  // 地図下部チップバー上の「すべて選択」：表示中の全カテゴリを選択状態にする
  if (btnSelectAllChips) {
    btnSelectAllChips.addEventListener('click', function () {
      catChipSet.forEach(function(k) { catSel.add(k); });
      updateCatPreview();
    });
  }
  // 地図下部チップバー上の「すべて解除」：選択を全て解除する
  if (btnClearAllChips) {
    btnClearAllChips.addEventListener('click', function () {
      catSel.clear();
      updateCatPreview();
    });
  }

  // カテゴリボタン1つ分のトグル処理（ピンモード中：地図プレビュー用の選択切替）
  function toggleGearCategory(key) {
    var btn = gearBtnEl(key);
    if (catSel.has(key)) { catSel.delete(key); if (btn) btn.classList.remove('cat-selected'); }
    else                 { catSel.add(key);    if (btn) btn.classList.add('cat-selected'); }
    updateCatPreview();
  }

  // 大分類ボタン群（歯車パネル）をCATEGORIESから動的生成する
  // （新カテゴリ追加時にindex.html側の編集が不要になる）
  function buildGearCategoryGrid() {
    var grid = document.getElementById('gearCatGrid');
    if (!grid) return;
    grid.innerHTML = '';
    CATEGORIES.forEach(function(c) {
      var btn = document.createElement('button');
      btn.className = 'gear-menu-btn cat-icon-btn';
      btn.id = 'gearCat' + c.key.charAt(0).toUpperCase() + c.key.slice(1);
      btn.dataset.cat = c.key;
      btn.textContent = t('filter.' + c.key);
      btn.style.setProperty('--fc-tint', c.tint || autoTint(c.color));
      grid.appendChild(btn);
    });
  }
  buildGearCategoryGrid();

  // 大分類ボタン群：ピンモード中はカテゴリのトグル選択、
  // 通常モード（メニューから開いた場合）は一覧画面へ遷移してそのカテゴリで絞り込む
  // （1つの委譲リスナーで全カテゴリボタンを処理。ボタンはJSで動的生成されるため）
  document.getElementById('gearCatGrid').addEventListener('click', function (e) {
    var btn = e.target.closest('.cat-icon-btn');
    if (!btn) return;
    var key = btn.dataset.cat;
    if (openedViaPin) {
      toggleGearCategory(key);
    } else {
      closeMenu();
      applyFilter(key);
      switchTab('list');
    }
  });
  // 選択モード終了→通常の地図に戻る（旧「閉じる」ボタンの処理。
  // 今は下部の「地図」タブ押下時に handleMapTabClick() から呼ばれる。
  // このIIFEの外（グローバル）から呼べるよう window に公開する）
  window._categoryPanelOpenViaPin = function () { return openedViaPin; };
  // 歯車パネルのカテゴリボタンを外部から再生成できるよう公開
  window._buildGearCategoryGrid = buildGearCategoryGrid;
  window._closeCategoryPanelFromMapTab = function () {
    if (openedViaPin) {
      // openedViaPin = false はcloseMenu()内で行う（地図復元チェックのため）
      map.getPane('markerPane').style.pointerEvents = ''; // タップを元に戻す
      if (catSel.size === 0) {
        // 何も選択せずに閉じた場合は、選択状態に合わせて全マーカーを非表示にする
        // （以前は元のフィルターを復元していたが、パネルで「すべて解除」した
        // つもりなのに閉じたら全件表示に戻る、という誤解を招く挙動だったため変更）
        markersData.forEach(function({ marker }) {
          if (map.hasLayer(marker)) map.removeLayer(marker);
        });
        hideCatLabel();
        syncLabelBtnWithMarkers();
        // 何も選択せずに閉じたことが分かるよう、地図中央に案内ポップを直接表示する
        showNoShopNotice();
      } else {
        // 選択中のカテゴリをラベルバーに表示
        // catSel・ボタン状態はそのまま保持（涙目アイコンで戻れるように）
        updateCatLabel(true); // catSel を catChipSet にコピーしてバー生成
        syncLabelBtnWithMarkers();
      }
    }
    closeMenu();
  };

  // メニュー内のクリックが地図に伝播しないようにブロック
  menu.addEventListener('click', function (e) { e.stopPropagation(); });

  // 地図クリックでメニューを閉じる（ピンモード中は「閉じる」ボタンのみで閉じる）
  document.getElementById('map').addEventListener('click', function () {
    if (menu.style.display !== 'none' && !openedViaPin) closeMenu();
  });

  // ── 石川全域ボタン ────────────────────────────────────────────
  // openedViaPin / savedPanPixels にアクセスするためカテゴリIIFE内で登録
  (function () {
    var btn = document.getElementById('ishikawaBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (openedViaPin && savedPanPixels > 0) {
        // カテゴリパネル表示中：石川中心が画面上部に来るようオフセット
        var zoom = map.getBoundsZoom(ISHIKAWA_BOUNDS);
        var center = ISHIKAWA_BOUNDS.getCenter();
        var centerPx = map.project(center, zoom);
        var offsetPx = centerPx.add([0, savedPanPixels]);
        var adjustedCenter = map.unproject(offsetPx, zoom);
        map.flyTo(adjustedCenter, zoom, { duration: 1.0 });
      } else {
        fitIshikawaAll(true);
      }
    });
  })();
})();

function openInfoPanel() {
  const appBody = document.getElementById('appBody');
  if (!appBody) return;
  appBody.dataset.view = 'info';
  document.body.classList.add('info-open');
  document.body.classList.remove('list-open');
  document.body.classList.remove('cat-controls-hidden');
}

document.addEventListener('DOMContentLoaded', function () {
  if (location.hash === '#info') {
    openInfoPanel();
    history.replaceState(null, '', location.pathname + location.search);
  }
});

// ── スマホ：タブバーのスワイプでヘッダー操作・情報パネル表示 ────────
// 旧タブバー(.mobile-tabs)はDOM上に残っているがスマホでは display:none で
// 触れられないため、実際に画面に見えている#bottomTabs（地図/店名/一覧バー）を使う。
(function () {
  const tabs = document.getElementById('bottomTabs');
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
      openInfoPanel();
    }
  }, { passive: true });
})();

// ── 左側スワイプボタン（⬇）のクリックハンドラ ──────────────────
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const downBtn = document.getElementById('sideSwipeDown');
    if (!downBtn) return;

    downBtn.addEventListener('click', function () {
      // 情報パネルを開く
      openInfoPanel();
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
        document.body.classList.remove('list-open');
        setTimeout(() => { if (typeof map !== 'undefined') map.invalidateSize(); }, 50);
      }
    }

    // 「地図」ボタンを押すと地図に戻る
    const mapBtn = document.getElementById('infoMapBtn');
    if (mapBtn) mapBtn.addEventListener('click', closeInfoPanel);

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

// ── 情報パネル中央エリア：指の動きに追従して伸縮し、離すと元に戻る ────
// コンテンツが画面に収まりスクロールの余地が無いため、実スクロールでは
// 動きが出ない。ドラッグ量に応じてtransformを付け、指を離すとバネの
// ように0へ戻すことで、上下バーは固定したまま中央だけ触感を出す。
//
// ボタンの押下色（.pressed）は「一定時間タッチしたまま動かなかったら
// 押したと判断」する時間差判定＋「一定距離動いたらドラッグと判断」する
// 距離判定を組み合わせる。すぐ指を離す通常のタップでは色が一瞬も
// つかず、そのままページへ遷移する（クリック自体はブラウザの
// 標準動作なので、この処理の影響を受けない）。
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const inner = document.querySelector('.info-panel-inner');
    if (!inner) return;

    const DAMP          = 2;    // 抵抗（大きいほど動きが小さい）
    const MAX_DRAG       = 90;   // 最大移動量(px)
    const MOVE_THRESHOLD = 8;    // これ以上動いたらドラッグ扱い
    const PRESS_DELAY    = 100;  // これだけ動かず待ったら押下色をつける(ms)
    let startY = 0, dragging = false, pressedBtn = null, pressTimer = null;

    function clearPress() {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      if (pressedBtn) { pressedBtn.classList.remove('pressed'); pressedBtn = null; }
    }

    inner.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      startY   = e.touches[0].clientY;
      dragging = true;
      inner.style.transition = 'none';

      const btn = e.target.closest('.info-menu-btn');
      if (btn) {
        pressedBtn = btn;
        pressTimer = setTimeout(function () {
          if (pressedBtn) pressedBtn.classList.add('pressed');
          pressTimer = null;
        }, PRESS_DELAY);
      }
    }, { passive: true });

    inner.addEventListener('touchmove', function (e) {
      if (!dragging || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      if (pressedBtn && Math.abs(dy) > MOVE_THRESHOLD) {
        clearPress(); // ドラッグ確定：以後このタッチではタップ色を出さない
      }
      const damped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dy / DAMP));
      inner.style.transform = 'translateY(' + damped + 'px)';
    }, { passive: true });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      clearPress();
      inner.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.2, 0.4, 1)';
      inner.style.transform  = 'translateY(0)';
    }
    inner.addEventListener('touchend',    endDrag, { passive: true });
    inner.addEventListener('touchcancel', endDrag, { passive: true });
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

    // GoatCounter にパスワード認証成功イベントを送信
    // （/ishikawa-map のカウントとは別に「password-success」として記録）
    setTimeout(function() {
      if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({
          path:  'password-success',
          title: 'パスワード認証成功',
          event: true
        });
      }
    }, 500); // GoatCounter の非同期読み込み完了を待つ

    // オーバーレイ消去後に石川地区全体を表示
    setTimeout(() => {
      if (typeof map !== 'undefined') {
        fitIshikawaAll(false);
      }
    }, 500);
  } else {
    errMsg.textContent = 'パスワードが違います。もう一度入力してください。';
    input.value = '';
    input.focus();
  }
}

// ── 店舗データは restaurants-data.js で定義（index.html から先読み込み）──

// ── (以下はデータ移動前の名残コメント。データは上記ファイル参照) ──
const _restaurants_placeholder = [
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

// 一覧画面の絞り込み状態（大分類＋小分類の2階層。'all'は大分類未選択＝全件）
let currentMacro = 'all';
let currentSub   = null;
let currentSearch  = '';

// ── カテゴリ別マーカーカラー ────────────────────────────────────
const FOOD_COLOR      = "#e53935"; // 居酒屋等：赤
const SHOKUJI_COLOR   = "#f57c00"; // 食事処：オレンジ
const CONBINI_COLOR   = "#fb8c00"; // コンビニ：オレンジ
const GAS_COLOR       = "#1565c0"; // ガソリン：青
const STAY_COLOR      = "#7b1fa2"; // 宿泊：紫
const FINANCE_COLOR   = "#2e7d32"; // 金融：緑
const EDUCATION_COLOR = "#00695c"; // 教育：ティール
const TOURISM_COLOR   = "#0097a7"; // 観光：シアン
const BEAUTY_COLOR    = "#d81b60"; // 美容・理容：ピンク
const DEFAULT_COLOR   = FOOD_COLOR;
const WARN_COLOR      = "#f57c00";

function genreColor(genre) {
  return macroOf(genre).color;
}

// ── コンビニブランド情報（アイコン色） ────────────────────────────
function conbiniBrandInfo(name) {
  return { color: CONBINI_COLOR, label: '' }; // コンビニはすべてオレンジ
}

// ── ガソリンスタンドブランド情報（アイコン色） ────────────────────
function gasBrandInfo(name) {
  return { color: GAS_COLOR, label: '' }; // ガソリンはすべて青
}

// ── SVG ピンアイコン生成 ─────────────────────────────────────────
// innerLabel: コンビニブランドの頭文字など（省略時は白丸のみ）
function makePinIcon(fillColor, isWarn, innerLabel) {
  const color = fillColor; // カテゴリ色を使用（warn店舗も同じ色）
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 42" width="30" height="42">
      <path d="M15 1C8.1 1 2.5 6.6 2.5 13.5C2.5 22.9 15 41 15 41
               C15 41 27.5 22.9 27.5 13.5C27.5 6.6 21.9 1 15 1Z"
            fill="${color}" stroke="white" stroke-width="2.2"/>
      <circle cx="15" cy="13.5" r="5.5" fill="white" opacity="0.92"/>
    </svg>`;
  return L.divIcon({
    className: "",
    html: `<div class="pin-anim-wrap">${svg}</div>`,
    iconSize:   [30, 42],
    iconAnchor: [15, 42],
    popupAnchor:[0, -48]
  });
}

// ── Google マップ URL 生成 ────────────────────────────────────────
function gmapUrl(name, address) {
  return "https://www.google.com/maps/search/?api=1&query="
       + encodeURIComponent(name + " " + address);
}

// ── 出典ラベル判定（ポップアップ・店舗詳細ページ共通の考え方） ──────────
// 食べログ等の第三者サイトは固有名、うるま市公式サイトは名称で表示する。
// それ以外は「公式サイト」と決めつけず、ドメイン名をそのまま出典として示す
// （機械的にsourceUrlのドメインを見ているだけで、実際に公式か確認したわけ
//   ではないため。誤って「公式」と断定表示しないための方針）
const THIRD_PARTY_SITE_LABELS = [
  { domain: 'tabelog.com',    label: '食べログ' },
  { domain: 'ekiten.jp',      label: 'エキテン' },
  { domain: 'yahoo.co.jp',    label: 'Yahoo!地図' },
  { domain: 'navitime.co.jp', label: 'NAVITIME' },
  { domain: 'hotpepper.jp',   label: 'ホットペッパー' },
  { domain: 'hitosara.com',   label: 'ヒトサラ' },
  { domain: 'yelp.com',       label: 'Yelp' }
];
const OFFICIAL_SITE_LABELS = [
  { domain: 'city.uruma.lg.jp', label: 'うるま市公式サイト' }
];
function sourceHostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch (e) { return ''; }
}
function sourceSiteLabel(url) {
  const host = sourceHostOf(url);
  if (!host) return '';
  const findIn = function (list) {
    return list.find(function (s) { return host === s.domain || host.endsWith('.' + s.domain); });
  };
  const hit = findIn(THIRD_PARTY_SITE_LABELS) || findIn(OFFICIAL_SITE_LABELS);
  return hit ? hit.label : host;
}
function sourceNoteHtml(url) {
  const label = sourceSiteLabel(url);
  if (!label) return '';
  return `<span class="source-note"><a href="${url}" target="_blank" rel="noopener">（情報源：${label}）</a></span>`;
}

// ── ポップアップ HTML 生成 ────────────────────────────────────────
function makePopup(r) {
  const srcNote    = sourceNoteHtml(r.sourceUrl);
  const hoursHtml  = rHours(r).replace(/\n/g, "<br>") + (r.hours.includes("要確認") ? "" : srcNote);
  const closedVal  = rClosed(r) + (r.closed.includes("要確認") ? "" : srcNote);
  const closedHtml = (r.closed.includes("要確認"))
    ? `<span style="color:#e65100">${closedVal}</span>`
    : closedVal;
  const noteVal  = r.note ? (rNote(r) + srcNote) : t('popup.noteEmpty');
  const noteHtml = r.warn
    ? `<div class="popup-warning">⚠️ ${noteVal}</div>`
    : `<tr>
         <td class="label">${t('popup.note')}</td>
         <td class="value">${noteVal}</td>
       </tr>`;

  return `
    <div class="popup-wrap">
      <div class="popup-name">${r.name}</div>
      <span class="popup-genre">${rGenre(r)}</span>
      <table class="popup-table">
        <tr>
          <td class="label">${t('popup.address')}</td>
          <td class="value">${r.address}</td>
        </tr>
        <tr>
          <td class="label">${t('popup.hours')}</td>
          <td class="value">${hoursHtml}</td>
        </tr>
        <tr>
          <td class="label">${t('popup.closed')}</td>
          <td class="value">${closedHtml}</td>
        </tr>
        ${r.warn ? "" : noteHtml}
      </table>
      ${r.warn ? noteHtml : ""}
      <div class="popup-links">
        <button class="popup-close-side" onclick="map.closePopup()">×</button>
        <div class="popup-btns-col">
          <a href="${gmapUrl(r.name, r.address)}"
             target="_blank" rel="noopener noreferrer"
             class="popup-btn gmap">${t('popup.gmap')}</a>
          <a href="detail.html?id=${r.id}"
             class="popup-btn source">${t('popup.detail')}</a>
        </div>
        <button class="popup-close-side" onclick="map.closePopup()">×</button>
      </div>
    </div>`;
}

// ── 地図初期化 ───────────────────────────────────────────────────
// ?shop=N 指定時（店舗詳細ページからの復帰）は、初期表示から
// 最初にその店舗の位置・ズームで開始する。
// こうしないと「まず石川中心の広域表示が一瞬見えてから店舗にジャンプする」
// フラッシュが発生してしまう（デフォルト中心→店舗中心の切り替えが目に見えてしまう）。
const _initialShopId = (function () {
  var s = new URLSearchParams(location.search).get('shop');
  return s !== null ? parseInt(s, 10) : NaN;
})();
const _initialShop = !isNaN(_initialShopId)
  ? restaurants.find(function (r) { return r.id === _initialShopId; })
  : null;
// ページ初期化時にヘッダーを畳んだ状態で開始する場合の共通処理。
// header要素には折りたたみアニメーション用のtransition（max-height等、
// 最大1.8s）が定義されているため、classList.addした直後はまだアニメーション
// 開始直後（ヘッダーがほぼ元の高さのまま）の状態が続く。この直後に地図
// （L.map、このすぐ後で初期化される）を作ると、Leafletは「ヘッダーがある
// 狭い状態」のサイズで初期化されてしまい、その後アニメーションでヘッダーが
// 消えてもinvalidateSize()を呼ぶ処理がどこにも無いため、Leaflet内部の
// サイズキャッシュだけが古い（狭い）まま固定される。結果、画面中央固定の
// 二重丸マーカー（CSSで#map要素の中央に固定）とLeafletが認識する地図の
// 中心（map.getCenter()）が大きくズレ、ミニマップ上の対応マーカーの位置も
// ズレる不具合が起きていた。ニュースバナー等と同じ要領でtransitionを
// 一時的に無効化し、瞬時に最終状態（ヘッダー無し）にしてから地図を初期化する。
function collapseHeaderInstant() {
  var els = [document.querySelector('header'), document.querySelector('.wip-bar')].filter(Boolean);
  els.forEach(function (el) { el.style.transition = 'none'; });
  document.body.classList.add('header-collapsed');
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      els.forEach(function (el) { el.style.transition = ''; });
    });
  });
}

// ヘッダーを畳むアニメーション（見た目は残したまま）が既に始まっている状態から、
// 実際にレイアウト高さが変わり終わるタイミングでコールバックを呼ぶ。
// headerのmax-height transitionは0.5sだが、ここを固定のsetTimeout値（50ms/380ms等）で
// 決め打ちすると、環境によってはアニメーション完了前にinvalidateSize()が走ってしまい、
// 画面中央固定の二重丸マーカーとミニマップの位置がズレる不具合が起きていた
// （collapseHeaderInstant()と同種の原因・別の発生箇所）。
// transitionendを見て正確なタイミングを取り、万一発火しない場合の保険として
// タイムアウトも用意する。
function onHeaderCollapseSettled(cb) {
  var header = document.querySelector('header');
  if (!header) { cb(); return; }
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    header.removeEventListener('transitionend', onEnd);
    clearTimeout(fallback);
    cb();
  }
  function onEnd(e) {
    if (e.propertyName === 'max-height') finish();
  }
  header.addEventListener('transitionend', onEnd);
  var fallback = setTimeout(finish, 700); // 0.5sのtransitionに余裕を持たせた保険
}

// 店舗フォーカス時はポップアップを広く見せるため最初からヘッダーを畳んでおく
if (_initialShop) collapseHeaderInstant();

// 青いヘッダーバーは「サイトを最初に開いたとき」だけ自動表示する。
// 「このサイトについて」等の他ページから「地図」ボタンで戻ってきたときは
// index.htmlが毎回まっさらに読み込まれるため、sessionStorageで
// 「このタブで既に表示済みか」を判定する（タブを閉じるまで保持される）
const _headerAlreadyShown = sessionStorage.getItem('siteHeaderShown') === '1';
if (!_initialShop) {
  if (_headerAlreadyShown) {
    collapseHeaderInstant();
  } else {
    sessionStorage.setItem('siteHeaderShown', '1');
  }
}

// 「このサイトについて」等の他ページから「地図」ボタンで戻ってきたときに
// 直前の表示位置・ズームを復元する（?shop=N指定時はそちらを優先、
// 初回アクセス等で保存が無ければデフォルトの石川全域表示のまま）。
function _readSavedMapView() {
  try {
    var v = JSON.parse(sessionStorage.getItem('lastMapView'));
    if (v && typeof v.lat === 'number' && typeof v.lng === 'number' && typeof v.zoom === 'number') return v;
  } catch (e) {}
  return null;
}
const _savedMapView = _initialShop ? null : _readSavedMapView();

const map = L.map("map", {
  center:  _initialShop   ? [_initialShop.lat, _initialShop.lng]
          : _savedMapView ? [_savedMapView.lat, _savedMapView.lng]
          : [26.430, 127.828],
  zoom:    _initialShop ? 16 : (_savedMapView ? _savedMapView.zoom : 14),
  maxZoom: 21,
  zoomControl: false,  // デフォルト左上を無効化→左下に再配置
  zoomSnap: 0,         // ズームレベルをスナップしない（指離し時のアニメーションを防止）
});

// 地図を動かす／ズームするたびに現在の表示位置を保存
map.on('moveend', function () {
  try {
    var c = map.getCenter();
    sessionStorage.setItem('lastMapView', JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
  } catch (e) {}
});

// ＋－ボタン：スマホ→左下、PC→左上
L.control.zoom({ position: window.innerWidth <= 767 ? 'bottomleft' : 'topleft' }).addTo(map);

// スマホ：＋－ボタンを左側アイコン列（歯車の下）に移動し、矢印ボタンをその下に配置
// （ユーザー要望：表示順を「歯車→＋－→矢印」に入れ替え）
if (window.innerWidth <= 767) {
  var _sideCtrl  = document.getElementById('sideSwipeCtrl');
  var _zoomCtrl  = document.querySelector('.leaflet-control-zoom');
  var _arrowBtn1 = document.getElementById('sideSwitchRightBtn');
  if (_sideCtrl && _zoomCtrl && _arrowBtn1) {
    _sideCtrl.insertBefore(_zoomCtrl, _arrowBtn1);
  }
}

// ダブルクリック/ダブルタップでスムーズズームイン（CSSトランジション使用）
// flyTo はJSアニメーションのためモバイルでカクつくことがある。
// setView + CSS トランジション（GPU加速）で滑らかに。
map.doubleClickZoom.disable();
map.on('dblclick', function (e) {
  // スマホでは IIFE（ダブルタップ+ドラッグ処理）がすでにズームを処理済みの場合はスキップ
  if (window._dblTapJustHandled) return;
  map.setView(e.latlng, map.getZoom() + 1, { animate: true });

  // ── スマホ：ダブルタップ後に指を押したままドラッグすると
  // ブラウザが「ダブルタップドラッグズーム」ジェスチャーと解釈し
  // 指を離したときにカクカクした動きが起きる。
  // touchend まで touchmove を preventDefault + stopPropagation で封鎖する。
  if ('ontouchstart' in window) {
    var mc = map.getContainer();
    function blockDragZoom(te) {
      te.preventDefault();
      te.stopPropagation();
    }
    function releaseDragZoomBlock() {
      mc.removeEventListener('touchmove', blockDragZoom, { capture: true });
    }
    mc.addEventListener('touchmove',  blockDragZoom,         { capture: true, passive: false });
    mc.addEventListener('touchend',   releaseDragZoomBlock,  { capture: true, passive: true, once: true });
    mc.addEventListener('touchcancel',releaseDragZoomBlock,  { capture: true, passive: true, once: true });
  }
});


L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
  maxNativeZoom: 19,
  maxZoom: 21,
  keepBuffer: 4,
  // スマホの既定(true)だとスクロールが止まるまでタイル読込が始まらず、
  // 素早いスクロールで灰色領域が目立つ。スクロール中も読込を開始する
  updateWhenIdle: false,
  updateInterval: 100
}).addTo(map);

// 石川エリアの初期表示位置
const ISHIKAWA_CENTER = [26.430, 127.828];
const ISHIKAWA_ZOOM   = window.innerWidth <= 767 ? 13 : 14;
// 石川地区全体（青線境界）が収まる範囲。初期表示・石川全域ボタンで使用
const ISHIKAWA_BOUNDS = L.latLngBounds(ISHIKAWA_BOUNDARY).pad(0.03);

// 石川地区全体を表示する共通処理。
// 右上ミニマップの下・下部チップバーの上に境界とピンが収まるよう余白を自動計算する
function fitIshikawaAll(fly) {
  var mapRect = map.getContainer().getBoundingClientRect();
  var topPad = 10, bottomPad = 10;

  var mm = document.getElementById('minimap');
  if (mm) {
    var mmRect = mm.getBoundingClientRect();
    if (mmRect.height > 0) topPad = Math.max(topPad, Math.round(mmRect.bottom - mapRect.top) + 8);
  }
  var chips = document.getElementById('catLabelWrapper');
  if (chips && chips.style.display !== 'none') {
    var chRect = chips.getBoundingClientRect();
    if (chRect.height > 0) bottomPad = Math.max(bottomPad, Math.round(mapRect.bottom - chRect.top) + 8);
  }

  var opts = {
    paddingTopLeft:     L.point(8, topPad),
    paddingBottomRight: L.point(8, bottomPad)
  };
  // このズームはプログラムによる自動調整であり、ユーザー操作ではないため
  // 「地図操作でヘッダーを畳む」処理（zoomstartで発火）を一時的に止める
  window._suppressHeaderCollapse = true;
  if (fly) { opts.duration = 1.0; map.flyToBounds(ISHIKAWA_BOUNDS, opts); }
  else     { opts.animate = false; map.fitBounds(ISHIKAWA_BOUNDS, opts); }
  setTimeout(function () { window._suppressHeaderCollapse = false; }, 50);
}

// ── ポップアップペインをmap-pane（transformあり）の外へ移動 ─────────────
// leaflet-map-paneのCSSトランスフォームがz-indexのスタッキングコンテキストを閉じ込めるため
// ポップアップペインをmap containerの直接の子に移動し、z-index 1100を有効にする
(function () {
  map.whenReady(function () {
    var popupPane    = map.getPanes().popupPane;
    var mapContainer = map.getContainer();

    // ポップアップペインをmap containerの直接の子へ移動
    mapContainer.appendChild(popupPane);
    popupPane.style.position   = 'absolute';
    popupPane.style.zIndex     = '1503'; // ズームコントロール(1502)より前面
    popupPane.style.left       = '0';
    popupPane.style.top        = '0';
    popupPane.style.willChange = 'transform';

    // left/topではなくtransformで同期（layout reflow回避・GPU処理）
    function syncPopupPanePos() {
      var pos = map._getMapPanePos();
      popupPane.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
    }
    syncPopupPanePos();
    map.on('move zoom viewreset', syncPopupPanePos);
  });
})();

// 初期表示は石川地区全体（青線境界）が収まる範囲
// チップバー生成後に実行するため少し遅らせる
// ただし ?shop=N 指定時（店舗詳細ページからの復帰）は、下の focusShop() が
// 表示を制御するのでこの広域表示は行わない（実行すると focusShop の結果を上書きしてしまう）。
// 同様に、直前の表示位置を復元した場合（_savedMapView）もこの自動フィットで
// 上書きしない（実行すると復元した位置がリセットされてしまう）。
if (new URLSearchParams(location.search).get('shop') === null && !_savedMapView) {
  setTimeout(() => {
    fitIshikawaAll(false);
  }, 500);
}

// ── ミニマップ（右上の概要図） ─────────────────────────────────────
(function () {
  const miniMapEl = document.getElementById('minimap');
  if (!miniMapEl) return;
  miniMapEl.classList.add('minimap-loading');
  let _miniMapReadyForDisplay = false;

  // ミニマップ中心 = 石川エリア中心（主地図の初期位置と同じ）
  const miniMap = L.map('minimap', {
    center:             ISHIKAWA_CENTER,
    zoom:               12,
    zoomSnap:           0.25, // fitBoundsで境界線がぴったり収まるよう細かく調整
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

  const miniTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(miniMap);

  // タイル読み込み失敗を自動リトライ（OSMタイルサーバーの一時的な混雑・
  // レート制限で灰色のまま残ることがあるため。ページ再読込直後は
  // メイン地図・ミニマップ・ピン画像が一斉にリクエストされるため起きやすい）
  miniTileLayer.on('tileerror', function (e) {
    setTimeout(function () {
      if (!e.tile) return;
      // src代入が同一文字列だとブラウザが再取得しないため、一旦クリアしてから戻す
      var src = e.tile.src;
      e.tile.src = '';
      e.tile.src = src;
    }, 1200);
  });

  // 石川エリアの境界（メイン地図と同じ線。海岸線部分は非表示のため開いた線で描画）
  const miniBoundary = L.polyline(ISHIKAWA_BOUNDARY, {
    color:   '#1976D2',
    weight:   2,
    opacity:  0.9
  }).addTo(miniMap);

  // 境界線全体が収まるようにズームを自動調整
  miniMap.fitBounds(miniBoundary.getBounds(), { padding: [4, 4] });

  // ── CSSオーバーレイ式2重丸（ミニマップ枠端でクランプ表示） ──────
  // Leafletマーカーはoverflowでクリップされ消えてしまうため
  // #minimap直下にdivを置き、ピクセル座標でクランプして端に半分見える表示を実現
  const miniTargetEl = document.createElement('div');
  miniTargetEl.className = 'mini-target-icon';
  miniTargetEl.style.cssText =
    'position:absolute;z-index:1000;transform:translate(-50%,-50%);pointer-events:none;';
  miniMapEl.appendChild(miniTargetEl);

  let _popupOpen = false;
  let _targetLatLng = L.latLng(ISHIKAWA_CENTER);

  // latlng → ミニマップのピクセル座標に変換し、枠内にクランプして配置
  function updateMiniTarget() {
    var pt    = miniMap.latLngToContainerPoint(_targetLatLng);
    var w     = miniMapEl.clientWidth;
    var h     = miniMapEl.clientHeight;
    // 端から2px内側にクランプ → 2重丸の約2/3が見える（半分より分かりやすく）
    var inset = 2;
    var x = Math.max(inset, Math.min(w - inset, pt.x));
    var y = Math.max(inset, Math.min(h - inset, pt.y));
    miniTargetEl.style.left = x + 'px';
    miniTargetEl.style.top  = y + 'px';
  }

  function revealMinimap() {
    if (_miniMapReadyForDisplay) return;
    _miniMapReadyForDisplay = true;
    updateMiniTarget();
    miniMapEl.classList.remove('minimap-loading');
  }

  // メイン地図のパン・ズームで追従（ポップアップ表示中はスキップ）
  function syncMinimap() {
    if (!_popupOpen) {
      _targetLatLng = map.getCenter();
      updateMiniTarget();
    }
  }
  map.on('move',    syncMinimap);  // パン中リアルタイム追従
  map.on('moveend', syncMinimap);  // アニメーション完了後に必ず同期
  map.on('zoomend', syncMinimap);  // ズーム変化後も同期

  // ポップアップ表示時：その店舗位置に移動
  map.on('popupopen', function (e) {
    _popupOpen = true;
    const latlng = e.popup.getLatLng();
    if (!latlng) return;
    _targetLatLng = latlng;
    updateMiniTarget();
    setTimeout(function () {
      if (_popupOpen) { _targetLatLng = latlng; updateMiniTarget(); }
    }, 500);
  });

  // ポップアップを閉じたら地図中心に戻す
  map.on('popupclose', function () {
    _popupOpen = false;
    _targetLatLng = map.getCenter();
    updateMiniTarget();
  });

  // ミニマップへのクリックが主地図に伝播しないよう防ぐ
  L.DomEvent.disableClickPropagation(miniMapEl);

  // ミニマップを正しい位置・サイズに強制リセットする関数
  function resetMinimap() {
    miniMap.invalidateSize();
    // 境界線全体が収まる表示に強制リセット
    miniMap.fitBounds(miniBoundary.getBounds(), { padding: [4, 4], animate: false });
    updateMiniTarget();
    if (!_miniMapReadyForDisplay) {
      miniTileLayer.redraw(); // 初期表示前だけタイルを再取得（表示後のチカチカ防止）
    }
  }

  // ① 初期化：十分な時間をとってサイズ再計算（低速端末対策）
  setTimeout(resetMinimap, 300);
  setTimeout(resetMinimap, 800); // 二重保険
  setTimeout(revealMinimap, 1100);
  // ページの全リソース読込完了後にも再チェック（他ページから戻った直後は
  // 回線混雑でタイル取得が遅れ、800ms時点でも灰色が残ることがあるため）
  window.addEventListener('load', function () {
    setTimeout(resetMinimap, 300);
  });

  // ② バックグラウンドから復帰時（iOS/Androidでタブが一時停止→戻るとズレる）
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      setTimeout(resetMinimap, 200);
    }
  });

  // ③ ブラウザの「戻る」でbfcacheから復元されたとき。
  // この経路ではスクリプトの初期化が再実行されず、visibilitychangeやresizeも
  // 必ず発火するとは限らないため、古いサイズ・タイル位置が残ることがある。
  // DOMの表示状態が戻るのを二重rAFで待ってから再計算し、レイアウト安定後にも
  // もう一度合わせることで、復帰タイミングによるずれを防ぐ。
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        resetMinimap();
        miniTileLayer.redraw();
        setTimeout(resetMinimap, 250);
      });
    });
  });

  // ④ 画面回転・リサイズ時（連続発火中は前回分をキャンセルし、収まってから1回だけ実行＝デバウンス）
  var resizeMinimapTimer = null;
  window.addEventListener('resize', function () {
    if (resizeMinimapTimer) clearTimeout(resizeMinimapTimer);
    resizeMinimapTimer = setTimeout(resetMinimap, 150);
  });

  // ⑤ カテゴリパネルで非表示→再表示されたときに呼べるよう外部公開
  window._resetMinimap = resetMinimap;
})();

// ── 石川エリア境界線 ─────────────────────────────────────────────
// 旧石川市の行政区域境界（ishikawa-boundary.js のデータを使用）
// 恩納村・金武町・具志川との正確な境界線（海岸線部分は非表示のため開いた線で描画）
// padding:1 で画面外まで先に描画しておき、ズーム・パン時の再描画の遅れを見えなくする
L.polyline(ISHIKAWA_BOUNDARY, {
  color:   '#1976D2',
  weight:   3,
  opacity:  0.85,
  renderer: L.svg({ padding: 1 })
}).addTo(map);

// ── マーカー生成・保持 ───────────────────────────────────────────
const markersData = restaurants.map((r, idx) => {
  let color, pinLabel;
  if (r.genre === 'コンビニ') {
    color = CONBINI_COLOR;
  } else if (r.genre === 'ガソリン') {
    color = GAS_COLOR;
  } else if (r.genre === '食事処') {
    color = SHOKUJI_COLOR;
  } else if (r.genre === '宿泊') {
    color = STAY_COLOR;
  } else if (r.genre === '金融') {
    color = FINANCE_COLOR;
  } else if (r.genre === '教育') {
    color = EDUCATION_COLOR;
  } else if (r.genre === '観光') {
    color = TOURISM_COLOR;
  } else if (r.genre === '美容・理容') {
    color = BEAUTY_COLOR;
  } else {
    color = FOOD_COLOR;
  }
  pinLabel = undefined;
  const marker = L.marker([r.lat, r.lng], {
    icon:  makePinIcon(color, r.warn, pinLabel),
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

  // ── ポップアップを開く共通処理 ──────────────────────────────────
  function openThisPopup() {
    setActiveItem(idx);
    if (window.innerWidth <= 767 && !document.body.classList.contains('header-collapsed')) {
      _isReopening = true;
      marker.closePopup();
      _isReopening = false;
      document.body.classList.add('header-collapsed');
      onHeaderCollapseSettled(function() {
        map.invalidateSize();
        marker.openPopup();
      });
    } else {
      marker.openPopup();
    }
  }

  // ── タップ設定（スマホ用）────────────────────────────────────────
  // ・指が10px以上動いた場合はパン操作とみなしてポップアップを開かない
  // ・300ms以内に2回タップされた場合はダブルタップとみなし、タップ位置へズームイン
  function setupTap(el) {
    var _startX = 0, _startY = 0;
    var _tapTimer = null;
    el.addEventListener('touchstart', function(e) {
      _startX = e.touches[0].clientX;
      _startY = e.touches[0].clientY;
    }, { passive: true });
    // ダブルタップ→ドラッグ時: touchmoveで即タイマーキャンセル
    // （タイマーはtouchendより先に300msで発火するため、touchend内では間に合わない）
    el.addEventListener('touchmove', function(e) {
      if (!_tapTimer) return;
      var dx = Math.abs(e.touches[0].clientX - _startX);
      var dy = Math.abs(e.touches[0].clientY - _startY);
      if (dx > 10 || dy > 10) { clearTimeout(_tapTimer); _tapTimer = null; }
    }, { passive: true });
    el.addEventListener('touchend', function(e) {
      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var dx = Math.abs(endX - _startX);
      var dy = Math.abs(endY - _startY);
      if (dx > 10 || dy > 10) {
        if (_tapTimer) { clearTimeout(_tapTimer); _tapTimer = null; } // 念のため二重キャンセル
        return; // パン操作はスルー
      }
      e.preventDefault();
      e.stopPropagation();
      // ── ドラッグ状態リセット（ジャンプバグ修正）──────────────────
      // stopPropagation により document への touchend 伝播が止まり、
      // Leaflet の finishDrag が呼ばれない。すると Xe._dragging が残り、
      // 次の地図タッチ時に _onDown が _startPos/_startPoint を更新せず、
      // 古いマーカー位置を基点に計算して地図が瞬時に大きくジャンプする。
      // 対策: ここで手動で finishDrag を呼び Xe._dragging をリセットする。
      if (L.Draggable && L.Draggable._dragging) {
        L.Draggable._dragging.finishDrag(true); // noInertia=true でドリフトなし
      }
      // 正確性ポップアップを閉じるためのタップだった場合はここで打ち切る。
      // このタップ処理はtouchendを直接見ているため、popup側のclickイベント
      // 抑制（suppressNextClick）が効かない。window._suppressAccuracyPopupTap
      // フラグで直接連携する。
      if (window._suppressAccuracyPopupTap) {
        window._suppressAccuracyPopupTap = false;
        return;
      }
      if (_tapTimer) {
        // 300ms以内に2回目 → ダブルタップ：ポップアップをキャンセルして現在中心のままズームイン
        // ※ setView(latlng) だと店舗位置が中心になるため zoomIn() で中心を変えずにズーム
        clearTimeout(_tapTimer);
        _tapTimer = null;
        setTimeout(function() {
          // ① ズーム前にドラッグハンドラをリセット
          if (map.dragging) {
            map.dragging.disable();
            map.dragging.enable();
          }
          map.zoomIn(1, { animate: true });
          // ② ズームアニメーション完了後にも再度リセット
          map.once('moveend', function() {
            if (map.dragging) {
              map.dragging.disable();
              map.dragging.enable();
            }
          });
        }, 50);
        return;
      }
      // 300ms待ってから「シングルタップ確定」としてポップアップを開く
      _tapTimer = setTimeout(function() {
        _tapTimer = null;
        // ダブルタップ+ドラッグ中はポップアップを開かない
        if (window._dblTapDragActive) return;
        map.options.closePopupOnClick = false;
        setTimeout(function() { map.options.closePopupOnClick = true; }, 400);
        openThisPopup();
      }, 300);
    }, { passive: false });
  }

  // Leaflet の bindPopup が登録した内部クリックハンドラを削除して自前で制御
  marker.off('click');

  if ('ontouchstart' in window) {
    // ── スマホ：ワンタップでポップアップ ──
    // 問題: フィルター切替で remove→addTo すると Leaflet が新しい DOM 要素を生成し
    //       古い setupTap リスナーが消える。また、マップロード完了時に 'add' が
    //       遅延発火し setupTap が二重登録される場合がある。
    // 対策: 要素に _tapSetup フラグを付けて重複登録を防ぎ、新要素には必ず再設定する。
    function attachTap(el) {
      if (!el || el._tapSetup) return; // すでに設定済みの要素はスキップ
      el._tapSetup = true;
      setupTap(el);
    }
    function bindTapToElement() {
      attachTap(marker.getElement());
      setTimeout(function() {
        var tooltip = marker.getTooltip();
        if (!tooltip) return;
        attachTap(tooltip.getElement());
      }, 0);
    }
    // 初回（すでに addTo(map) 済み）
    bindTapToElement();
    // フィルター切り替え等で再 addTo されたとき（新要素が生成されフラグなし → 再設定）
    marker.on('add', function() {
      setTimeout(bindTapToElement, 0);
    });
  } else {
    // ── デスクトップ：通常クリックでポップアップ ──
    marker.on('click', function(e) {
      L.DomEvent.stopPropagation(e);
      openThisPopup();
    });
    // tooltipopen は remove→addTo のたびに再発火するので once でなく on で受ける
    // ※ 関数参照を保持して L.DomEvent.off で正しく削除し二重登録を防ぐ
    var _ttClickFn = null;
    marker.on('tooltipopen', function() {
      var ttEl = marker.getTooltip().getElement();
      if (!ttEl) return;
      if (_ttClickFn) L.DomEvent.off(ttEl, 'click', _ttClickFn);
      _ttClickFn = function(e) {
        L.DomEvent.stopPropagation(e);
        openThisPopup();
      };
      L.DomEvent.on(ttEl, 'click', _ttClickFn);
    });
  }

  return { restaurant: r, marker, idx };
});

// ── ポップアップ表示中のマーカーをソナー点滅させる ──────────────
// 点滅中のマーカーが他マーカーの後ろに隠れないよう、開いている間だけ
// zIndexOffsetを引き上げて最前面に表示する（閉じたら元に戻す）。
map.on('popupopen', function(e) {
  var src = e.popup._source;
  // 現在地マーカーは除外・店舗マーカーのみ対象
  if (src && src.getElement && !src._isLocationMarker) {
    var el = src.getElement();
    if (el) el.classList.add('marker-active-pulse');
    if (src.setZIndexOffset) src.setZIndexOffset(10000);
  }
});
map.on('popupclose', function(e) {
  document.querySelectorAll('.marker-active-pulse').forEach(function(el) {
    el.classList.remove('marker-active-pulse');
  });
  var src = e.popup._source;
  if (src && src.setZIndexOffset && !src._isLocationMarker) {
    src.setZIndexOffset(0);
  }
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

// ── ポップアップ内部close-reopenフラグ ──
let _isReopening = false; // marker.closePopup() の内部close-reopen中フラグ

// 地図アイコン直接クリック時：ポップアップが見えるようパン
focusShop._fromSidebar = false;
map.on('popupopen', function(e) {

  if (focusShop._fromSidebar) return; // サイドバーから開いた場合はスキップ
  if (window.innerWidth <= 767) return; // スマホ：自動パンなし（panByアニメ中にドラッグが競合してジャンプするため廃止）

  // ── デスクトップ：ポップアップが見切れないよう最小限パン ──
  setTimeout(function() {
    const popup   = e.popup;
    const popupEl = popup.getElement();
    const mapEl   = map.getContainer();
    if (!popupEl || !mapEl) return;

    const pr  = popupEl.getBoundingClientRect();
    const mr  = mapEl.getBoundingClientRect();
    const pad = 10;
    let dx = 0, dy = 0;
    if (pr.top    < mr.top    + pad) dy = pr.top    - mr.top    - pad;
    if (pr.bottom > mr.bottom - pad) dy = pr.bottom - mr.bottom + pad;
    if (pr.left   < mr.left   + pad) dx = pr.left   - mr.left   - pad;
    if (pr.right  > mr.right  - pad) dx = pr.right  - mr.right  + pad;
    if (dx !== 0 || dy !== 0) {
      map.panBy([dx, dy], { animate: true, duration: 1.0, easeLinearity: 0.01 });
    }
  }, 80);
});


// ポップアップ開閉時：ミニマップ・中央★・左矢印をポップアップの裏に隠す
map.on('popupopen',  function() { document.body.classList.add('popup-open');    });
map.on('popupclose', function() { document.body.classList.remove('popup-open'); });

// ── 店舗ポップアップを2本指ピンチで拡大縮小 ─────────────────────────
// Leafletは .leaflet-popup 自体にtransform:translate3d()で位置を設定しているため、
// そこにscaleを足すと位置がズレる（マーカーアイコンの拡大演出と同じ理由）。
// 内側の .leaflet-popup-content-wrapper（Leafletが位置制御に使わない要素）を
// スケールし、ピンチ中はstopPropagationで地図本体のズームに伝播させない。
//
// ポップアップは店舗ピンに紐づく情報なので、2本指を平行移動しても画面上を
// 自由に移動させない。支点を店舗ピン側の下中央へ固定し、指の間隔によるscaleだけを
// 反映する。固定支点なので、複数回ピンチしても基準点のズレは蓄積しない。
(function () {
  var MIN_SCALE = 0.7, MAX_SCALE = 2.5;
  var scale = 1;
  var startScale = 1, startDist = 0;
  var pinching = false;
  var wrapperEl = null;

  function touchDist(t0, t1) {
    var dx = t0.clientX - t1.clientX, dy = t0.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function applyTransform() {
    if (wrapperEl) wrapperEl.style.transform = 'scale(' + scale + ')';
  }
  function onTouchStart(e) {
    if (e.touches.length !== 2 || !wrapperEl) return;
    pinching = true;
    startDist = touchDist(e.touches[0], e.touches[1]);
    startScale = scale;
    e.preventDefault();
    e.stopPropagation();
  }
  function onTouchMove(e) {
    if (!pinching || e.touches.length !== 2) return;
    e.preventDefault();
    e.stopPropagation();
    var d = touchDist(e.touches[0], e.touches[1]);
    var newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, startScale * (d / startDist)));
    scale = newScale;
    applyTransform();
  }
  function onTouchEnd(e) {
    if (!pinching || e.touches.length >= 2) return;
    e.preventDefault();
    e.stopPropagation();
    pinching = false;
  }

  map.on('popupopen', function (e) {
    var popupEl = e.popup.getElement();
    wrapperEl = popupEl && popupEl.querySelector('.leaflet-popup-content-wrapper');
    if (!wrapperEl) return;
    scale = 1;
    pinching = false;
    wrapperEl.style.transformOrigin = '50% 100%';
    wrapperEl.style.transform = 'scale(1)';
    // capture段階で二本指イベントを止め、Leafletの地図ジェスチャーへ渡さない。
    // map.touchZoom自体は無効化しないため、ポップアップを閉じた直後も地図側で使える。
    wrapperEl.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    wrapperEl.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    wrapperEl.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
    wrapperEl.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: false });
  });
  map.on('popupclose', function () {
    wrapperEl = null;
    pinching = false;
  });
})();

// ── 地図操作時にヘッダーを自動非表示（スマホのみ） ─────────────────────
// ドラッグ・ズーム開始時にヘッダーを折りたたむ
if ('ontouchstart' in window) {
  function collapseHeaderOnInteraction() {
    if (window._suppressHeaderCollapse) return; // プログラムによる自動ズーム中は無視
    if (!document.body.classList.contains('header-collapsed')) {
      document.body.classList.add('header-collapsed');
      onHeaderCollapseSettled(function() { map.invalidateSize(); });
    }
  }
  map.on('dragstart', collapseHeaderOnInteraction);
  map.on('zoomstart', collapseHeaderOnInteraction);
}

// ── スマホ：地図を下へスワイプしたら下部カテゴリボタンを隠す ────────
(function () {
  const supportsTouch = 'ontouchstart' in window;

  const mapEl = document.getElementById('map');
  const restoreBtn = document.getElementById('catControlsRestoreBtn');
  const hideBtn = document.getElementById('catControlsHideBtn');
  if (!mapEl || !restoreBtn) return;

  // Leafletにもこのボタンを地図操作の対象外として認識させる。
  // スマホの合成クリックやPCのpointer/mouseイベントも地図へ渡さない。
  L.DomEvent.disableClickPropagation(restoreBtn);
  L.DomEvent.disableScrollPropagation(restoreBtn);

  let startX = 0;
  let startY = 0;
  let minY = 0;
  let latestDx = 0;
  let latestDy = 0;
  let draggingControls = false;
  let restoreStartY = 0;
  let ignoreGesture = false;
  let restoreRevealTimer = null;
  let revealMotionTimer = null;
  let restoreReadyTimer = null;
  let categoryPopupPanPixels = 0;
  let categoryPopupPan = null;
  let keepingPopupDuringRestore = false;
  const HIDE_THRESHOLD = 74;
  const MAX_DRAG = 145;
  const RESTORE_REVEAL_DELAY = 820;
  const CATEGORY_POPUP_PAN_DURATION = 1.05;

  function isMapView() {
    const appBody = document.getElementById('appBody');
    return appBody && appBody.dataset.view === 'map';
  }

  function hasVisibleCategoryControls() {
    const chips = document.getElementById('catLabelWrapper');
    const controls = document.getElementById('catSelectAllRow');
    return (chips && chips.style.display !== 'none') ||
           (controls && controls.style.display !== 'none');
  }

  function isShopPopup(popup) {
    const source = popup && popup._source;
    return !!(source && markersData.some(function(data) {
      return data.marker === source;
    }));
  }

  // カテゴリーボタンが下から戻るとき、開いている店舗ポップアップとマーカーも
  // 同じ距離だけ上へ動かし、両者が重ならないようにする。
  function panOpenShopPopupAboveCategories() {
    const popup = map._popup;
    if (!isShopPopup(popup) || (popup.isOpen && !popup.isOpen()) || categoryPopupPanPixels > 0) return;
    const popupEl = popup.getElement && popup.getElement();
    if (!popupEl) return;

    // 画面上端からはみ出さない範囲で、カテゴリーボタンの移動量（145px）と
    // 同じ距離を使う。地図ごと動かすためポップアップと店舗マーカーが一緒に移動する。
    const mapRect = mapEl.getBoundingClientRect();
    const popupRect = popupEl.getBoundingClientRect();
    const availableTopSpace = Math.max(0, Math.floor(popupRect.top - mapRect.top - 10));
    const panPixels = Math.min(MAX_DRAG, availableTopSpace);
    if (panPixels <= 0) return;

    categoryPopupPanPixels = panPixels;
    categoryPopupPan = popup;
    map.panBy([0, panPixels], {
      animate: true,
      duration: CATEGORY_POPUP_PAN_DURATION,
      easeLinearity: 0.25
    });
  }

  function restoreCategoryPopupPan() {
    if (categoryPopupPanPixels <= 0) return;
    const panPixels = categoryPopupPanPixels;
    categoryPopupPanPixels = 0;
    categoryPopupPan = null;
    map.panBy([0, -panPixels], {
      animate: true,
      duration: CATEGORY_POPUP_PAN_DURATION,
      easeLinearity: 0.25
    });
  }

  function hideCategoryControls() {
    if (!isMapView() || !hasVisibleCategoryControls()) return;
    restoreCategoryPopupPan();
    if (restoreRevealTimer) {
      clearTimeout(restoreRevealTimer);
      restoreRevealTimer = null;
    }
    if (revealMotionTimer) {
      clearTimeout(revealMotionTimer);
      revealMotionTimer = null;
    }
    document.body.classList.remove('cat-controls-restoring');
    document.body.classList.remove('cat-controls-revealing');
    document.body.classList.remove('cat-controls-restore-ready');

    // 上矢印は固定時間では出さず、収納用の下矢印が実際に消え終わった時点で表示する。
    // 地図をゆっくり／速く動かした場合でも、見た目の完了と表示開始が一致する。
    let hideCompleted = false;
    function revealRestoreButton() {
      if (hideCompleted) return;
      hideCompleted = true;
      if (restoreReadyTimer) {
        clearTimeout(restoreReadyTimer);
        restoreReadyTimer = null;
      }
      if (hideBtn) hideBtn.removeEventListener('transitionend', onHideTransitionEnd);
      if (document.body.classList.contains('cat-controls-hidden')) {
        document.body.classList.add('cat-controls-restore-ready');
      }
    }
    function onHideTransitionEnd(e) {
      if (e.propertyName === 'opacity') revealRestoreButton();
    }
    if (hideBtn) hideBtn.addEventListener('transitionend', onHideTransitionEnd);
    document.body.classList.add('cat-controls-hidden');
    // transitionendが発火しない環境向けの保険。通常は上のイベントで先に完了する。
    restoreReadyTimer = setTimeout(revealRestoreButton, 3200);
  }

  // 店舗ポップアップを開いたときは、ポップアップとマーカーを隠さないよう
  // 画面下のカテゴリーボタンを既存の下方向アニメーションで自動収納する。
  // popupopenと同時にレイアウトを動かすと実機のタップ確定処理と競合するため、
  // ポップアップを先に描画し、同じポップアップが開いていることを確認してから収納する。
  // 現在地など店舗以外のポップアップは対象にしない。
  map.on('popupopen', function(e) {
    const popup = e.popup;
    if (!isShopPopup(popup)) return;
    if (keepingPopupDuringRestore) return;
    setTimeout(function() {
      if (map._popup === popup && (!popup.isOpen || popup.isOpen())) {
        hideCategoryControls();
      }
    }, 120);
  });

  function showCategoryControls() {
    if (!document.body.classList.contains('cat-controls-hidden')) return;
    if (restoreReadyTimer) {
      clearTimeout(restoreReadyTimer);
      restoreReadyTimer = null;
    }
    document.body.classList.remove('cat-controls-restore-ready');
    const currentPopup = map._popup;
    const popupToKeep = isShopPopup(currentPopup) &&
      (!currentPopup.isOpen || currentPopup.isOpen()) ? currentPopup : null;
    const popupSource = popupToKeep && popupToKeep._source;
    const previousClosePopupOnClick = map.options.closePopupOnClick;
    if (popupToKeep) {
      keepingPopupDuringRestore = true;
      map.options.closePopupOnClick = false;
    }
    if (revealMotionTimer) {
      clearTimeout(revealMotionTimer);
      revealMotionTimer = null;
    }
    document.body.classList.remove('cat-controls-revealing');
    document.body.classList.add('cat-controls-restoring');
    document.body.classList.remove('cat-controls-hidden');
    resetDragState();
    panOpenShopPopupAboveCategories();

    // PCのクリックとスマホのタッチでは後続イベントの順序が異なる。
    // どちらかの経路が同じ操作を地図クリックとして処理しても、押下時に開いていた
    // 店舗ポップアップを保持する。再表示時はpopupopenによるカテゴリー自動収納を抑える。
    if (popupToKeep && popupSource && popupSource.openPopup) {
      function keepPopupOpen() {
        if (map._popup !== popupToKeep || (popupToKeep.isOpen && !popupToKeep.isOpen())) {
          popupSource.openPopup();
        }
      }
      setTimeout(keepPopupOpen, 0);
      setTimeout(keepPopupOpen, 80);
      setTimeout(function() {
        keepPopupOpen();
        keepingPopupDuringRestore = false;
        map.options.closePopupOnClick = previousClosePopupOnClick;
      }, 240);
    }

    // カテゴリボタンが見た目上そろうopacity遷移の完了直後に下矢印を表示する。
    // transitionendが発火しない場合にも表示されるよう、同じ時間のタイマーを併用する。
    const labelWrapper = document.getElementById('catLabelWrapper');
    let revealCompleted = false;
    function revealHideButton() {
      if (revealCompleted) return;
      revealCompleted = true;
      if (restoreRevealTimer) {
        clearTimeout(restoreRevealTimer);
        restoreRevealTimer = null;
      }
      if (labelWrapper) labelWrapper.removeEventListener('transitionend', onRestoreTransitionEnd);
      document.body.classList.add('cat-controls-revealing');
      document.body.classList.remove('cat-controls-restoring');
      revealMotionTimer = setTimeout(function () {
        document.body.classList.remove('cat-controls-revealing');
        revealMotionTimer = null;
      }, 460);
    }
    function onRestoreTransitionEnd(e) {
      if (e.propertyName === 'opacity') revealHideButton();
    }
    if (labelWrapper) labelWrapper.addEventListener('transitionend', onRestoreTransitionEnd);
    restoreRevealTimer = setTimeout(revealHideButton, RESTORE_REVEAL_DELAY + 80);
  }

  map.on('popupclose', function(e) {
    if (categoryPopupPan === e.popup && !keepingPopupDuringRestore) {
      restoreCategoryPopupPan();
    }
  });

  function setDragOffset(y) {
    const clamped = Math.max(0, Math.min(MAX_DRAG, y));
    const opacity = Math.max(0.08, 1 - clamped / MAX_DRAG);
    document.body.style.setProperty('--cat-controls-drag-y', clamped + 'px');
    document.body.style.setProperty('--cat-controls-drag-opacity', String(opacity));
  }

  function resetDragState() {
    draggingControls = false;
    // cat-controls-draggingクラスの除去とカスタムプロパティの除去を同じ
    // タイミングで行うと、端末（特にiOS Safari）によってはtransition
    // （戻り速度用の1.05s/.82s）が発火せず、一瞬で元の位置に戻ってしまう
    // ことがあるため、二重rAFで1フレーム分ずらしてから最終状態にする。
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.remove('cat-controls-dragging');
        document.body.style.removeProperty('--cat-controls-drag-y');
        document.body.style.removeProperty('--cat-controls-drag-opacity');
      });
    });
  }

  function finishDragToHidden() {
    draggingControls = false;
    document.body.classList.remove('cat-controls-dragging');
    hideCategoryControls();
    setTimeout(function () {
      document.body.style.removeProperty('--cat-controls-drag-y');
      document.body.style.removeProperty('--cat-controls-drag-opacity');
    }, 1100);
  }

  if (supportsTouch) {
  // capture フェーズで登録：#catLabelBar 内のタッチスクロール用ハンドラが
  // touchstart で stopPropagation() するため、bubble フェーズだと
  // チップ（食事処 等）タップ時にこのハンドラまでイベントが届かない。
  // capture は伝播の最上流で発火するため、子要素側の stopPropagation の影響を受けない。
  mapEl.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    if (e.target.closest('.leaflet-popup, a, button, .cat-selectall-row, .cat-label-wrapper, .bottom-tabs')) {
      ignoreGesture = true;
      return;
    }
    ignoreGesture = false;
    if (!isMapView() || document.body.classList.contains('cat-controls-hidden')) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    minY = startY;
    latestDx = 0;
    latestDy = 0;
    draggingControls = false;
  }, { passive: true, capture: true });

  mapEl.addEventListener('touchmove', function (e) {
    if (e.touches.length !== 1) return;
    if (ignoreGesture) return;
    if (!isMapView() || document.body.classList.contains('cat-controls-hidden')) return;
    if (!hasVisibleCategoryControls()) return;

    const currentY = e.touches[0].clientY;
    minY = Math.min(minY, currentY);
    latestDx = e.touches[0].clientX - startX;
    latestDy = currentY - minY;

    if (latestDy > 8 && Math.abs(latestDx) < 110) {
      draggingControls = true;
      document.body.classList.add('cat-controls-dragging');
      setDragOffset(latestDy);
    } else if (draggingControls && latestDy <= 0) {
      resetDragState();
    }
  }, { passive: true });

  mapEl.addEventListener('touchend', function (e) {
    if (ignoreGesture) { ignoreGesture = false; return; }
    if (!isMapView() || e.changedTouches.length !== 1) return;
    if (document.body.classList.contains('cat-controls-hidden')) return;

    const dx = e.changedTouches[0].clientX - startX;
    const currentY = e.changedTouches[0].clientY;
    const dy = currentY - Math.min(minY, currentY);
    const shouldHide = (draggingControls || dy > 18) && dy > HIDE_THRESHOLD && Math.abs(dx) < 110;

    if (shouldHide) {
      finishDragToHidden();
    } else {
      resetDragState();
    }
  }, { passive: true });

  restoreBtn.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    restoreStartY = e.touches[0].clientY;
  }, { passive: true });
  restoreBtn.addEventListener('touchend', function (e) {
    if (e.changedTouches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    const dy = e.changedTouches[0].clientY - restoreStartY;
    // タップ、または従来どおりの上スワイプで表示する。touchendで直接処理し、
    // 後から生成されるclickが地図へ届く経路をなくす。
    if (Math.abs(dy) < 12 || dy < -20) showCategoryControls();
  }, { passive: false });
  }

  ['pointerdown', 'pointerup', 'mousedown', 'mouseup'].forEach(function(type) {
    restoreBtn.addEventListener(type, function(e) {
      e.stopPropagation();
    });
  });

  // 幅の狭いPCブラウザーでも表示された矢印を操作できるよう、
  // クリック処理はタッチ対応の有無にかかわらず登録する。
  restoreBtn.addEventListener('click', function(e) {
    // 上矢印のクリックが地図へ伝わると、背景クリック扱いで店舗ポップアップが
    // 閉じてしまうため、ボタン自身でイベントを止めてからカテゴリーを表示する。
    e.preventDefault();
    e.stopPropagation();
    showCategoryControls();
  });
  if (hideBtn) hideBtn.addEventListener('click', hideCategoryControls);
})();

// ── ページ表示時、bfcache復元による意図しない畳み状態を解消 ────────────
// スマホブラウザのbfcache復元で前回の折りたたみ状態が残るのを防ぐ。
// pageshow は通常の読み込みでもキャッシュ復元でも発火する
// ただし以下の場合はヘッダーを畳んだままにする：
// ・?shop=N 指定時（店舗詳細ページからの復帰、ポップアップを広く見せるため）
// ・このタブで既にヘッダーを表示済み（サイト初回起動時のみ自動表示するため）
window.addEventListener('pageshow', function () {
  if (_initialShop || _headerAlreadyShown) {
    setTimeout(function () { map.invalidateSize(); }, 50);
    return;
  }
  document.body.classList.remove('header-collapsed');
  var h = document.querySelector('header');
  if (h) h.style.display = '';
  setTimeout(function () { map.invalidateSize(); }, 50);
});

// ── 今日の石川ニュースバナー：ボタン押下でニュースページへ／×で閉じる ──
(function() {
  var banner = document.getElementById('newsBanner');

  // 表示制御：サイトを最初に開いたときだけ表示する。
  // 他のページ（ニュース・店舗詳細等）へ行って戻ってきたときは表示しない。
  // sessionStorage はタブを閉じるまで保持されるため「同一タブでの再訪」を判定できる
  // 表示済み状態を即座に隠す（アニメーションなし）。
  // フェード用のtransitionは「今まさに表示中のものを閉じる」操作専用で、
  // ページ読込直後の「最初から隠す」処理に使うと、CSSの初期opacity(1)から
  // 一瞬表示されたあとフェードして消える、という誤動作になるため無効化する
  function hideBannerInstant() {
    if (!banner) return;
    banner.style.transition = 'none';
    banner.classList.add('hidden');
  }

  if (banner) {
    if (sessionStorage.getItem('newsBannerShown') === '1') {
      hideBannerInstant();
    } else {
      sessionStorage.setItem('newsBannerShown', '1');
    }
  }
  // ブラウザの「戻る」でキャッシュ復元されたときはスクリプトが再実行されないため
  // pageshow で明示的に隠す（この場合もアニメーションなしでよい）
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) hideBannerInstant();
  });

  // ニュースボタン → news/index.html へ遷移
  var newsBtn = document.getElementById('newsBannerBtn');
  if (newsBtn) {
    newsBtn.addEventListener('click', function() {
      window.location.href = 'news/index.html';
    });
  }
  // ×ボタン（両側）→ バナーを非表示
  document.querySelectorAll('[data-news-close]').forEach(function(closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (banner) banner.classList.add('hidden');
    });
  });

  // ── バナー以外の操作（他ボタン押下・地図の拡大縮小・スクロール）で自動的に非表示 ──
  // ニュースに興味がない人が、×を押さなくても他の操作をするだけで消えるようにする
  if (!banner) return;

  function hideBanner() {
    if (window._suppressHeaderCollapse) return; // 読込直後のプログラムによる自動ズームは無視
    banner.classList.add('hidden');
  }

  // 地図の拡大縮小・ドラッグスクロール（+/-ボタン・ピンチ・ホイールも dragstart/zoomstart 経由で拾える）
  map.on('dragstart', hideBanner);
  map.on('zoomstart', hideBanner);

  // バナー以外の場所へのクリック/タップ（他のボタン・チップ・地図上のピン等）
  document.addEventListener('click', function(e) {
    if (banner.classList.contains('hidden')) return;
    if (e.target.closest('#newsBanner')) return; // バナー自身の操作は専用ハンドラに任せる
    // パスワード認証画面がまだ表示中の場合、その操作（入力欄・確認ボタン等）は
    // 地図への操作ではないので無視する（無視しないと地図を見る前にバナーが消えてしまう）
    var pwOverlay = document.getElementById('passwordOverlay');
    if (pwOverlay && !pwOverlay.classList.contains('hidden')) return;
    hideBanner();
  }, true);
})();

// ── ポップアップ誤タップ防止：開いた直後 500ms はコンテンツを無効化 ───────
// 理由：アイコンを押している指がそのままポップアップ上に乗り、
//       離した瞬間にボタン類が反応してしまう現象を防ぐ。
// ※ .popup-close-side には CSS で pointer-events:auto を指定しているため
//    この 500ms ブロック中でも × ボタンは有効のまま。
map.on('popupopen', function(e) {
  if (e.popup._source && e.popup._source._isLocationMarker) return;
  setTimeout(function() {
    var popupEl = e.popup.getElement();
    if (!popupEl) return;
    var wrap = popupEl.querySelector('.leaflet-popup-content-wrapper');
    if (!wrap) return;
    wrap.style.pointerEvents = 'none';        // タッチ・クリックを一時ブロック
    wrap.style.userSelect   = 'none';
    setTimeout(function() {
      wrap.style.pointerEvents = '';           // 500ms 後に解除
      wrap.style.userSelect   = '';
    }, 500);

    // × ボタンに直接 touchend を付けてポップアップを閉じる（二重保険）。
    // ボタン上からスワイプした場合は閉じず、下の境界ジェスチャー制御へ渡す。
    var closeBtns = popupEl.querySelectorAll('.popup-close-side');
    closeBtns.forEach(function(btn) {
      var sx = 0, sy = 0, moved = false;
      btn.addEventListener('touchstart', function(ev) {
        if (ev.touches.length !== 1) { moved = true; return; }
        sx = ev.touches[0].clientX;
        sy = ev.touches[0].clientY;
        moved = false;
      }, { passive: true });
      btn.addEventListener('touchmove', function(ev) {
        if (Math.abs(ev.touches[0].clientX - sx) > 10 ||
            Math.abs(ev.touches[0].clientY - sy) > 10) moved = true;
      }, { passive: true });
      btn.addEventListener('touchend', function(ev) {
        if (moved) return;
        ev.preventDefault();
        ev.stopPropagation();
        map.closePopup();
      }, { passive: false });
    });

    // ── リンクボタン（Googleマップ・店舗詳細）は touchend で直接遷移 ──
    // ブラウザの合成クリック頼みだと、自動パン等でポップアップが動いた際に
    // クリックが成立せず「押しても遷移しない」ことがあるため。
    popupEl.querySelectorAll('a.popup-btn').forEach(function(a) {
      var sx = 0, sy = 0, moved = false;
      a.addEventListener('touchstart', function(ev) {
        if (ev.touches.length !== 1) { moved = true; return; }
        sx = ev.touches[0].clientX;
        sy = ev.touches[0].clientY;
        moved = false;
      }, { passive: true });
      a.addEventListener('touchmove', function(ev) {
        if (Math.abs(ev.touches[0].clientX - sx) > 10 ||
            Math.abs(ev.touches[0].clientY - sy) > 10) moved = true;
      }, { passive: true });
      a.addEventListener('touchend', function(ev) {
        if (moved) return; // スクロール操作は遷移しない
        ev.preventDefault();   // 合成クリックとの二重遷移を防止
        ev.stopPropagation();
        if (a.getAttribute('target') === '_blank') {
          window.open(a.href, '_blank', 'noopener');
        } else {
          window.location.href = a.href;
        }
      }, { passive: false });
    });
  }, 0);
});

// popupclose: _isReopening チェックのみ（位置復元は廃止）
map.on('popupclose', function() {
  // _isReopening フラグは内部close-reopen中のみ使用（現在は参照なし）
});

// ── ポップアップ上のPC操作（マウスドラッグ・ホイール）を地図に伝える ──────
map.on('popupopen', function(e) {
  const popupEl = e.popup.getElement();
  if (!popupEl) return;

  // ── スマホ：ポップアップ内部スクロールと地図パンの境界制御 ──────────────
  // Leaflet の disableClickPropagation が touchstart のバブルを止めるため、
  // ポップアップ上から地図を動かす場合だけ、ここで手動 panBy を行う。
  // 縦長ポップアップの途中ではネイティブの内部スクロールを優先する。上端・下端
  // から外向きに始まったジェスチャーは地図へ渡し、内部スクロール中に端へ達した
  // 場合も、端の先へ一定距離引いた時点で初めて地図パンへ切り替える。
  var _mc = map.getContainer();
  var _pw = popupEl.querySelector('.leaflet-popup-content-wrapper');
  var _ps = popupEl.querySelector('.leaflet-popup-content');
  var _startTX = 0, _startTY = 0, _lTX = 0, _lTY = 0;
  var _gestureMode = 'idle'; // idle | pending | popup-scroll | map-pan
  var _tActive = false;
  var _startedOnInteractive = false;
  var _edgeDirection = 0; // -1: 下端から上へ、1: 上端から下へ
  var _edgeDistance = 0;
  var _lockedScrollTop = null;
  var SCROLL_EDGE_EPSILON = 2;
  var DRAG_THRESHOLD = 4;
  var INTERACTIVE_DRAG_THRESHOLD = 10;
  var EDGE_HANDOFF_THRESHOLD = 18;

  function getScrollState() {
    var max = _ps ? Math.max(0, _ps.scrollHeight - _ps.clientHeight) : 0;
    var rawTop = _ps ? Number(_ps.scrollTop) : 0;
    if (!Number.isFinite(rawTop)) rawTop = 0;
    // iOS Safariのラバーバンド中は負値や最大値超過を返すことがあるため、
    // 判定用の値だけ0〜maxへ正規化する（実際のスクロール位置はここで変えない）。
    var top = Math.min(max, Math.max(0, rawTop));
    var scrollable = max > SCROLL_EDGE_EPSILON;
    return {
      top: top,
      max: max,
      scrollable: scrollable,
      atTop: !scrollable || top <= SCROLL_EDGE_EPSILON,
      atBottom: !scrollable || top >= max - SCROLL_EDGE_EPSILON
    };
  }

  function resetEdgeHandoff() {
    _edgeDirection = 0;
    _edgeDistance = 0;
    _lockedScrollTop = null;
  }

  function onWrapTouchStart(te) {
    if (te.touches.length !== 1) return;
    _tActive   = true;
    _startedOnInteractive = !!te.target.closest('a, button, .popup-close-side');
    _startTX = _lTX = te.touches[0].clientX;
    _startTY = _lTY = te.touches[0].clientY;
    _gestureMode = 'pending';
    resetEdgeHandoff();
    // Leaflet のドラッグが干渉しないよう一時無効化
    map.dragging.disable();
  }
  function onWrapTouchMove(te) {
    if (!_tActive || te.touches.length !== 1) return;
    var x = te.touches[0].clientX;
    var y = te.touches[0].clientY;
    var totalDx = x - _startTX;
    var totalDy = y - _startTY;
    var stepDx = x - _lTX;
    var stepDy = y - _lTY;

    if (_gestureMode === 'pending') {
      // リンク・ボタン上はタップとの区別を確実にするため、既存の誤タップ防止と
      // 同じ10pxを超えるまでジェスチャーとして確定しない。
      var threshold = _startedOnInteractive ? INTERACTIVE_DRAG_THRESHOLD : DRAG_THRESHOLD;
      if (Math.max(Math.abs(totalDx), Math.abs(totalDy)) <= threshold) return;

      // touchstart時のスナップショットではなく、方向が確定した時点の実値で判定する。
      // これによりSafariの慣性スクロールの停止・端での小数値の戻りを取り込む。
      var scrollState = getScrollState();
      var isVertical = Math.abs(totalDy) >= Math.abs(totalDx);
      var canScrollDown = totalDy < 0 &&
        scrollState.scrollable && !scrollState.atBottom;
      var canScrollUp = totalDy > 0 &&
        scrollState.scrollable && !scrollState.atTop;
      _gestureMode = isVertical && (canScrollDown || canScrollUp)
        ? 'popup-scroll'
        : 'map-pan';
      if (_gestureMode === 'map-pan' && isVertical) {
        if (totalDy < 0 && scrollState.atBottom) _lockedScrollTop = scrollState.max;
        if (totalDy > 0 && scrollState.atTop) _lockedScrollTop = 0;
      }
    }

    if (_gestureMode === 'popup-scroll') {
      var liveState = getScrollState();
      var outwardDirection = liveState.atBottom && stepDy < 0 ? -1
        : liveState.atTop && stepDy > 0 ? 1 : 0;

      if (outwardDirection) {
        if (_edgeDirection !== outwardDirection) {
          _edgeDirection = outwardDirection;
          _edgeDistance = 0;
        }
        _edgeDistance += Math.abs(stepDy);
      } else {
        resetEdgeHandoff();
      }

      if (_edgeDistance >= EDGE_HANDOFF_THRESHOLD) {
        // 内容が端に達してからさらに18px引かれた場合だけ切り替える。
        // 端へ到達するまで地図は一切動かないため、元の同時移動は再発しない。
        _gestureMode = 'map-pan';
        _lockedScrollTop = _edgeDirection < 0 ? liveState.max : 0;
        if (_ps) _ps.scrollTop = _lockedScrollTop;
        if (te.cancelable) te.preventDefault();
        te.stopPropagation();
        _lTX = x;
        _lTY = y;
        return;
      }

      // preventDefault は呼ばず、overflow-y:auto のネイティブスクロールを許可する。
      // 地図側へは伝播させないため、端へ達するまでは地図が同時に動かない。
      te.stopPropagation();
      _lTX = x;
      _lTY = y;
      return;
    }

    if (_gestureMode !== 'map-pan') return;
    if (te.cancelable) te.preventDefault(); // 端でのSafariのバウンスと内部スクロールを止める
    te.stopPropagation();
    // Safariがラバーバンド値を保持していても、地図パン中は境界へ固定する。
    if (_ps && _lockedScrollTop !== null) _ps.scrollTop = _lockedScrollTop;
    var dx = stepDx;
    var dy = stepDy;
    _lTX = x;
    _lTY = y;
    map.panBy([-dx, -dy], { animate: false });
  }
  function onWrapTouchEnd() {
    if (!_tActive) return;
    _tActive = false;
    _gestureMode = 'idle';
    resetEdgeHandoff();
    map.dragging.enable();
  }
  if (_pw) {
    _pw.addEventListener('touchstart', onWrapTouchStart, { passive: true });
    _pw.addEventListener('touchmove',  onWrapTouchMove,  { passive: false });
    // リンク側のtouchendがstopPropagationしても必ずドラッグを復元できるようcaptureで受ける。
    _pw.addEventListener('touchend',   onWrapTouchEnd,   { capture: true, passive: true });
    _pw.addEventListener('touchcancel',onWrapTouchEnd,   { capture: true, passive: true });
  }

  // ── PC：マウスでポップアップをつかんで地図をパン ─────────────
  let isDragging = false;
  let lastMouseX = 0, lastMouseY = 0;

  function onMouseDown(me) {
    // ×ボタン・リンク・ボタンはクリック動作を維持
    if (me.target.closest('a, button, .leaflet-popup-close-button')) return;
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

  // ポップアップが閉じたらすべてのイベントリスナーを削除し、ドラッグを再有効化
  map.once('popupclose', function() {
    map.dragging.enable(); // 念のため再有効化
    if (_pw) {
      _pw.removeEventListener('touchstart', onWrapTouchStart);
      _pw.removeEventListener('touchmove',  onWrapTouchMove);
      _pw.removeEventListener('touchend',   onWrapTouchEnd, true);
      _pw.removeEventListener('touchcancel',onWrapTouchEnd, true);
    }
    popupEl.removeEventListener('mousedown',  onMouseDown);
    mapContainer.removeEventListener('wheel', onWheelCapture, { capture: true });
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
    popupEl.style.cursor = '';
  });
});

// ── 凡例コントロール ─────────────────────────────────────────────
// CATEGORIESから自動生成（新カテゴリ追加時にここを編集する必要はない）
const legendItems = CATEGORIES.map(c => ({ color: c.color, label: c.label.ja }));

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

// ── フィルターボタン生成（大分類＋小分類の2階層） ──────────────────
function buildFilterButtons() {
  const container = document.getElementById('filterButtons');
  container.innerHTML = ''; // 再描画時にリセット

  const allBtn = document.createElement('button');
  allBtn.className   = 'filter-btn' + (currentMacro === 'all' ? ' active' : '');
  allBtn.textContent = t('filter.all');
  allBtn.style.setProperty('--fc', '#546e7a');
  allBtn.setAttribute('data-filter', 'all');
  allBtn.addEventListener('click', () => applyFilter('all'));
  container.appendChild(allBtn);

  CATEGORIES.forEach(c => {
    if (c.sidebarHidden) return; // コンビニ・ガソリンはサイドバー非表示（歯車メニュー専用）
    const btn = document.createElement('button');
    btn.className   = 'filter-btn' + (c.key === currentMacro ? ' active' : '');
    btn.textContent = t('filter.' + c.key); // 翻訳対応
    btn.style.setProperty('--fc', c.color);
    btn.setAttribute('data-filter', c.key);
    btn.addEventListener('click', () => applyFilter(c.key));
    container.appendChild(btn);
  });

  buildSubFilterButtons();
}

// ── 小分類ボタン生成（選択中の大分類が sub を持つ場合のみ表示） ──────
function buildSubFilterButtons() {
  const subContainer = document.getElementById('filterSubButtons');
  if (!subContainer) return;
  subContainer.innerHTML = '';

  const macro = currentMacro !== 'all' ? CATEGORIES.find(c => c.key === currentMacro) : null;
  if (!macro || !macro.sub || !macro.sub.length) {
    subContainer.style.display = 'none';
    return;
  }
  subContainer.style.display = '';

  const allSubBtn = document.createElement('button');
  allSubBtn.className   = 'filter-btn filter-sub-btn' + (!currentSub ? ' active' : '');
  allSubBtn.textContent = t('filter.all');
  allSubBtn.style.setProperty('--fc', macro.color);
  allSubBtn.addEventListener('click', () => applyFilter(currentMacro, null));
  subContainer.appendChild(allSubBtn);

  macro.sub.forEach(s => {
    const btn = document.createElement('button');
    btn.className   = 'filter-btn filter-sub-btn' + (s.key === currentSub ? ' active' : '');
    btn.textContent = t('filter.' + s.key);
    btn.style.setProperty('--fc', macro.color);
    btn.addEventListener('click', () => applyFilter(currentMacro, s.key));
    subContainer.appendChild(btn);
  });
}

// ── プレビュー環境判定 ───────────────────────────────────────────
// localhost / 127.0.0.1 / file://（hostname空文字）、または ?preview=1 付きなら
// プレビュー環境とみなす（公開環境ではstatusが"published"以外の店舗を隠すため）
function isPreviewEnv() {
  var isLocal = ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1;
  var hasPreviewParam = new URLSearchParams(location.search).get('preview') === '1';
  return isLocal || hasPreviewParam;
}

// ── statusに基づく表示判定 ───────────────────────────────────────
// status未指定 or "published" → 常に表示。それ以外（"test"等）はプレビュー環境限定。
// ※restaurants配列自体は一切変更せず、表示可否だけをここで判定する。
function isStatusVisible(r) {
  if (!r.status || r.status === 'published') return true;
  return isPreviewEnv();
}

// ── 表示判定（フィルター＋検索の両方を満たすか） ────────────────
function isVisible(r) {
  if (!isStatusVisible(r)) return false;
  // alwaysShow フラグがある店舗はフィルターに関わらず常時表示
  if (!r.alwaysShow) {
    const macro = macroOf(r.genre);
    if (currentMacro !== 'all' && macro.key !== currentMacro) return false;
    if (currentMacro === 'all' && macro.sidebarHidden) return false;
    if (currentMacro !== 'all' && currentSub) {
      const subDef = macro.sub && macro.sub.find(s => s.key === currentSub);
      if (subDef && !subDef.match(r.genre)) return false;
    }
  }
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

// ── フィルター適用（大分類＋任意で小分類） ─────────────────────────
function applyFilter(macroKey, subKey) {
  currentMacro = macroKey;
  currentSub   = subKey || null;

  // カテゴリラベルバーラッパーを非表示（通常モードに戻るため）
  var catWrapper = document.getElementById('catLabelWrapper');
  if (catWrapper) catWrapper.style.display = 'none';
  var catSelectAllRow = document.getElementById('catSelectAllRow');
  if (catSelectAllRow) catSelectAllRow.style.display = 'none';

  buildFilterButtons(); // 大分類・小分類ボタンの選択状態を再描画

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
  shopCount.textContent = t('count.results', { n: visible.length });

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
        <span class="shop-item-genre" style="background:${genreColor_}22;color:${genreColor_}">${rGenre(r)}</span>
        <div class="shop-item-info">
          <span class="shop-item-hours" title="${rHours(r).replace(/\n/g, ' / ')}">${fmtHours(rHours(r))}</span>
          <span class="shop-item-closed">${t('list.closed')}${rClosed(r)}</span>
        </div>
      </div>`;
  }).join('');
}

// ── 店舗フォーカス（リスト→地図） ───────────────────────────────
// instant=true の場合はアニメーションなしで即座に表示を切り替える
// （店舗詳細ページからの復帰時：広域表示を経由するカクカクした動きを避けるため）
function focusShop(id, instant) {
  const data = markersData.find(function (d) { return d.restaurant.id === id; });
  if (!data) return;

  switchTab('map');
  setActiveItem(id);

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

    if (instant) {
      // 即座に切り替え（アニメーションなし）→ すぐポップアップを開く
      map.setView(newCenter, targetZoom, { animate: false });
      focusShop._fromSidebar = true;
      data.marker.openPopup();
      focusShop._fromSidebar = false;
    } else {
      // スムーズなアニメーションで移動
      map.flyTo(newCenter, targetZoom, { duration: 0.8 });

      // アニメーション完了後にポップアップを開く（重複防止）
      focusShop._onMoveEnd = function() {
        focusShop._fromSidebar = true;  // サイドバーから開いたフラグON
        data.marker.openPopup();
        focusShop._fromSidebar = false; // フラグOFF
      };
      map.once('moveend', focusShop._onMoveEnd);
    }
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

// ── 下部「地図」タブ押下時の処理 ────────────────────────────────
// カテゴリパネル（ピンボタン経由）表示中に押された場合は、選択内容を確定して
// パネルを閉じる（旧「閉じる」ボタンの役割）。それ以外は通常のタブ切替のみ。
function handleMapTabClick() {
  if (window._categoryPanelOpenViaPin && window._categoryPanelOpenViaPin()) {
    window._closeCategoryPanelFromMapTab();
  }
  switchTab('map');
}

// ── タブ切り替え（スマホ） ───────────────────────────────────────
function switchTab(tab) {
  const appBody = document.getElementById('appBody');
  appBody.dataset.view = tab;
  document.body.classList.toggle('list-open', tab === 'list');
  if (tab !== 'info') document.body.classList.remove('info-open');
  if (tab !== 'map') document.body.classList.remove('cat-controls-hidden');

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

  // 一覧画面では「店名を表示/隠す」ボタンは無関係なため非表示に
  // （#bottomTabsは.app-bodyの外にあるためCSSのdata-view属性セレクタが
  //   届かず、ここでJSから直接切り替える）
  const bLabel = document.getElementById('bottomLabelBtn');
  if (bLabel) bLabel.style.visibility = (tab === 'list') ? 'hidden' : '';

  if (tab === 'map') {
    setTimeout(() => map.invalidateSize(), 50);
  }
}

// ── 店名ラベルトグル（ボトムバーから呼び出し） ──────────────────
// 文字は常に「店名」固定。表示中は地図・一覧タブと同じ配色（赤塗り・白文字）に、
// 非表示中は白背景・グレー文字に切り替える
function hasAnyVisibleMarker() {
  return markersData.some(function (d) { return map.hasLayer(d.marker); });
}
// 表示中の店舗ピンの有無に応じて「店名」ボタン・案内ポップの状態を同期する。
// カテゴリ選択の変更経路が複数あるため（チップバー・カテゴリパネル等）、
// マーカー表示を更新するタイミングで都度呼び出す想定
function syncLabelBtnWithMarkers() {
  var hideBtn = document.getElementById('catControlsHideBtn');
  if (hasAnyVisibleMarker()) {
    // 店舗ピンが表示されたら「店舗を選択してください」ポップは不要なので閉じる
    hideNoShopNotice();
    if (hideBtn) hideBtn.style.display = '';
    return;
  }
  labelsVisible = false;
  map.getContainer().classList.add('labels-hidden');
  var btn = document.getElementById('bottomLabelBtn');
  if (btn) btn.classList.remove('active');
  // 隠すボタン類が既に非表示（表示するものが無い）なので、下矢印自体も出さない
  if (hideBtn) hideBtn.style.display = 'none';
}
function showNoShopNotice() {
  var el = document.getElementById('noShopNotice');
  if (el) el.classList.remove('hidden');
}
function hideNoShopNotice() {
  var el = document.getElementById('noShopNotice');
  if (el) el.classList.add('hidden');
}
document.querySelectorAll('[data-noshop-close]').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    hideNoShopNotice();
  });
});

// ── 情報の正確性についてのポップアップ（ヘッダー「詳細」ボタン） ──────────
// 開くときは即座にパッと表示し、閉じるときだけCSSのopacity 3sフェードを効かせる
// （閉じる用のtransitionが開く動作にも適用されてしまわないよう、開く瞬間だけ
//   一時的にtransition:noneにし、表示が確定してから元に戻す）
// ※ .hiddenはopacity:0のみでdisplay:noneにしていないため、×ボタン・リンクは
//   pointer-events:autoのまま画面中央（z-index:2000）に残り続け、閉じた後も
//   他のUI（ニュースバナーの×・店舗ポップアップの×等）へのタップを透明に
//   奪ってしまう不具合があった。フェード完了後にdisplay:noneも適用して防ぐ。
var accuracyHideTimer = null;
function openAccuracyPopup() {
  var el = document.getElementById('accuracyPopup');
  if (!el) return;
  if (accuracyHideTimer) { clearTimeout(accuracyHideTimer); accuracyHideTimer = null; }
  el.style.display = '';
  el.style.transition = 'none';
  el.classList.remove('hidden');
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      el.style.transition = '';
    });
  });
}
function closeAccuracyPopup() {
  var el = document.getElementById('accuracyPopup');
  if (!el) return;
  el.classList.add('hidden');
  if (accuracyHideTimer) clearTimeout(accuracyHideTimer);
  accuracyHideTimer = setTimeout(function () {
    el.style.display = 'none';
    accuracyHideTimer = null;
  }, 3000); // CSSのopacity 3sフェード（.accuracy-popup）に合わせる
}
(function () {
  var popup = document.getElementById('accuracyPopup');
  if (!popup) return;
  // ポップアップ表示中は、×ボタン・リンク以外のどこを触っても閉じる
  // （ポップアップの上を触って地図を動かした場合も含む）。
  // ポップアップ本体はpointer-events:noneで地図へタッチを通しているため、
  // ×ボタン・リンク以外を触るとe.targetは常に地図側になる＝閉じてよい。
  // ×ボタン・リンクだけpointer-events:autoにしてあるので、そこを触った
  // ときだけe.targetが正しくその要素になり、この判定で除外できる。
  function isClosingTap(e) {
    if (popup.classList.contains('hidden')) return false;
    if (e.target.closest && e.target.closest('.accuracy-popup-close, .accuracy-popup-link')) return false;
    return true;
  }
  var suppressNextClick = false;
  document.addEventListener('pointerdown', function (e) {
    if (!isClosingTap(e)) return;
    // ポップアップを閉じるためのタップは、pointer-events:noneにより
    // 背後の地図・店舗マーカーへのタップとしても扱われてしまい、
    // 意図せず店舗の詳細ポップアップが開いてしまう不具合があった。
    // ドラッグ（地図を動かす操作）の場合、指を動かすとブラウザは合成clickを
    // 発生させないためこのガードの影響を受けない。タップの場合だけ、
    // 続く合成clickイベントを1回だけ握りつぶして背後への反応を防ぐ。
    suppressNextClick = true;
    setTimeout(function () { suppressNextClick = false; }, 400); // clickが来なかった場合の保険
    // スマホの店舗マーカーはclickイベントを使わず、touchendを直接見る自前の
    // タップ判定（setupTap内）でポップアップを開くため、上のclick抑制だけでは
    // 効かない。setupTap側と共有するフラグで直接連携し、touchend側で
    // ポップアップを開く処理自体を打ち切ってもらう。
    // ※ pointerdownはtouchstartより必ず先に発火するため、ここで
    //   closeAccuracyPopup()する前（＝popupがまだ閉じる前）に判定した
    //   isClosingTap(e)の結果をそのまま使う。touchstart側で改めて
    //   isClosingTap()を判定すると、その時点では既にpointerdownで
    //   popupが閉じられた後になっており、正しく判定できない。
    window._suppressAccuracyPopupTap = true;
    setTimeout(function () { window._suppressAccuracyPopupTap = false; }, 400);
    closeAccuracyPopup();
  }, true);
  document.addEventListener('click', function (e) {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  document.addEventListener('wheel', function () {
    if (!popup.classList.contains('hidden')) closeAccuracyPopup();
  }, { capture: true, passive: true });
})();
function toggleLabels() {
  // 表示中の店舗ピンが1件も無いときは、ボタンの見た目は変えずに
  // 「店舗を指定してください」ポップを地図中央に出すだけにする
  if (!hasAnyVisibleMarker()) {
    showNoShopNotice();
    return;
  }
  labelsVisible = !labelsVisible;
  map.getContainer().classList.toggle('labels-hidden', !labelsVisible);
  const btn = document.getElementById('bottomLabelBtn');
  if (btn) btn.classList.toggle('active', labelsVisible);
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

// ── 店舗詳細ページからの遷移先タブ指定（?tab=map / ?tab=list）────────
// ?shop=N があれば、その店舗のピンを開いた状態（詳細ボタン押下時と同じ表示）に戻す
(function () {
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');
  const shop = params.get('shop');
  if (shop !== null && !isNaN(parseInt(shop, 10))) {
    focusShop(parseInt(shop, 10), true);
  } else if (tab === 'map' || tab === 'list') {
    switchTab(tab);
  }
})();

// ── スマホ：ダブルタップ＋ドラッグでズーム（グーグルマップ方式）──
// ドラッグ開始時にタイルをキャンバスへスナップショット → キャンバスをCSSスケール
// タイル再読み込みが一切発生しないのでグレー化ゼロ
// 指を離したときにキャンバスを破棄して setZoomAround を1回だけ呼ぶ
(function() {
  const mapEl         = map.getContainer();
  const DOUBLE_TAP_MS = 300;
  const PX_PER_ZOOM   = 100;

  let lastTapTime       = 0;
  let dragging          = false;
  let startY            = 0;
  let startZoom         = 0;
  let tapPoint          = null;   // ダブルタップ位置（純粋ダブルタップ時のズーム中心）
  let mapCenter         = null;   // ドラッグ開始時の地図中心（ドラッグズーム時の中心）
  let lastDy            = 0;
  let _rafId            = null;

  // ── ダブルタップ＋ドラッグズーム
  // ・純粋ダブルタップ   → タップ位置を中心に +1ズーム
  // ・ダブルタップ＋ドラッグ → 地図の中心位置を固定したまま拡大縮小
  // ジェスチャー中は zoomanim イベントで CSS transform のみ（タイル再読み込みなし）

  mapEl.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) { dragging = false; return; }

    // ポップアップ内・ボタン・リンク上のタップはダブルタップズームの対象外
    // （ボタン連打が preventDefault で潰されて遷移しない問題を防ぐ）
    if (e.target.closest('.leaflet-popup, a, button')) {
      dragging = false;
      lastTapTime = 0;
      return;
    }

    const now   = Date.now();
    const touch = e.touches[0];

    if (now - lastTapTime < DOUBLE_TAP_MS && !dragging) {
      dragging   = true;
      startY     = touch.clientY;
      lastDy     = 0;
      startZoom  = map.getZoom();
      mapCenter  = map.getCenter(); // ドラッグ中は地図中心を固定

      // ダブルタップ+ドラッグ中フラグ：マーカーの300msタイマーでポップアップが開くのを防ぐ
      window._dblTapDragActive = true;

      // 拡大縮小操作時はポップアップを閉じる
      map.closePopup();

      const mapRect = mapEl.getBoundingClientRect();
      tapPoint      = map.containerPointToLatLng(
        L.point(touch.clientX - mapRect.left, touch.clientY - mapRect.top)
      );

      map.dragging.disable();
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

    lastDy = e.touches[0].clientY - startY;
    const rawZoom     = startZoom + lastDy / PX_PER_ZOOM;
    const clampedZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), rawZoom));

    if (_rafId === null) {
      _rafId = requestAnimationFrame(function() {
        _rafId = null;
        // 地図の中心を固定したまま zoomanim でタイルを CSS スケール
        map.fire('zoomanim', { center: mapCenter, zoom: clampedZoom });
      });
    }
  }, { passive: false });

  mapEl.addEventListener('touchend', function() {
    if (!dragging) return;
    dragging = false;
    window._dblTapDragActive = false;
    if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }

    map.dragging.enable();

    if (lastDy === 0) {
      // 純粋なダブルタップ → タップ位置を中心に +1ズーム
      map.setView(tapPoint || map.getCenter(), startZoom + 1, { animate: true });
      window._dblTapJustHandled = true;
      setTimeout(function() { window._dblTapJustHandled = false; }, 600);
    } else {
      // ドラッグズーム確定：地図中心を固定したまま整数ズームに確定
      // animate:falseだとzoomanim→setView切り替え時にぴくっとするため短いアニメで滑らかに
      const finalZoom = Math.max(
        map.getMinZoom(),
        Math.min(map.getMaxZoom(), startZoom + lastDy / PX_PER_ZOOM)
      );
      map.setView(mapCenter, Math.round(finalZoom), { animate: true, duration: 0.12 });
    }
  });
})();
applyFilter('all'); // サイドバー・フィルターボタンの初期化
// 初期表示：飲食店に加えてコンビニ・ガソリンも最初から表示する
// （ただしstatusが非公開の店舗はisStatusVisible()で除外する）
markersData.forEach(function({ restaurant: r, marker }) {
  if (!isStatusVisible(r)) return;
  if (!map.hasLayer(marker)) marker.addTo(map);
});
applyLangToDOM();
