/* ================================================================
   うるま市石川 飲食店マップ — script.js
   地図: OpenStreetMap + Leaflet
================================================================ */

// ── 多言語対応 (i18n) ─────────────────────────────────────────────
var _currentLang = 'ja';

var TRANSLATIONS = {
  ja: {
    'header.title':        '石川マップ',
    'header.sub1':         'この情報は不正確な場合もあります。',
    'header.refbtn':       '参照',
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
    'info.about-ishikawa': '石川について',
    'info.faq':            'Q & A',
    'info.feedback':       'ご意見・ご要望',
    'info.today':          '今日の石川ニュース',
    'popup.address':       '住所',
    'popup.hours':         '営業時間',
    'popup.closed':        '定休日',
    'popup.note':          '備考',
    'popup.gmap':          'Googleマップで見る',
    'popup.detail':        '店舗詳細を見る',
    'count.results':       '{n} 件表示中',
    'list.closed':         '定休日：',
    'filter.all':          'すべて',
    'filter.shokuji':      '食事処',
    'filter.izakaya':      '居酒屋等',
    'filter.cafe':         'カフェ',
    'filter.yakiniku':     '焼肉',
    'filter.bar':          'バル',
    'filter.ramen':        'ラーメン',
    'filter.conbini':      'コンビニ',
    'footer.main':         '🌊 うるま市石川 飲食店マップ  |  掲載情報は調査時点のものです',
    'visitor.today':       '本日の訪問者 {n} 人',
    'visitor.total':       '累計訪問者 {n} 人',
  },
  en: {
    'header.title':        'Ishikawa Map',
    'header.sub1':         'Info may be inaccurate.',
    'header.refbtn':       'More info',
    'header.sub2':         'Discover hidden gems in Ishikawa!',
    'wip.text':            'This site is under construction. Some info may be incorrect.',
    'tab.map':             'Map',
    'tab.list':            'List',
    'search.placeholder':  'Search by name, genre, address, hours…',
    'filter.label':        'Filter by genre',
    'btn.showNames':       'Names',
    'bottom.map':          'Map',
    'bottom.list':         'List',
    'gear.back':           'Back',
    'lang.ja':             'Japanese',
    'lang.en':             'English',
    'lang.zh':             'Chinese',
    'lang.back':           'Back',
    'info.about-site':     'About this site',
    'info.about-ishikawa': 'About Ishikawa',
    'info.faq':            'Q & A',
    'info.feedback':       'Feedback',
    'info.today':          'Ishikawa Today',
    'popup.address':       'Address',
    'popup.hours':         'Hours',
    'popup.closed':        'Closed',
    'popup.note':          'Note',
    'popup.gmap':          'Open in Google Maps',
    'popup.detail':        'View Details',
    'count.results':       '{n} results',
    'list.closed':         'Closed: ',
    'filter.all':          'All',
    'filter.shokuji':      'Restaurant',
    'filter.izakaya':      'Izakaya',
    'filter.cafe':         'Café',
    'filter.yakiniku':     'BBQ',
    'filter.bar':          'Bar',
    'filter.ramen':        'Ramen',
    'filter.conbini':      'Convenience Store',
    'footer.main':         '🌊 Ishikawa, Uruma City  |  Info as of survey date',
    'visitor.today':       "Today's visitors: {n}",
    'visitor.total':       'Total visitors: {n}',
  }
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

// 言語を切り替えてUIを再描画
function setLanguage(lang) {
  _currentLang = lang;
  applyLangToDOM();
  // フィルターボタン再描画
  if (typeof buildFilterButtons === 'function') buildFilterButtons();
  // 店舗リスト再描画
  if (typeof renderShopList    === 'function') renderShopList();
  // 開いているポップアップを閉じる（古い言語のまま残らないように）
  if (typeof map !== 'undefined' && map) map.closePopup();
  // 全マーカーのポップアップを新言語で再バインド
  if (typeof markersData !== 'undefined') {
    markersData.forEach(function(d) {
      d.marker.bindPopup(makePopup(d.restaurant, d.idx), { maxWidth: 300, autoPan: false });
    });
  }
}

// ── ジャンル英語マッピング ────────────────────────────────────────
var GENRE_EN = {
  '食事処':                    'Restaurant',
  '居酒屋等':                  'Izakaya',
  'バル（中華・和食・バー）':  'Bar (Chinese/Japanese/Bar)',
  '焼肉':                      'BBQ',
  'カフェ':                    'Café',
  'カフェ・イタリアン':        'Café / Italian',
  'カフェ・バー（ハワイ料理）':'Café / Bar (Hawaiian)',
  'カフェ・パン':              'Café / Bakery',
  'カフェ・八重山そば':        'Café / Yaeyama Soba',
  'ハンバーガー':              'Burger',
  '焼き鳥・居酒屋':            'Yakitori / Izakaya',
  'ラーメン':                  'Ramen',
  'テスト用':                  'Test',
};

// 曜日・共通語句を英語に変換（hours / closed フィールド用）
function translateDays(str) {
  if (!str) return str;
  var d = { 月:'Mon', 火:'Tue', 水:'Wed', 木:'Thu', 金:'Fri', 土:'Sat', 日:'Sun' };
  return str
    // フル曜日名（長いほうから先に）
    .replace(/月曜日/g,'Monday').replace(/火曜日/g,'Tuesday')
    .replace(/水曜日/g,'Wednesday').replace(/木曜日/g,'Thursday')
    .replace(/金曜日/g,'Friday').replace(/土曜日/g,'Saturday')
    .replace(/日曜日/g,'Sunday')
    // 複合: 土・日・祝日 など
    .replace(/土・日・祝日/g,'Sat, Sun & Holidays')
    // 範囲: 月〜金 など
    .replace(/([月火水木金土日])〜([月火水木金土日])/g, function(_,a,b){ return d[a]+'–'+d[b]; })
    // 共通語句
    .replace(/年中無休/g,'Open year-round')
    .replace(/不定休/g,'Irregular')
    .replace(/要確認/g,'Please check')
    .replace(/祝日/g,'Holidays')
    .replace(/翌/g,'(next day) ')
    .replace(/ランチ/g,'Lunch')
    .replace(/ディナー/g,'Dinner')
    .replace(/夜/g,'Evening')
    .replace(/頃/g,' approx.')
    .replace(/売り切れ次第終了/g,'until sold out')
    .replace(/年末年始/g,'year-end/new year')
    .replace(/旧盆休あり/g,'incl. Obon holiday')
    .replace(/昼営業なし/g,'no lunch service')
    .replace(/なし/g,'None')
    // 残りの単体曜日略字
    .replace(/([月火水木金土日])/g, function(_,c){ return d[c]; })
    // 残った「・」区切りを「, 」に
    .replace(/・/g, ', ');
}

// 言語別フィールド取得ヘルパー
function rGenre(r)  { return (_currentLang !== 'ja' && GENRE_EN[r.genre]) ? GENRE_EN[r.genre] : r.genre; }
function rHours(r)  { return _currentLang !== 'ja' ? translateDays(r.hours)  : r.hours;  }
function rClosed(r) { return _currentLang !== 'ja' ? translateDays(r.closed) : r.closed; }
function rNote(r)   { return (_currentLang !== 'ja' && r.note_en) ? r.note_en : r.note;  }

// ── 本日の訪問者数を表示（JST 0:00〜現在の差分） ─────────────────
// gh-dataブランチのvisitor-log.jsonから1時間ごとのスナップショットを読み取り、
// 今日JST0時の累計との差分で「今日の訪問者数」を計算する。
(function () {
  var el = document.getElementById('visitorCount');
  if (!el) return;

  var LOG_URL = 'https://raw.githubusercontent.com/mokumao/ishikawa-map/gh-data/visitor-log.json';

  // JST今日0時のUTCタイムスタンプ（ミリ秒）を返す
  function todayMidnightJST() {
    var now = new Date();
    var jstMs = now.getTime() + 9 * 60 * 60 * 1000;
    var jst = new Date(jstMs);
    return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate())
           - 9 * 60 * 60 * 1000;
  }

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
          var count = d.count_unique || d.count || '?';
          el.textContent = t('visitor.total', { n: count });
        })
        .catch(function () { el.textContent = ''; });
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
  var panelLang    = document.getElementById('gearMenuLang');
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
    panelLang.style.display     = 'none';
    panelCategory.style.display = 'none';
    overlay.classList.add('active');    // 背景をグレーオーバーレイで封鎖
    disableMap();                       // 地図操作を停止
  }
  function showLang() {
    menu.classList.remove('cat-mode');
    panelMain.style.display     = 'none';
    panelLang.style.display     = 'flex';
    panelCategory.style.display = 'none';
  }
  function showCategory() {
    menu.classList.add('cat-mode');  // 画面下2/3シートに展開
    panelMain.style.display     = 'none';
    panelLang.style.display     = 'none';
    panelCategory.style.display = 'flex';
    document.getElementById('minimap').style.display = 'none'; // ミニマップ非表示
  }
  function closeMenu() {
    menu.classList.remove('cat-mode');
    menu.style.display = 'none';
    panelMain.style.display     = 'flex';
    panelLang.style.display     = 'none';
    panelCategory.style.display = 'none';
    document.getElementById('minimap').style.display = ''; // ミニマップ再表示
    setTimeout(function () { if (window._resetMinimap) window._resetMinimap(); }, 50); // サイズ再計算
    overlay.classList.remove('active', 'map-interactive'); // オーバーレイ解除
    // ブロッキングdiv・サイドボタンを復元
    var blocker = document.getElementById('catModeBlocker');
    if (blocker) blocker.parentNode.removeChild(blocker);
    document.getElementById('sideSwipeCtrl').style.zIndex = ''; // z-indexを元に戻す
    ['sideSwipeDown','locateBtn','categoryPinBtn','gearBtn'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
    });
    // 「一覧」ボタンを再度押せるように戻す（カテゴリパネル表示中のみ無効化していた）
    var bTabList = document.getElementById('bottomTabList');
    if (bTabList) bTabList.style.pointerEvents = '';
    // ピンボタン経由で開いた場合、panByの逆操作で元の位置に戻す
    // ※ enableMap()より前に実行（dragging.enable等のリセットで打ち消されないよう）
    if (openedViaPin && savedPanPixels > 0) {
      var _px = savedPanPixels;
      savedPanPixels = 0;
      map.panBy([0, -_px], { animate: true, duration: 0.7 });
    }
    openedViaPin = false;
    enableMap();                        // 地図操作を再開（map.tap.enable含む）
  }

  // ── カテゴリ選択モード（ピンボタン経由）────────────────────────
  // openedViaPin=true のとき：トグル選択・地図上に表示のみ・タップ不可
  // openedViaPin=false のとき：従来の動作（フィルター変更→一覧へ）
  let openedViaPin  = false;
  let savedPanPixels = 0;   // ピンパネル表示時にずらしたピクセル量（復元用）
  const catSel      = new Set(); // 'shokuji' | 'izakaya' | 'conbini' | 'gas'（現在表示中）
  const catChipSet  = new Set(); // チップバーに表示するカテゴリ（パネル閉時に記憶）
  const btnAll      = document.getElementById('gearCatAll');
  const btnClear    = document.getElementById('gearCatClear');
  const btnShokuji  = document.getElementById('gearCatShokuji');
  const btnIzakaya  = document.getElementById('gearCatIzakaya');
  const btnConbini  = document.getElementById('gearCatConbini');
  const btnGas      = document.getElementById('gearCatGas');
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
    var allSelected = catSel.has('shokuji') && catSel.has('izakaya') && catSel.has('conbini') && catSel.has('gas');
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

  // 選択中カテゴリに合わせてマーカーを表示（タップ不可モード）
  function updateCatPreview() {
    markersData.forEach(function({ restaurant: r, marker }) {
      var isShokuji  = r.genre === '食事処';
      var isIzakaya  = r.genre === '居酒屋等';
      var isConbini  = r.genre === 'コンビニ';
      var isGas      = r.genre === 'ガソリン';
      var isStay     = r.genre === '宿泊';
      var isFinance  = r.genre === '金融';
      var isEducation = r.genre === '教育';
      var isTourism  = r.genre === '観光';
      // 上記以外の飲食系（カフェ・焼肉・バル・ラーメン等）は食事処に含める
      var isOtherFood = !isShokuji && !isIzakaya && !isConbini && !isGas && !isStay && !isFinance && !isEducation && !isTourism;
      var show = (catSel.has('shokuji')   && (isShokuji || isOtherFood)) ||
                 (catSel.has('izakaya')   && isIzakaya)   ||
                 (catSel.has('conbini')   && isConbini)   ||
                 (catSel.has('gas')       && isGas)       ||
                 (catSel.has('stay')      && isStay)      ||
                 (catSel.has('finance')   && isFinance)   ||
                 (catSel.has('education') && isEducation) ||
                 (catSel.has('tourism')   && isTourism);
      if (show) { if (!map.hasLayer(marker)) marker.addTo(map); }
      else       { if (map.hasLayer(marker))  map.removeLayer(marker); }
    });
    updateAllBtn();
    updateClearBtn();
    updateSelectAllChipsBtns();
    updateCatLabel();
  }

  // カテゴリラベルバーを更新（catChipSet のチップを表示、catSel で色決定）
  // showAll=true のとき catSel の内容を catChipSet にコピーしてからバーを描画
  function updateCatLabel(showAll) {
    var bar = document.getElementById('catLabelBar');
    if (!bar) return;
    var prevScroll = bar.scrollLeft; // チップタップによる再描画後もスクロール位置を維持
    if (showAll) {
      catChipSet.clear();
      ['shokuji','izakaya','conbini','gas','stay','finance','education','tourism'].forEach(function(k) {
        if (catSel.has(k)) catChipSet.add(k);
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
    var defs = [
      { key: 'shokuji',   label: '食事処',  cls: 'chip-food'      },
      { key: 'izakaya',   label: '居酒屋等', cls: 'chip-izakaya'   },
      { key: 'conbini',   label: 'コンビニ', cls: 'chip-conbini'   },
      { key: 'gas',       label: 'ガソリン', cls: 'chip-gas'       },
      { key: 'stay',      label: '宿泊',    cls: 'chip-stay'      },
      { key: 'finance',   label: '金融',    cls: 'chip-finance'   },
      { key: 'education', label: '教育',    cls: 'chip-education' },
      { key: 'tourism',   label: '観光',    cls: 'chip-tourism'   },
    ].filter(function(d) { return catChipSet.has(d.key); });

    bar.innerHTML = defs.map(function(d) {
      var active = catSel.has(d.key) ? ' chip-active' : '';
      return '<span class="cat-label-chip ' + d.cls + active + '" data-cat="' + d.key + '">'
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

    // 矢印ボタン：クリックでスクロール
    var scrollAmt = 90;
    left.onclick  = function() { bar.scrollLeft -= scrollAmt * 3; setTimeout(updateChipArrows, 350); };
    right.onclick = function() { bar.scrollLeft += scrollAmt * 3; setTimeout(updateChipArrows, 350); };

    // スクロールイベントで矢印更新
    bar.addEventListener('scroll', updateChipArrows, { passive: true });

    // タッチでの横スクロール（差分方式・即時反応）
    var _lastX = 0, _dragging = false;
    bar.addEventListener('touchstart', function(e) {
      _lastX = e.touches[0].clientX;
      _dragging = false;
      e.stopPropagation();
    }, { passive: false });

    bar.addEventListener('touchmove', function(e) {
      var currentX = e.touches[0].clientX;
      var delta = _lastX - currentX;
      if (!_dragging && Math.abs(delta) > 1) _dragging = true;
      if (_dragging) {
        e.stopPropagation();
        bar.scrollLeft += delta;
        _lastX = currentX;
        updateChipArrows();
      }
    }, { passive: false });

    bar.addEventListener('touchend', function(e) {
      if (_dragging) e.stopPropagation();
      _dragging = false;
      updateChipArrows();
    }, { passive: false });

    // スクロール位置はここでは変更しない（呼び出し元 updateCatLabel が管理）
    setTimeout(updateChipArrows, 50);
  }

  // ピンボタン：カテゴリ選択モードで開く（オーバーレイなし・地図パン可）
  document.getElementById('categoryPinBtn').addEventListener('click', function (e) {
    L.DomEvent && L.DomEvent.stopPropagation(e);
    openedViaPin = true;
    if (catSel.size === 0) {
      // マーカーが表示中かどうか確認して自動的に catSel へ反映
      var hasShokuji  = markersData.some(function(d) { return d.restaurant.genre === '食事処'   && map.hasLayer(d.marker); });
      var hasIzakaya  = markersData.some(function(d) { return d.restaurant.genre === '居酒屋等'  && map.hasLayer(d.marker); });
      var hasOtherFood = markersData.some(function(d) { var g = d.restaurant.genre; return !['食事処','居酒屋等','コンビニ','ガソリン','宿泊','金融','教育','観光'].includes(g) && map.hasLayer(d.marker); });
      var hasConbini  = markersData.some(function(d) { return d.restaurant.genre === 'コンビニ' && map.hasLayer(d.marker); });
      var hasGas      = markersData.some(function(d) { return d.restaurant.genre === 'ガソリン' && map.hasLayer(d.marker); });
      var hasStay     = markersData.some(function(d) { return d.restaurant.genre === '宿泊'     && map.hasLayer(d.marker); });
      var hasFinance  = markersData.some(function(d) { return d.restaurant.genre === '金融'     && map.hasLayer(d.marker); });
      var hasEducation = markersData.some(function(d) { return d.restaurant.genre === '教育'    && map.hasLayer(d.marker); });
      var hasTourism  = markersData.some(function(d) { return d.restaurant.genre === '観光'     && map.hasLayer(d.marker); });
      if (hasShokuji || hasIzakaya || hasOtherFood || hasConbini || hasGas || hasStay || hasFinance || hasEducation || hasTourism) {
        if (hasShokuji || hasOtherFood) { catSel.add('shokuji');  btnShokuji.classList.add('cat-selected'); }
        if (hasIzakaya)   { catSel.add('izakaya');   btnIzakaya.classList.add('cat-selected'); }
        if (hasConbini)   { catSel.add('conbini');   btnConbini.classList.add('cat-selected'); }
        if (hasGas)       { catSel.add('gas');        btnGas.classList.add('cat-selected'); }
        if (hasStay)      { catSel.add('stay');       document.getElementById('gearCatStay').classList.add('cat-selected'); }
        if (hasFinance)   { catSel.add('finance');    document.getElementById('gearCatFinance').classList.add('cat-selected'); }
        if (hasEducation) { catSel.add('education');  document.getElementById('gearCatEducation').classList.add('cat-selected'); }
        if (hasTourism)   { catSel.add('tourism');    document.getElementById('gearCatTourism').classList.add('cat-selected'); }
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
    // 「一覧」ボタンは押せないようにする（「店名」ボタンは操作可能のまま維持）
    var bTabListOpen = document.getElementById('bottomTabList');
    if (bTabListOpen) bTabListOpen.style.pointerEvents = 'none';
    // Leafletのタップ合成クリックも無効化
    if (map.tap) map.tap.disable();
  });

  // ── 初期表示：地図下部にカテゴリチップバー（施設アイコン）を常時表示 ──
  // ページを開いた直後から全カテゴリのチップを並べ、表示中のカテゴリを色付きにする。
  // markersData 生成・applyFilter('all') 実行後に走らせるため setTimeout(0) を使用
  setTimeout(function () {
    if (catChipSet.size > 0) return; // 既に表示済みなら何もしない
    var checks = {
      shokuji:   function(g){ return g === '食事処' || !['食事処','居酒屋等','コンビニ','ガソリン','宿泊','金融','教育','観光'].includes(g); },
      izakaya:   function(g){ return g === '居酒屋等'; },
      conbini:   function(g){ return g === 'コンビニ'; },
      gas:       function(g){ return g === 'ガソリン'; },
      stay:      function(g){ return g === '宿泊'; },
      finance:   function(g){ return g === '金融'; },
      education: function(g){ return g === '教育'; },
      tourism:   function(g){ return g === '観光'; }
    };
    var btnIds = {
      shokuji: 'gearCatShokuji', izakaya: 'gearCatIzakaya', conbini: 'gearCatConbini',
      gas: 'gearCatGas', stay: 'gearCatStay', finance: 'gearCatFinance',
      education: 'gearCatEducation', tourism: 'gearCatTourism'
    };
    Object.keys(checks).forEach(function (key) {
      catChipSet.add(key); // チップは全カテゴリ分並べる
      var visible = markersData.some(function (d) {
        return checks[key](d.restaurant.genre) && map.hasLayer(d.marker);
      });
      if (visible) {
        catSel.add(key);
        var b = document.getElementById(btnIds[key]);
        if (b) b.classList.add('cat-selected');
      }
    });
    updateAllBtn();
    updateClearBtn();
    updateCatLabel(); // catChipSet の全チップを描画（表示中カテゴリは色付き）
    updateSelectAllChipsBtns();
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
  document.getElementById('gearLangBtn').addEventListener('click', showLang);
  document.getElementById('gearCloseBtn').addEventListener('click', closeMenu);

  // カテゴリサブメニュー
  // 「すべて」ボタン：全カテゴリを選択
  btnAll.addEventListener('click', function () {
    if (!openedViaPin) return;
    ['shokuji','izakaya','conbini','gas','stay','finance','education','tourism'].forEach(function(k) { catSel.add(k); });
    [btnShokuji, btnIzakaya, btnConbini, btnGas,
     document.getElementById('gearCatStay'), document.getElementById('gearCatFinance'),
     document.getElementById('gearCatEducation'), document.getElementById('gearCatTourism')
    ].forEach(function(b) { if (b) b.classList.add('cat-selected'); });
    updateCatPreview();
  });
  // 「解除」ボタン：全選択を解除
  btnClear.addEventListener('click', function () {
    if (!openedViaPin) return;
    catSel.clear();
    [btnShokuji, btnIzakaya, btnConbini, btnGas,
     document.getElementById('gearCatStay'), document.getElementById('gearCatFinance'),
     document.getElementById('gearCatEducation'), document.getElementById('gearCatTourism')
    ].forEach(function(b) { if (b) b.classList.remove('cat-selected'); });
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

  btnShokuji.addEventListener('click', function () {
    if (openedViaPin) {
      if (catSel.has('shokuji')) { catSel.delete('shokuji'); btnShokuji.classList.remove('cat-selected'); }
      else                       { catSel.add('shokuji');    btnShokuji.classList.add('cat-selected'); }
      updateCatPreview();
    } else {
      closeMenu();
      applyFilter('shokuji');
      switchTab('list');
    }
  });

  btnIzakaya.addEventListener('click', function () {
    if (openedViaPin) {
      if (catSel.has('izakaya')) { catSel.delete('izakaya'); btnIzakaya.classList.remove('cat-selected'); }
      else                       { catSel.add('izakaya');    btnIzakaya.classList.add('cat-selected'); }
      updateCatPreview();
    } else {
      closeMenu();
      applyFilter('izakaya');
      switchTab('list');
    }
  });
  btnConbini.addEventListener('click', function () {
    if (openedViaPin) {
      if (catSel.has('conbini')) { catSel.delete('conbini'); btnConbini.classList.remove('cat-selected'); }
      else                       { catSel.add('conbini');    btnConbini.classList.add('cat-selected'); }
      updateCatPreview();
    } else {
      closeMenu();
      applyFilter('conbini');
      switchTab('list');
    }
  });
  btnGas.addEventListener('click', function () {
    if (openedViaPin) {
      if (catSel.has('gas')) { catSel.delete('gas'); btnGas.classList.remove('cat-selected'); }
      else                   { catSel.add('gas');    btnGas.classList.add('cat-selected'); }
      updateCatPreview();
    } else {
      closeMenu();
      applyFilter('all');
    }
  });
  // 宿泊ボタン
  document.getElementById('gearCatStay').addEventListener('click', function () {
    if (openedViaPin) {
      var b = document.getElementById('gearCatStay');
      if (catSel.has('stay')) { catSel.delete('stay'); b.classList.remove('cat-selected'); }
      else                    { catSel.add('stay');    b.classList.add('cat-selected'); }
      updateCatPreview();
    } else { closeMenu(); }
  });
  // 金融ボタン
  document.getElementById('gearCatFinance').addEventListener('click', function () {
    if (openedViaPin) {
      var b = document.getElementById('gearCatFinance');
      if (catSel.has('finance')) { catSel.delete('finance'); b.classList.remove('cat-selected'); }
      else                       { catSel.add('finance');    b.classList.add('cat-selected'); }
      updateCatPreview();
    } else { closeMenu(); }
  });
  // 教育ボタン
  document.getElementById('gearCatEducation').addEventListener('click', function () {
    if (openedViaPin) {
      var b = document.getElementById('gearCatEducation');
      if (catSel.has('education')) { catSel.delete('education'); b.classList.remove('cat-selected'); }
      else                         { catSel.add('education');    b.classList.add('cat-selected'); }
      updateCatPreview();
    } else { closeMenu(); }
  });
  // 観光ボタン
  document.getElementById('gearCatTourism').addEventListener('click', function () {
    if (openedViaPin) {
      var b = document.getElementById('gearCatTourism');
      if (catSel.has('tourism')) { catSel.delete('tourism'); b.classList.remove('cat-selected'); }
      else                       { catSel.add('tourism');    b.classList.add('cat-selected'); }
      updateCatPreview();
    } else { closeMenu(); }
  });
  // 閉じるボタン：選択モード終了→通常の地図に戻る
  document.getElementById('gearCatBack').addEventListener('click', function () {
    if (openedViaPin) {
      // openedViaPin = false はcloseMenu()内で行う（地図復元チェックのため）
      map.getPane('markerPane').style.pointerEvents = ''; // タップを元に戻す
      if (catSel.size === 0) {
        // 何も選択せずに閉じた場合は元のフィルターを復元
        applyFilter(currentFilter);
        hideCatLabel();
      } else {
        // 選択中のカテゴリをラベルバーに表示
        // catSel・ボタン状態はそのまま保持（涙目アイコンで戻れるように）
        updateCatLabel(true); // catSel を catChipSet にコピーしてバー生成
      }
    }
    closeMenu();
  });

  // 言語サブメニュー
  document.getElementById('gearLangJa').addEventListener('click', function () {
    setLanguage('ja');
    closeMenu();
  });
  document.getElementById('gearLangEn').addEventListener('click', function () {
    setLanguage('en');
    closeMenu();
  });
  document.getElementById('gearLangZh').addEventListener('click', function () {
    alert('中国語対応は準備中です。');
  });
  document.getElementById('gearLangBack').addEventListener('click', showMain);

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

// ── フィルター定義 ───────────────────────────────────────────────
const FILTERS = [
  { id: 'all',      label: 'すべて',   color: '#546e7a', test: g => g !== 'コンビニ' && g !== 'ガソリン' },
  { id: 'shokuji',  label: '食事処',   color: '#f57c00', test: g => g === '食事処' },
  { id: 'izakaya',  label: '居酒屋等', color: '#e53935', test: g => g === '居酒屋等' },
  { id: 'cafe',     label: 'カフェ',   color: '#00897b', test: g => g.includes('カフェ') },
  { id: 'yakiniku', label: '焼肉',     color: '#fb8c00', test: g => g.includes('焼肉') },
  { id: 'bar',      label: 'バル',     color: '#8e24aa', test: g => g.includes('バル') },
  { id: 'ramen',    label: 'ラーメン', color: '#c62828', test: g => g.includes('ラーメン') },
  // コンビニ・ガソリンはサイドバーには表示しない（歯車メニューから切り替え）
  { id: 'conbini',  label: 'コンビニ', color: '#0067CC', test: g => g === 'コンビニ', hidden: true },
  { id: 'gas',      label: 'ガソリン', color: '#ff6f00', test: g => g === 'ガソリン', hidden: true },
];

let currentFilter = 'all';
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
const DEFAULT_COLOR   = FOOD_COLOR;
const WARN_COLOR      = "#f57c00";

function genreColor(genre) {
  return FOOD_COLOR; // 飲食店はすべて赤
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

// ── ポップアップ HTML 生成 ────────────────────────────────────────
function makePopup(r, idx) {
  const hoursHtml  = rHours(r).replace(/\n/g, "<br>");
  const closedVal  = rClosed(r);
  const closedHtml = (r.closed.includes("要確認"))
    ? `<span style="color:#e65100">${closedVal}</span>`
    : closedVal;
  const noteVal  = rNote(r);
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
          <a href="detail.html#${idx}"
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
const _initialShopIdx = (function () {
  var s = new URLSearchParams(location.search).get('shop');
  return s !== null ? parseInt(s, 10) : NaN;
})();
const _initialShop = !isNaN(_initialShopIdx) ? restaurants[_initialShopIdx] : null;
// 店舗フォーカス時はポップアップを広く見せるため最初からヘッダーを畳んでおく
if (_initialShop) document.body.classList.add('header-collapsed');

const map = L.map("map", {
  center:  _initialShop ? [_initialShop.lat, _initialShop.lng] : [26.430, 127.828],
  zoom:    _initialShop ? 16 : 14,
  maxZoom: 21,
  zoomControl: false,  // デフォルト左上を無効化→左下に再配置
  zoomSnap: 0,         // ズームレベルをスナップしない（指離し時のアニメーションを防止）
});

// ＋－ボタン：スマホ→左下、PC→左上
L.control.zoom({ position: window.innerWidth <= 767 ? 'bottomleft' : 'topleft' }).addTo(map);

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
// 表示を制御するのでこの広域表示は行わない（実行すると focusShop の結果を上書きしてしまう）
if (new URLSearchParams(location.search).get('shop') === null) {
  setTimeout(() => {
    fitIshikawaAll(false);
  }, 500);
}

// ── ミニマップ（右上の概要図） ─────────────────────────────────────
(function () {
  const miniMapEl = document.getElementById('minimap');
  if (!miniMapEl) return;

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
    miniTileLayer.redraw(); // 灰色のまま残ったタイルを再取得
  }

  // ① 初期化：十分な時間をとってサイズ再計算（低速端末対策）
  setTimeout(resetMinimap, 300);
  setTimeout(resetMinimap, 800); // 二重保険
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

  // ③ 画面回転・リサイズ時
  window.addEventListener('resize', function () {
    setTimeout(resetMinimap, 150);
  });

  // ④ カテゴリパネルで非表示→再表示されたときに呼べるよう外部公開
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
  } else {
    color = FOOD_COLOR;
  }
  pinLabel = undefined;
  const marker = L.marker([r.lat, r.lng], {
    icon:  makePinIcon(color, r.warn, pinLabel),
    title: r.name
  });
  marker.bindPopup(makePopup(r, idx), { maxWidth: 300, autoPan: false });
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
      setTimeout(function() {
        map.invalidateSize();
        marker.openPopup();
      }, 380);
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
map.on('popupopen', function(e) {
  var src = e.popup._source;
  // 現在地マーカーは除外・店舗マーカーのみ対象
  if (src && src.getElement && !src._isLocationMarker) {
    var el = src.getElement();
    if (el) el.classList.add('marker-active-pulse');
  }
});
map.on('popupclose', function() {
  document.querySelectorAll('.marker-active-pulse').forEach(function(el) {
    el.classList.remove('marker-active-pulse');
  });
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

// ── 地図操作時にヘッダーを自動非表示（スマホのみ） ─────────────────────
// ドラッグ・ズーム開始時にヘッダーを折りたたむ
if ('ontouchstart' in window) {
  function collapseHeaderOnInteraction() {
    if (window._suppressHeaderCollapse) return; // プログラムによる自動ズーム中は無視
    if (!document.body.classList.contains('header-collapsed')) {
      document.body.classList.add('header-collapsed');
      setTimeout(function() { map.invalidateSize(); }, 50);
    }
  }
  map.on('dragstart', collapseHeaderOnInteraction);
  map.on('zoomstart', collapseHeaderOnInteraction);
}

// ── スマホ：地図を下へスワイプしたら下部カテゴリボタンを隠す ────────
(function () {
  if (!('ontouchstart' in window)) return;

  const mapEl = document.getElementById('map');
  const restoreBtn = document.getElementById('catControlsRestoreBtn');
  if (!mapEl || !restoreBtn) return;

  let startX = 0;
  let startY = 0;
  let minY = 0;
  let latestDx = 0;
  let latestDy = 0;
  let draggingControls = false;
  let restoreStartY = 0;
  let ignoreGesture = false;
  const HIDE_THRESHOLD = 74;
  const MAX_DRAG = 145;

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

  function hideCategoryControls() {
    if (!isMapView() || !hasVisibleCategoryControls()) return;
    document.body.classList.add('cat-controls-hidden');
  }

  function showCategoryControls() {
    document.body.classList.remove('cat-controls-hidden');
    resetDragState();
  }

  function setDragOffset(y) {
    const clamped = Math.max(0, Math.min(MAX_DRAG, y));
    const opacity = Math.max(0.08, 1 - clamped / MAX_DRAG);
    document.body.style.setProperty('--cat-controls-drag-y', clamped + 'px');
    document.body.style.setProperty('--cat-controls-drag-opacity', String(opacity));
  }

  function resetDragState() {
    draggingControls = false;
    document.body.classList.remove('cat-controls-dragging');
    document.body.style.removeProperty('--cat-controls-drag-y');
    document.body.style.removeProperty('--cat-controls-drag-opacity');
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

  restoreBtn.addEventListener('click', showCategoryControls);
  restoreBtn.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    restoreStartY = e.touches[0].clientY;
  }, { passive: true });
  restoreBtn.addEventListener('touchend', function (e) {
    if (e.changedTouches.length !== 1) return;
    const dy = e.changedTouches[0].clientY - restoreStartY;
    if (dy < -20) showCategoryControls();
  }, { passive: true });
})();

// ── ページ表示時はヘッダー（青色バー）を必ず表示 ─────────────────────
// スマホブラウザのbfcache復元で前回の折りたたみ状態が残るのを防ぐ。
// pageshow は通常の読み込みでもキャッシュ復元でも発火する
// ただし ?shop=N 指定時（店舗詳細ページからの復帰）は、ポップアップを
// 広く見せるためヘッダーを畳んだままにする
window.addEventListener('pageshow', function () {
  if (_initialShop) return;
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

    // × ボタンに直接 touchend を付けてポップアップを閉じる（二重保険）
    var closeBtns = popupEl.querySelectorAll('.popup-close-side');
    closeBtns.forEach(function(btn) {
      btn.addEventListener('touchend', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        map.closePopup();
      }, { once: true, passive: false });
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

  // ── スマホ：ポップアップを触っても地図をスクロールできるよう手動パン実装 ──────
  // Leaflet の disableClickPropagation が touchstart のバブルを止めるが、
  // 同一要素の後続リスナーは呼ばれるため、ここで手動 panBy を実装する。
  // ポップアップ外（地図エリア）は Leaflet の通常ドラッグをそのまま使う。
  var _mc = map.getContainer();
  var _pw = popupEl.querySelector('.leaflet-popup-content-wrapper');
  var _lTX = 0, _lTY = 0, _tDragging = false, _tActive = false;

  function onWrapTouchStart(te) {
    if (te.touches.length !== 1) return;
    // ボタン・リンク上のタッチはパン処理をせずネイティブのタップ動作を維持
    // （パンで地図とポップアップが動くとタップがクリックとして成立しなくなるため）
    if (te.target.closest('a, button, .popup-close-side')) { _tActive = false; return; }
    _tActive   = true;
    _lTX = te.touches[0].clientX;
    _lTY = te.touches[0].clientY;
    _tDragging = false;
    // Leaflet のドラッグが干渉しないよう一時無効化
    map.dragging.disable();
  }
  function onWrapTouchMove(te) {
    if (!_tActive || te.touches.length !== 1) return;
    var dx = te.touches[0].clientX - _lTX;
    var dy = te.touches[0].clientY - _lTY;
    if (!_tDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) _tDragging = true;
    if (!_tDragging) return;
    _lTX = te.touches[0].clientX;
    _lTY = te.touches[0].clientY;
    map.panBy([-dx, -dy], { animate: false });
  }
  function onWrapTouchEnd() {
    if (!_tActive) return;
    _tActive = false;
    map.dragging.enable();
  }
  if (_pw) {
    _pw.addEventListener('touchstart', onWrapTouchStart, { passive: true });
    _pw.addEventListener('touchmove',  onWrapTouchMove,  { passive: true });
    _pw.addEventListener('touchend',   onWrapTouchEnd,   { passive: true });
    _pw.addEventListener('touchcancel',onWrapTouchEnd,   { passive: true });
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
      _pw.removeEventListener('touchend',   onWrapTouchEnd);
      _pw.removeEventListener('touchcancel',onWrapTouchEnd);
    }
    popupEl.removeEventListener('mousedown',  onMouseDown);
    mapContainer.removeEventListener('wheel', onWheelCapture, { capture: true });
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
    popupEl.style.cursor = '';
  });
});

// ── 凡例コントロール ─────────────────────────────────────────────
const legendItems = [
  { color: "#f57c00", label: "食事処"   },
  { color: "#e53935", label: "居酒屋等" },
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
  container.innerHTML = ''; // 再描画時にリセット
  FILTERS.forEach(f => {
    if (f.hidden) return; // コンビニなどサイドバー非表示フィルターはスキップ
    const btn = document.createElement('button');
    btn.className   = 'filter-btn' + (f.id === currentFilter ? ' active' : '');
    btn.textContent = t('filter.' + f.id); // 翻訳対応
    btn.style.setProperty('--fc', f.color);
    btn.setAttribute('data-filter', f.id);
    btn.addEventListener('click', () => applyFilter(f.id));
    container.appendChild(btn);
  });
}

// ── 表示判定（フィルター＋検索の両方を満たすか） ────────────────
function isVisible(r) {
  // alwaysShow フラグがある店舗はフィルターに関わらず常時表示
  if (!r.alwaysShow) {
    const filterObj = FILTERS.find(f => f.id === currentFilter);
    if (!filterObj.test(r.genre)) return false;
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

// ── フィルター適用 ───────────────────────────────────────────────
function applyFilter(filterId) {
  currentFilter = filterId;

  // カテゴリラベルバーラッパーを非表示（通常モードに戻るため）
  var catWrapper = document.getElementById('catLabelWrapper');
  if (catWrapper) catWrapper.style.display = 'none';
  var catSelectAllRow = document.getElementById('catSelectAllRow');
  if (catSelectAllRow) catSelectAllRow.style.display = 'none';

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
function focusShop(idx, instant) {
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
function toggleLabels() {
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
markersData.forEach(function({ restaurant: r, marker }) {
  if (!map.hasLayer(marker)) marker.addTo(map);
});
applyLangToDOM();
