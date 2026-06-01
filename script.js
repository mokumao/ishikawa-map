/* ================================================================
   うるま市石川 飲食店マップ — script.js
   地図: MapLibre GL JS + OpenFreeMap
================================================================ */

// ── 多言語対応 (i18n) ─────────────────────────────────────────────
var _currentLang = 'ja';

var TRANSLATIONS = {
  ja: {
    'header.title':        '石川マップ',
    'header.sub1':         'この情報は不正確な場合もあります。→参照',
    'header.sub2':         'あなたの知らない石川が見つかるかも',
    'wip.text':            'このサイトは現在作成中です。掲載情報が間違っている場合があります。正式公開前の確認用ページです。',
    'tab.map':             '🗺 地図',
    'tab.list':            '📋 一覧',
    'search.placeholder':  '店名・ジャンル・住所・営業時間で検索…',
    'filter.label':        'ジャンルで絞り込み',
    'btn.showNames':       '店名を表示',
    'bottom.map':          '🗺 地図',
    'bottom.list':         '📋 一覧',
    'gear.list':           'リスト',
    'gear.back':           '戻る',
    'lang.ja':             '日本語',
    'lang.en':             '英語',
    'lang.zh':             '中国語',
    'lang.back':           '戻る',
    'info.about-site':     'このサイトについて',
    'info.about-ishikawa': '石川について',
    'info.faq':            'Q & A',
    'info.feedback':       'ご意見・ご要望',
    'info.today':          '今日の石川情報',
    'popup.address':       '住所',
    'popup.hours':         '営業時間',
    'popup.closed':        '定休日',
    'popup.note':          '備考',
    'popup.gmap':          '📍 Googleマップで見る',
    'popup.detail':        '📄 店舗詳細を見る',
    'count.results':       '{n} 件表示中',
    'list.closed':         '定休日：',
    'filter.all':          'すべて',
    'filter.izakaya':      '居酒屋・食堂',
    'filter.cafe':         'カフェ',
    'filter.yakiniku':     '焼肉',
    'filter.bar':          'バル',
    'filter.ramen':        'ラーメン',
    'filter.conbini':      'コンビニ',
    'footer.main':         '🌊 うるま市石川 飲食店マップ  |  掲載情報は調査時点のものです',
    'visitor.today':       '本日の訪問者 {n} 人',
    'visitor.total':       '累計訪問者 {n} 人',
  },
  en: {
    'header.title':        'Ishikawa Map',
    'header.sub1':         'Info may be inaccurate. →More info',
    'header.sub2':         'Discover hidden gems in Ishikawa!',
    'wip.text':            'This site is under construction. Some info may be incorrect.',
    'tab.map':             '🗺 Map',
    'tab.list':            '📋 List',
    'search.placeholder':  'Search by name, genre, address, hours…',
    'filter.label':        'Filter by genre',
    'btn.showNames':       'Show names',
    'bottom.map':          '🗺 Map',
    'bottom.list':         '📋 List',
    'gear.list':           'List',
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
    'popup.gmap':          '📍 Open in Google Maps',
    'popup.detail':        '📄 View Details',
    'count.results':       '{n} results',
    'list.closed':         'Closed: ',
    'filter.all':          'All',
    'filter.izakaya':      'Izakaya / Diner',
    'filter.cafe':         'Café',
    'filter.yakiniku':     'BBQ',
    'filter.bar':          'Bar',
    'filter.ramen':        'Ramen',
    'filter.conbini':      'Convenience Store',
    'footer.main':         '🌊 Ishikawa, Uruma City  |  Info as of survey date',
    'visitor.today':       "Today's visitors: {n}",
    'visitor.total':       'Total visitors: {n}',
  }
};

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

function applyLangToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
}

function setLanguage(lang) {
  _currentLang = lang;
  applyLangToDOM();
  if (typeof buildFilterButtons === 'function') buildFilterButtons();
  if (typeof renderShopList    === 'function') renderShopList();
  closeCurrentPopup();
  // 全マーカーのポップアップを新言語で再生成
  if (typeof markersData !== 'undefined') {
    markersData.forEach(function(d) {
      d.popup.setHTML(makePopup(d.restaurant, d.idx));
    });
  }
}

// ── ジャンル英語マッピング ────────────────────────────────────────
var GENRE_EN = {
  '居酒屋':                    'Izakaya',
  '居酒屋・食堂':              'Izakaya / Diner',
  '居酒屋・創作料理':          'Izakaya / Creative',
  '居酒屋・和食':              'Izakaya / Japanese',
  '食堂・居酒屋':              'Diner / Izakaya',
  '食堂':                      'Diner',
  'バル（中華・和食・バー）':  'Bar (Chinese/Japanese/Bar)',
  '焼肉':                      'BBQ',
  'カフェ':                    'Café',
  'カフェ・イタリアン':        'Café / Italian',
  'カフェ・バー（ハワイ料理）':'Café / Bar (Hawaiian)',
  'カフェ・パン':              'Café / Bakery',
  'カフェ・八重山そば':        'Café / Yaeyama Soba',
  '沖縄そば・食堂':            'Okinawa Soba / Diner',
  '沖縄料理':                  'Okinawan Cuisine',
  'ハンバーガー':              'Burger',
  '焼き鳥・居酒屋':            'Yakitori / Izakaya',
  'ラーメン':                  'Ramen',
  'テスト用':                  'Test',
};

function translateDays(str) {
  if (!str) return str;
  var d = { 月:'Mon', 火:'Tue', 水:'Wed', 木:'Thu', 金:'Fri', 土:'Sat', 日:'Sun' };
  return str
    .replace(/月曜日/g,'Monday').replace(/火曜日/g,'Tuesday')
    .replace(/水曜日/g,'Wednesday').replace(/木曜日/g,'Thursday')
    .replace(/金曜日/g,'Friday').replace(/土曜日/g,'Saturday')
    .replace(/日曜日/g,'Sunday')
    .replace(/土・日・祝日/g,'Sat, Sun & Holidays')
    .replace(/([月火水木金土日])〜([月火水木金土日])/g, function(_,a,b){ return d[a]+'–'+d[b]; })
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
    .replace(/([月火水木金土日])/g, function(_,c){ return d[c]; })
    .replace(/・/g, ', ');
}

function rGenre(r)  { return (_currentLang !== 'ja' && GENRE_EN[r.genre]) ? GENRE_EN[r.genre] : r.genre; }
function rHours(r)  { return _currentLang !== 'ja' ? translateDays(r.hours)  : r.hours;  }
function rClosed(r) { return _currentLang !== 'ja' ? translateDays(r.closed) : r.closed; }
function rNote(r)   { return (_currentLang !== 'ja' && r.note_en) ? r.note_en : r.note;  }

// ── 本日の訪問者数を表示 ─────────────────────────────────────────
(function () {
  var el = document.getElementById('visitorCount');
  if (!el) return;

  var LOG_URL = 'https://raw.githubusercontent.com/mokumao/ishikawa-map/gh-data/visitor-log.json';

  function todayMidnightJST() {
    var now = new Date();
    var jstMs = now.getTime() + 9 * 60 * 60 * 1000;
    var jst = new Date(jstMs);
    return Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate())
           - 9 * 60 * 60 * 1000;
  }

  fetch(LOG_URL + '?_=' + Date.now())
    .then(function (r) {
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    })
    .then(function (data) {
      if (!data || data.length === 0) throw new Error('empty');
      var midnight = todayMidnightJST();
      var latestCount = data[data.length - 1].count;
      var baseCount = null;
      for (var i = data.length - 1; i >= 0; i--) {
        if (new Date(data[i].ts).getTime() <= midnight) { baseCount = data[i].count; break; }
      }
      if (baseCount === null) baseCount = data[0].count;
      var todayCount = Math.max(0, latestCount - baseCount);
      el.textContent = t('visitor.today', { n: todayCount });
    })
    .catch(function () {
      fetch('https://ishikawamap.goatcounter.com/counter//ishikawa-map/.json')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var count = d.count_unique || d.count || '?';
          el.textContent = t('visitor.total', { n: count });
        })
        .catch(function () { el.textContent = ''; });
    });
})();

// ── 現在地ボタン ─────────────────────────────────────────────────
(function () {
  const btn = document.getElementById('locateBtn');
  if (!btn) return;

  let locationMarker = null;
  let watchId        = null;
  let isFirstFix     = true;
  var _locateBtnOrigHTML = btn.innerHTML;

  function createMarker(lat, lng) {
    if (locationMarker) { locationMarker.remove(); locationMarker = null; }

    const el = document.createElement('div');
    el.className = 'location-marker-wrap';
    el.innerHTML = '<div class="location-sonar-dot"></div>' +
                   '<div class="location-label-tag">現在地</div>';

    locationMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map);

    setTimeout(function() {
      if (!el) return;
      var tag = el.querySelector('.location-label-tag');
      if (!tag) return;
      tag.style.transition = 'opacity 0.5s ease';
      tag.style.opacity    = '0';
      setTimeout(function() { if (tag) tag.style.display = 'none'; }, 500);
    }, 5000);
  }

  btn.addEventListener('click', function () {
    if (!navigator.geolocation) {
      alert('このブラウザは位置情報に対応していません。');
      return;
    }
    closeCurrentPopup();

    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    if (locationMarker) { locationMarker.remove(); locationMarker = null; }

    isFirstFix = true;
    btn.classList.add('locating');

    watchId = navigator.geolocation.watchPosition(
      function (pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (isFirstFix) {
          isFirstFix = false;
          btn.classList.remove('locating');
          btn.innerHTML = _locateBtnOrigHTML;
          createMarker(lat, lng);
          map.flyTo({ center: [lng, lat], zoom: 13, duration: 1000 });
          map.once('moveend', function () {
            setTimeout(function () {
              map.flyTo({ center: [lng, lat], zoom: 16, duration: 2200 });
            }, 500);
          });
        } else {
          if (locationMarker) {
            locationMarker.setLngLat([lng, lat]);
          } else {
            createMarker(lat, lng);
          }
        }
      },
      function (err) {
        if (isFirstFix) {
          isFirstFix = false;
          btn.classList.remove('locating');
          btn.innerHTML = _locateBtnOrigHTML;
          if (err.code === 1) {
            alert('位置情報の使用が拒否されました。\nスマホの設定でブラウザの位置情報を許可してください。');
            if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
          }
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );
  });

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

  function disableMap() {
    map.dragPan.disable();
    map.touchZoomRotate.disable();
    map.doubleClickZoom.disable();
    map.scrollZoom.disable();
  }
  function enableMap() {
    map.dragPan.enable();
    map.touchZoomRotate.enable();
    map.doubleClickZoom.enable();
    map.scrollZoom.enable();
  }

  function showMain() {
    menu.classList.remove('cat-mode');
    menu.style.display = 'block';
    panelMain.style.display     = 'flex';
    panelLang.style.display     = 'none';
    panelCategory.style.display = 'none';
    overlay.classList.add('active');
    disableMap();
  }
  function showLang() {
    menu.classList.remove('cat-mode');
    panelMain.style.display     = 'none';
    panelLang.style.display     = 'flex';
    panelCategory.style.display = 'none';
  }
  function showCategory() {
    menu.classList.add('cat-mode');
    panelMain.style.display     = 'none';
    panelLang.style.display     = 'none';
    panelCategory.style.display = 'flex';
    document.getElementById('minimap').style.display = 'none';
  }
  function closeMenu() {
    menu.classList.remove('cat-mode');
    menu.style.display = 'none';
    panelMain.style.display     = 'flex';
    panelLang.style.display     = 'none';
    panelCategory.style.display = 'none';
    document.getElementById('minimap').style.display = '';
    setTimeout(function () { if (window._resetMinimap) window._resetMinimap(); }, 50);
    overlay.classList.remove('active', 'map-interactive');
    var blocker = document.getElementById('catModeBlocker');
    if (blocker) blocker.parentNode.removeChild(blocker);
    document.getElementById('sideSwipeCtrl').style.zIndex = '';
    ['sideSwipeUp','sideSwipeDown','locateBtn','categoryPinBtn','gearBtn'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
    });
    // マーカークリック復元
    map.getContainer().classList.remove('markers-no-pointer');
    if (openedViaPin && savedPanPixels > 0) {
      var _px = savedPanPixels;
      savedPanPixels = 0;
      map.panBy([0, -_px], { duration: 700 });
    }
    openedViaPin = false;
    enableMap();
  }

  let openedViaPin  = false;
  let savedPanPixels = 0;
  const catSel      = new Set();
  const catChipSet  = new Set();
  const btnAll      = document.getElementById('gearCatAll');
  const btnClear    = document.getElementById('gearCatClear');
  const btnFood     = document.getElementById('gearCatFood');
  const btnConbini  = document.getElementById('gearCatConbini');
  const btnGas      = document.getElementById('gearCatGas');

  function updateAllBtn() {
    var allSelected = catSel.has('food') && catSel.has('conbini') && catSel.has('gas');
    btnAll.classList.toggle('cat-all-active', allSelected);
  }
  function updateClearBtn() {
    btnClear.classList.toggle('cat-clear-inactive', catSel.size === 0);
  }

  function updateCatPreview() {
    var NON_FOOD = ['コンビニ','ガソリン','宿泊','金融','教育','観光'];
    markersData.forEach(function(d) {
      var r = d.restaurant;
      var isFood      = !NON_FOOD.includes(r.genre);
      var isConbini   = r.genre === 'コンビニ';
      var isGas       = r.genre === 'ガソリン';
      var isStay      = r.genre === '宿泊';
      var isFinance   = r.genre === '金融';
      var isEducation = r.genre === '教育';
      var isTourism   = r.genre === '観光';
      var show = (catSel.has('food')      && isFood)      ||
                 (catSel.has('conbini')   && isConbini)   ||
                 (catSel.has('gas')       && isGas)       ||
                 (catSel.has('stay')      && isStay)      ||
                 (catSel.has('finance')   && isFinance)   ||
                 (catSel.has('education') && isEducation) ||
                 (catSel.has('tourism')   && isTourism);
      if (show) d.show(); else d.hide();
    });
    updateAllBtn();
    updateClearBtn();
    updateCatLabel();
  }

  function updateCatLabel(showAll) {
    var bar = document.getElementById('catLabelBar');
    if (!bar) return;
    if (showAll) {
      catChipSet.clear();
      ['food','conbini','gas','stay','finance','education','tourism'].forEach(function(k) {
        if (catSel.has(k)) catChipSet.add(k);
      });
    }
    var wrapper = document.getElementById('catLabelWrapper');
    if (catChipSet.size === 0) { if (wrapper) wrapper.style.display = 'none'; return; }
    var defs = [
      { key: 'food',      label: '飲食店',  cls: 'chip-food'      },
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

    if (wrapper) wrapper.style.display = 'flex';

    bar.querySelectorAll('.cat-label-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var key = chip.getAttribute('data-cat');
        if (catSel.has(key)) { catSel.delete(key); chip.classList.remove('chip-active'); }
        else                  { catSel.add(key);    chip.classList.add('chip-active');    }
        updateCatPreview();
      });
    });
    setupChipScrollBtns();
  }

  function hideCatLabel() {
    var wrapper = document.getElementById('catLabelWrapper');
    if (wrapper) wrapper.style.display = 'none';
    catChipSet.clear();
  }

  function updateChipArrows() {
    var bar   = document.getElementById('catLabelBar');
    var left  = document.getElementById('catScrollLeft');
    var right = document.getElementById('catScrollRight');
    if (!bar || !left || !right) return;
    left.classList.toggle('arrow-hidden',  bar.scrollLeft <= 1);
    right.classList.toggle('arrow-hidden', bar.scrollLeft >= bar.scrollWidth - bar.clientWidth - 1);
  }

  function setupChipScrollBtns() {
    var bar   = document.getElementById('catLabelBar');
    var left  = document.getElementById('catScrollLeft');
    var right = document.getElementById('catScrollRight');
    if (!bar || !left || !right) return;
    var scrollAmt = 90;
    left.onclick  = function() { bar.scrollLeft -= scrollAmt * 3; setTimeout(updateChipArrows, 350); };
    right.onclick = function() { bar.scrollLeft += scrollAmt * 3; setTimeout(updateChipArrows, 350); };
    bar.addEventListener('scroll', updateChipArrows, { passive: true });

    // タッチスクロール
    var _ts = 0, _tx = 0;
    bar.addEventListener('touchstart', function(e) {
      _ts = e.touches[0].clientX; _tx = bar.scrollLeft;
    }, { passive: true });
    bar.addEventListener('touchmove', function(e) {
      bar.scrollLeft = _tx - (e.touches[0].clientX - _ts);
    }, { passive: true });
    bar.addEventListener('touchend', function() { updateChipArrows(); }, { passive: true });

    setTimeout(updateChipArrows, 50);
  }

  // ピンボタン：カテゴリ選択モードで開く
  document.getElementById('categoryPinBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    openedViaPin = true;
    if (catSel.size === 0) {
      var NON_FOOD2 = ['コンビニ','ガソリン','宿泊','金融','教育','観光'];
      var hasFood      = markersData.some(function(d) { return !NON_FOOD2.includes(d.restaurant.genre) && d.visible; });
      var hasConbini   = markersData.some(function(d) { return d.restaurant.genre === 'コンビニ' && d.visible; });
      var hasGas       = markersData.some(function(d) { return d.restaurant.genre === 'ガソリン'  && d.visible; });
      var hasStay      = markersData.some(function(d) { return d.restaurant.genre === '宿泊'      && d.visible; });
      var hasFinance   = markersData.some(function(d) { return d.restaurant.genre === '金融'      && d.visible; });
      var hasEducation = markersData.some(function(d) { return d.restaurant.genre === '教育'      && d.visible; });
      var hasTourism   = markersData.some(function(d) { return d.restaurant.genre === '観光'      && d.visible; });
      if (hasFood || hasConbini || hasGas || hasStay || hasFinance || hasEducation || hasTourism) {
        if (hasFood)      { catSel.add('food');      btnFood.classList.add('cat-selected'); }
        if (hasConbini)   { catSel.add('conbini');   btnConbini.classList.add('cat-selected'); }
        if (hasGas)       { catSel.add('gas');        btnGas.classList.add('cat-selected'); }
        if (hasStay)      { catSel.add('stay');       document.getElementById('gearCatStay').classList.add('cat-selected'); }
        if (hasFinance)   { catSel.add('finance');    document.getElementById('gearCatFinance').classList.add('cat-selected'); }
        if (hasEducation) { catSel.add('education');  document.getElementById('gearCatEducation').classList.add('cat-selected'); }
        if (hasTourism)   { catSel.add('tourism');    document.getElementById('gearCatTourism').classList.add('cat-selected'); }
        updateAllBtn();
        updateClearBtn();
      } else {
        hideCatLabel();
        markersData.forEach(function(d) { d.hide(); });
        updateClearBtn();
      }
    } else {
      updateAllBtn();
      updateClearBtn();
    }
    // マーカータップを無効化
    map.getContainer().classList.add('markers-no-pointer');
    document.querySelector('header').style.display = 'none';
    menu.style.display = 'block';
    showCategory();
    overlay.classList.add('active', 'map-interactive');
    requestAnimationFrame(function () {
      var panelTop = menu.getBoundingClientRect().top;
      var px = Math.round((window.innerHeight - panelTop) / 2);
      if (px > 0) {
        savedPanPixels = px;
        map.panBy([0, px], { duration: 700 });
      }
    });

    var blocker = document.createElement('div');
    blocker.id = 'catModeBlocker';
    blocker.style.cssText = 'position:absolute;inset:0;z-index:700;background:transparent;pointer-events:auto;';
    blocker.addEventListener('click', function(e) { e.stopPropagation(); });
    document.getElementById('map').appendChild(blocker);
    document.getElementById('sideSwipeCtrl').style.zIndex = '1501';
    ['sideSwipeUp','sideSwipeDown','locateBtn','categoryPinBtn','gearBtn'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.style.opacity = '0.35'; el.style.pointerEvents = 'none'; }
    });
  });

  document.getElementById('gearBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    if (menu.style.display === 'none') { showMain(); } else { closeMenu(); }
  });

  document.getElementById('gearLangBtn').addEventListener('click', showLang);
  document.getElementById('gearListBtn').addEventListener('click', function () {
    openedViaPin = false;
    showCategory();
  });
  document.getElementById('gearCloseBtn').addEventListener('click', closeMenu);

  // 「すべて」ボタン
  btnAll.addEventListener('click', function () {
    if (!openedViaPin) return;
    ['food','conbini','gas','stay','finance','education','tourism'].forEach(function(k) { catSel.add(k); });
    [btnFood, btnConbini, btnGas,
     document.getElementById('gearCatStay'), document.getElementById('gearCatFinance'),
     document.getElementById('gearCatEducation'), document.getElementById('gearCatTourism')
    ].forEach(function(b) { if (b) b.classList.add('cat-selected'); });
    updateCatPreview();
  });

  // 「解除」ボタン
  btnClear.addEventListener('click', function () {
    if (!openedViaPin) return;
    catSel.clear();
    document.querySelectorAll('.cat-icon-btn').forEach(function(b) { b.classList.remove('cat-selected'); });
    markersData.forEach(function(d) { d.hide(); });
    updateAllBtn();
    updateClearBtn();
    updateCatLabel();
  });

  // 「閉じる」ボタン
  document.getElementById('gearCatBack').addEventListener('click', function () {
    updateCatLabel(true);
    document.querySelector('header').style.display = '';
    closeMenu();
  });

  // カテゴリ個別ボタン
  var CAT_BTN_MAP = {
    gearCatFood:      'food',
    gearCatConbini:   'conbini',
    gearCatGas:       'gas',
    gearCatStay:      'stay',
    gearCatFinance:   'finance',
    gearCatEducation: 'education',
    gearCatTourism:   'tourism',
  };
  Object.keys(CAT_BTN_MAP).forEach(function(btnId) {
    var catKey = CAT_BTN_MAP[btnId];
    var catBtn = document.getElementById(btnId);
    if (!catBtn) return;
    catBtn.addEventListener('click', function () {
      if (!openedViaPin) return;
      if (catSel.has(catKey)) { catSel.delete(catKey); catBtn.classList.remove('cat-selected'); }
      else                    { catSel.add(catKey);    catBtn.classList.add('cat-selected');    }
      updateCatPreview();
    });
  });

  // 言語ボタン
  document.getElementById('gearLangJa').addEventListener('click', function () { setLanguage('ja'); closeMenu(); });
  document.getElementById('gearLangEn').addEventListener('click', function () { setLanguage('en'); closeMenu(); });
  document.getElementById('gearLangZh') && document.getElementById('gearLangZh').addEventListener('click', function () { setLanguage('zh'); closeMenu(); });
  document.getElementById('gearLangBack').addEventListener('click', showMain);

  menu.addEventListener('click', function (e) { e.stopPropagation(); });

  document.getElementById('map').addEventListener('click', function () {
    if (menu.style.display !== 'none' && !openedViaPin) closeMenu();
  });

  // ── 石川全域ボタン ────────────────────────────────────────────
  (function () {
    var btn = document.getElementById('ishikawaBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (openedViaPin && savedPanPixels > 0) {
        map.flyTo({
          center:   ISHIKAWA_CENTER,
          zoom:     ISHIKAWA_ZOOM,
          offset:   [0, -(savedPanPixels / 2)],
          duration: 1000
        });
      } else {
        map.flyTo({ center: ISHIKAWA_CENTER, zoom: ISHIKAWA_ZOOM, duration: 1000 });
      }
    });
  })();
})();

// ── スマホ：タブバーのスワイプでヘッダー操作・情報パネル表示 ────────
(function () {
  const tabs = document.querySelector('.mobile-tabs');
  if (!tabs) return;
  let startY = 0;
  tabs.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; }, { passive: true });
  tabs.addEventListener('touchend', function (e) {
    const dy = e.changedTouches[0].clientY - startY;
    if (dy < -40) {
      document.body.classList.remove('header-collapsed');
    } else if (dy > 40) {
      const appBody = document.getElementById('appBody');
      if (appBody) appBody.dataset.view = 'info';
      document.body.classList.add('info-open');
    }
  }, { passive: true });
})();

// ── 左側スワイプボタン ────────────────────────────────────────────
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const upBtn   = document.getElementById('sideSwipeUp');
    const downBtn = document.getElementById('sideSwipeDown');
    if (!upBtn || !downBtn) return;
    upBtn.addEventListener('click', function () {
      document.body.classList.toggle('header-collapsed');
      if (typeof map !== 'undefined') setTimeout(() => map.resize(), 50);
    });
    downBtn.addEventListener('click', function () {
      const appBody = document.getElementById('appBody');
      if (appBody) { appBody.dataset.view = 'info'; document.body.classList.add('info-open'); }
    });
  });
})();

// ── 情報パネル ────────────────────────────────────────────────────
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const footer = document.getElementById('infoPanelFooter');
    if (!footer) return;
    function closeInfoPanel() {
      const appBody = document.getElementById('appBody');
      if (appBody) {
        appBody.dataset.view = 'map';
        document.body.classList.remove('info-open');
        setTimeout(() => { if (typeof map !== 'undefined') map.resize(); }, 50);
      }
    }
    document.querySelectorAll('.info-close-btn').forEach(function(btn) {
      btn.addEventListener('click', closeInfoPanel);
    });
    let startY = 0;
    footer.addEventListener('touchstart', function (e) { startY = e.touches[0].clientY; }, { passive: true });
    footer.addEventListener('touchend', function (e) {
      if (e.changedTouches[0].clientY - startY < -30) closeInfoPanel();
    }, { passive: true });
  });
})();

function openInfoSection(section) {
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
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    overlay.classList.add('hidden');
    return;
  }
  if (sessionStorage.getItem('authenticated') === '1') {
    overlay.classList.add('hidden');
    return;
  }
  document.getElementById('pwInput').focus();
})();

function checkPassword() {
  const input   = document.getElementById('pwInput');
  const errMsg  = document.getElementById('pwError');
  const overlay = document.getElementById('passwordOverlay');
  if (input.value === '321') {
    sessionStorage.setItem('authenticated', '1');
    overlay.classList.add('hidden');
    setTimeout(function() {
      if (window.goatcounter && typeof window.goatcounter.count === 'function') {
        window.goatcounter.count({ path: 'password-success', title: 'パスワード認証成功', event: true });
      }
    }, 500);
    setTimeout(() => {
      if (typeof map !== 'undefined') {
        map.jumpTo({ center: ISHIKAWA_CENTER, zoom: ISHIKAWA_ZOOM });
      }
    }, 500);
  } else {
    errMsg.textContent = 'パスワードが違います。もう一度入力してください。';
    input.value = '';
    input.focus();
  }
}

// ── 店舗データは restaurants-data.js で定義 ──

// ── 営業時間の省略表示 ────────────────────────────────────────────
function fmtHours(hours) {
  const lines = hours.split('\n');
  const first = lines[0];
  const more  = lines.length > 1;
  if (first.length > 24) return first.slice(0, 22) + '…';
  return more ? first + '…' : first;
}

// ── フィルター定義 ───────────────────────────────────────────────
const FILTERS = [
  { id: 'all',      label: 'すべて',       color: '#546e7a', test: g => g !== 'コンビニ' && g !== 'ガソリン' },
  { id: 'izakaya',  label: '居酒屋・食堂', color: '#e53935', test: g => g.includes('居酒屋') || g.includes('食堂') },
  { id: 'cafe',     label: 'カフェ',       color: '#00897b', test: g => g.includes('カフェ') },
  { id: 'yakiniku', label: '焼肉',         color: '#fb8c00', test: g => g.includes('焼肉') },
  { id: 'bar',      label: 'バル',         color: '#8e24aa', test: g => g.includes('バル') },
  { id: 'ramen',    label: 'ラーメン',     color: '#c62828', test: g => g.includes('ラーメン') },
  { id: 'conbini',  label: 'コンビニ',     color: '#0067CC', test: g => g === 'コンビニ', hidden: true },
  { id: 'gas',      label: 'ガソリン',     color: '#ff6f00', test: g => g === 'ガソリン', hidden: true },
];

let currentFilter = 'all';
let currentSearch  = '';

// ── カテゴリ別マーカーカラー ────────────────────────────────────
const FOOD_COLOR      = "#e53935";
const CONBINI_COLOR   = "#fb8c00";
const GAS_COLOR       = "#1565c0";
const STAY_COLOR      = "#7b1fa2";
const FINANCE_COLOR   = "#2e7d32";
const EDUCATION_COLOR = "#00695c";
const TOURISM_COLOR   = "#0097a7";
const DEFAULT_COLOR   = FOOD_COLOR;

function genreColor(genre) { return FOOD_COLOR; }

function markerColor(r) {
  if (r.genre === 'コンビニ') return CONBINI_COLOR;
  if (r.genre === 'ガソリン') return GAS_COLOR;
  if (r.genre === '宿泊')     return STAY_COLOR;
  if (r.genre === '金融')     return FINANCE_COLOR;
  if (r.genre === '教育')     return EDUCATION_COLOR;
  if (r.genre === '観光')     return TOURISM_COLOR;
  return FOOD_COLOR;
}

function gmapUrl(name, address) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(name + " " + address);
}

// ── ポップアップ HTML 生成 ────────────────────────────────────────
function makePopup(r, idx) {
  const hoursHtml  = rHours(r).replace(/\n/g, "<br>");
  const closedVal  = rClosed(r);
  const closedHtml = (r.closed && r.closed.includes("要確認"))
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
        <button class="popup-close-side" onclick="closeCurrentPopup()">×</button>
        <div class="popup-btns-col">
          <a href="${gmapUrl(r.name, r.address)}"
             target="_blank" rel="noopener noreferrer"
             class="popup-btn gmap">${t('popup.gmap')}</a>
          <a href="detail.html#${idx}"
             class="popup-btn source">${t('popup.detail')}</a>
        </div>
        <button class="popup-close-side" onclick="closeCurrentPopup()">×</button>
      </div>
    </div>`;
}

// ── 地図初期化（MapLibre GL JS） ─────────────────────────────────
// ※ 座標は MapLibre 標準の [lng, lat] 順
const ISHIKAWA_CENTER = [127.828, 26.430];
const ISHIKAWA_ZOOM   = window.innerWidth <= 767 ? 13 : 14;

const map = new maplibregl.Map({
  container:         'map',
  style:             'https://tiles.openfreemap.org/styles/liberty',
  center:            ISHIKAWA_CENTER,
  zoom:              ISHIKAWA_ZOOM,
  maxZoom:           17,
  attributionControl: false,
});

// ズームコントロール：スマホ→左下、PC→左上
map.addControl(
  new maplibregl.NavigationControl({ showCompass: false }),
  window.innerWidth <= 767 ? 'bottom-left' : 'top-left'
);
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

// ── ポップアップ管理 ─────────────────────────────────────────────
let _currentPopup   = null;
let _currentPopupEl = null;

function closeCurrentPopup() {
  if (_currentPopup) { _currentPopup.remove(); _currentPopup = null; }
  if (_currentPopupEl) { _currentPopupEl.classList.remove('marker-active-pulse'); _currentPopupEl = null; }
  document.body.classList.remove('popup-open');
  if (window._updateMiniTarget) window._updateMiniTarget(null);
}

// 地図クリックでポップアップを閉じる
map.on('click', function() { closeCurrentPopup(); });

// ── 石川エリア境界座標（[lng, lat] 順） ────────────────────────
const ISHIKAWA_POLYGON_COORDS = [
  [127.803, 26.453], [127.819, 26.452], [127.831, 26.449],
  [127.841, 26.442], [127.845, 26.437], [127.846, 26.430],
  [127.843, 26.419], [127.840, 26.413], [127.833, 26.408],
  [127.822, 26.402], [127.813, 26.400], [127.804, 26.406],
  [127.800, 26.420], [127.801, 26.436],
  [127.803, 26.453],
];

// 地図ロード後に境界線を追加
map.on('load', function() {
  map.addSource('ishikawa-boundary', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: ISHIKAWA_POLYGON_COORDS }
    }
  });
  map.addLayer({
    id: 'ishikawa-boundary-line',
    type: 'line',
    source: 'ishikawa-boundary',
    paint: { 'line-color': '#e53935', 'line-width': 3, 'line-opacity': 0.85 }
  });

  // ── 道路幅をズームに比例して拡大（Googleマップ相当） ───────────
  // 現在のスタイルはズーム20でも18px程度と細すぎるため、
  // ズームアップするほど道路が広く見えるよう全レイヤーを再設定する
  // 各ズームで約2倍ずつ拡大（Googleマップと同等のスケール）
  const roadWidthMap = {
    'road_motorway':                  ['interpolate', ['linear'], ['zoom'], 7,1,  12,2,  14,6,  16,20,  18,65,  20,200],
    // casing = fill と同幅にして内側への白線を消す（デュアルキャリッジウェイ対策）
    'road_motorway_casing':           ['interpolate', ['linear'], ['zoom'], 7,1,  12,2,  14,6,  16,20,  18,65,  20,200],
    'road_motorway_link':             ['interpolate', ['linear'], ['zoom'],       12,1.5,14,4,  16,14,  18,46,  20,145],
    'road_motorway_link_casing':      ['interpolate', ['linear'], ['zoom'],       12,1.5,14,4,  16,14,  18,46,  20,145],
    'road_trunk_primary':             ['interpolate', ['linear'], ['zoom'], 7,1,  12,2,  14,6,  16,20,  18,65,  20,200],
    'road_trunk_primary_casing':      ['interpolate', ['linear'], ['zoom'], 7,1,  12,2,  14,6,  16,20,  18,65,  20,200],
    'road_secondary_tertiary':        ['interpolate', ['linear'], ['zoom'], 8,0.5,12,1.5,14,4.5,16,15,  18,48,  20,148],
    'road_secondary_tertiary_casing': ['interpolate', ['linear'], ['zoom'], 8,1,  12,2.5,14,7,  16,21,  18,58,  20,163],
    'road_minor':                     ['interpolate', ['linear'], ['zoom'],       12,0.5,14,2.5,16,9,   18,28,  20,88],
    'road_minor_casing':              ['interpolate', ['linear'], ['zoom'],       12,1,  14,4,  16,13,  18,37,  20,103],
    'road_link':                      ['interpolate', ['linear'], ['zoom'],       12,1,  14,3,  16,10,  18,33,  20,103],
    'road_link_casing':               ['interpolate', ['linear'], ['zoom'],       12,1.5,14,4.5,16,14,  18,42,  20,118],
    'road_service_track':             ['interpolate', ['linear'], ['zoom'],             14,1,  16,4.5, 18,14,  20,44],
    'road_service_track_casing':      ['interpolate', ['linear'], ['zoom'],             14,1.5,16,6.5, 18,20,  20,60],
    'road_path_pedestrian':           ['interpolate', ['linear'], ['zoom'],             14,0.5,16,2.5, 18,8,   20,25],
  };
  Object.entries(roadWidthMap).forEach(function([id, width]) {
    if (map.getLayer(id)) map.setPaintProperty(id, 'line-width', width);
  });

  // 道路沿いの歩道点線を非表示
  ['road_path_pedestrian', 'tunnel_path_pedestrian',
   'bridge_path_pedestrian', 'bridge_path_pedestrian_casing'].forEach(function(id) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  });
});

// ── ミニマップ ────────────────────────────────────────────────────
(function () {
  const miniMapEl = document.getElementById('minimap');
  if (!miniMapEl) return;

  const miniMap = new maplibregl.Map({
    container: 'minimap',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
    },
    center:             ISHIKAWA_CENTER,
    zoom:               12,
    interactive:        false,
    attributionControl: false,
  });

  miniMap.on('load', function() {
    miniMap.addSource('boundary', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: ISHIKAWA_POLYGON_COORDS }
      }
    });
    miniMap.addLayer({
      id: 'boundary-line',
      type: 'line',
      source: 'boundary',
      paint: { 'line-color': '#e53935', 'line-width': 2, 'line-opacity': 0.9 }
    });
  });

  const miniTargetEl = document.createElement('div');
  miniTargetEl.className = 'mini-target-icon';
  miniTargetEl.style.cssText = 'position:absolute;z-index:1000;transform:translate(-50%,-50%);pointer-events:none;';
  miniMapEl.appendChild(miniTargetEl);

  let _targetLng = ISHIKAWA_CENTER[0];
  let _targetLat = ISHIKAWA_CENTER[1];

  function updateMiniTarget(lngLat) {
    if (lngLat) { _targetLng = lngLat[0]; _targetLat = lngLat[1]; }
    const pt  = miniMap.project([_targetLng, _targetLat]);
    const w   = miniMapEl.clientWidth;
    const h   = miniMapEl.clientHeight;
    const inset = 2;
    const x = Math.max(inset, Math.min(w - inset, pt.x));
    const y = Math.max(inset, Math.min(h - inset, pt.y));
    miniTargetEl.style.left = x + 'px';
    miniTargetEl.style.top  = y + 'px';
  }
  window._updateMiniTarget = updateMiniTarget;

  map.on('move', function() {
    if (!_currentPopup) {
      const c = map.getCenter();
      _targetLng = c.lng; _targetLat = c.lat;
      updateMiniTarget();
    }
  });

  function resetMinimap() {
    miniMap.resize();
    miniMap.setCenter(ISHIKAWA_CENTER);
    miniMap.setZoom(12);
    updateMiniTarget();
  }
  setTimeout(resetMinimap, 300);
  setTimeout(resetMinimap, 800);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) setTimeout(resetMinimap, 200);
  });
  window.addEventListener('resize', function() { setTimeout(resetMinimap, 150); });
  window._resetMinimap = resetMinimap;

  miniMapEl.addEventListener('click', function(e) { e.stopPropagation(); });
})();

// ── マーカー生成 ─────────────────────────────────────────────────
function makePinSVG(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 42" width="30" height="42">
    <path d="M15 1C8.1 1 2.5 6.6 2.5 13.5C2.5 22.9 15 41 15 41
             C15 41 27.5 22.9 27.5 13.5C27.5 6.6 21.9 1 15 1Z"
          fill="${color}" stroke="white" stroke-width="2.2"/>
    <circle cx="15" cy="13.5" r="5.5" fill="white" opacity="0.92"/>
  </svg>`;
}

const markersData = restaurants.map((r, idx) => {
  const color = markerColor(r);

  // マーカーのルート要素（MapLibreが position:absolute を付与するため position は設定しない）
  const root = document.createElement('div');
  root.style.cssText = 'width:30px;height:42px;cursor:pointer;';

  // ピン＋ラベルの内部ラッパー（position:relative でラベルを相対配置）
  const pinInner = document.createElement('div');
  pinInner.className = 'pin-root';
  pinInner.style.cssText = 'position:relative;width:30px;height:42px;';

  // SVGアニメーションラッパー
  const pinWrap = document.createElement('div');
  pinWrap.className = 'pin-anim-wrap';
  pinWrap.innerHTML = makePinSVG(color);
  pinInner.appendChild(pinWrap);

  // 店名ラベル
  const label = document.createElement('div');
  label.className = 'shop-label';
  label.textContent = r.name;
  pinInner.appendChild(label);

  root.appendChild(pinInner);

  // ポップアップ
  const popup = new maplibregl.Popup({
    closeButton:  false,
    closeOnClick: false,
    maxWidth:     '320px',
    anchor:       'bottom',
    offset:       [0, -48],
    className:    'ishikawa-popup'
  }).setHTML(makePopup(r, idx));

  // MapLibreマーカー（anchor='bottom'：ピン先端が座標に一致）
  const marker = new maplibregl.Marker({ element: root, anchor: 'bottom' })
    .setLngLat([r.lng, r.lat])
    .addTo(map);

  let _visible = true;

  // ── ポップアップを開く ──────────────────────────────────────────
  function openThisPopup() {
    closeCurrentPopup();
    setActiveItem(idx);

    function doOpen() {
      popup.setLngLat([r.lng, r.lat]).addTo(map);
      _currentPopup   = popup;
      _currentPopupEl = root;
      root.classList.add('marker-active-pulse');
      document.body.classList.add('popup-open');
      if (window._updateMiniTarget) window._updateMiniTarget([r.lng, r.lat]);

      // デスクトップ：ポップアップが見切れないようパン
      if (window.innerWidth > 767) {
        setTimeout(function() {
          const popupEl = popup.getElement();
          const mapEl   = map.getContainer();
          if (!popupEl || !mapEl) return;
          const pr = popupEl.getBoundingClientRect();
          const mr = mapEl.getBoundingClientRect();
          const pad = 10;
          let dx = 0, dy = 0;
          if (pr.top    < mr.top    + pad) dy = pr.top    - mr.top    - pad;
          if (pr.bottom > mr.bottom - pad) dy = pr.bottom - mr.bottom + pad;
          if (pr.left   < mr.left   + pad) dx = pr.left   - mr.left   - pad;
          if (pr.right  > mr.right  - pad) dx = pr.right  - mr.right  + pad;
          if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: 300 });
        }, 80);
      }
    }

    // スマホ：ヘッダーを折りたたんでからポップアップを開く
    if (window.innerWidth <= 767 && !document.body.classList.contains('header-collapsed')) {
      document.body.classList.add('header-collapsed');
      map.resize();
      setTimeout(doOpen, 380);
    } else {
      doOpen();
    }
  }

  // ── タップ/クリック処理 ────────────────────────────────────────
  if ('ontouchstart' in window) {
    let _startX = 0, _startY = 0, _tapTimer = null;
    root.addEventListener('touchstart', function(e) {
      _startX = e.touches[0].clientX;
      _startY = e.touches[0].clientY;
    }, { passive: true });
    root.addEventListener('touchmove', function(e) {
      if (!_tapTimer) return;
      const dx = Math.abs(e.touches[0].clientX - _startX);
      const dy = Math.abs(e.touches[0].clientY - _startY);
      if (dx > 10 || dy > 10) { clearTimeout(_tapTimer); _tapTimer = null; }
    }, { passive: true });
    root.addEventListener('touchend', function(e) {
      const dx = Math.abs(e.changedTouches[0].clientX - _startX);
      const dy = Math.abs(e.changedTouches[0].clientY - _startY);
      if (dx > 10 || dy > 10) return;
      e.preventDefault();
      e.stopPropagation();
      if (_tapTimer) {
        clearTimeout(_tapTimer); _tapTimer = null;
        map.easeTo({ zoom: map.getZoom() + 1, duration: 300 });
        return;
      }
      _tapTimer = setTimeout(function() { _tapTimer = null; openThisPopup(); }, 300);
    }, { passive: false });
  } else {
    root.addEventListener('click', function(e) { e.stopPropagation(); openThisPopup(); });
  }

  // ラベルクリックでもポップアップを開く
  label.addEventListener('click', function(e) { e.stopPropagation(); openThisPopup(); });

  return {
    restaurant: r,
    marker,
    root,
    popup,
    idx,
    get visible() { return _visible; },
    show() { if (!_visible) { marker.addTo(map); _visible = true; } },
    hide() {
      if (_visible) {
        if (_currentPopup === popup) closeCurrentPopup();
        marker.remove();
        _visible = false;
      }
    },
    openPopup: openThisPopup
  };
});

// ── 店名ラベル表示/非表示 ────────────────────────────────────────
let labelsVisible = window.innerWidth > 767;

if (window.innerWidth <= 767) {
  map.getContainer().classList.add('labels-hidden');
}

function toggleLabels() {
  labelsVisible = !labelsVisible;
  map.getContainer().classList.toggle('labels-hidden', !labelsVisible);
  const btn = document.getElementById('bottomLabelBtn');
  if (btn) btn.textContent = labelsVisible ? '店名を隠す' : '店名を表示';
}

// PC用：店名ラベルトグルボタン
if (window.innerWidth > 767) {
  map.addControl({
    onAdd: function() {
      const btn = document.createElement('button');
      btn.className = 'label-toggle-btn';
      btn.innerHTML = '店名を隠す';
      btn.title = '店名ラベルの表示／非表示';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        labelsVisible = !labelsVisible;
        map.getContainer().classList.toggle('labels-hidden', !labelsVisible);
        btn.innerHTML = labelsVisible ? '店名を隠す' : '店名を表示';
      });
      return btn;
    },
    onRemove: function() {}
  }, 'top-left');
}

// ── 凡例コントロール ─────────────────────────────────────────────
const legendItems = [
  { color: "#e53935", label: "居酒屋・食堂" },
  { color: "#00897b", label: "カフェ"       },
  { color: "#fb8c00", label: "焼肉"         },
  { color: "#8e24aa", label: "バル"         },
  { color: "#1565c0", label: "その他"       },
];
map.addControl({
  onAdd: function() {
    const div = document.createElement('div');
    div.className = 'map-legend';
    div.innerHTML =
      `<div class="legend-title">ジャンル</div>` +
      legendItems.map(item =>
        `<div class="legend-item">
           <span class="legend-dot" style="background:${item.color}"></span>
           ${item.label}
         </div>`
      ).join('') +
      `<hr class="legend-sep">
       <div class="legend-warn-note">🔶 ピン = 要確認店舗</div>`;
    return div;
  },
  onRemove: function() {}
}, 'bottom-left');

// ── フィルターボタン生成 ─────────────────────────────────────────
function buildFilterButtons() {
  const container = document.getElementById('filterButtons');
  container.innerHTML = '';
  FILTERS.forEach(f => {
    if (f.hidden) return;
    const btn = document.createElement('button');
    btn.className   = 'filter-btn' + (f.id === currentFilter ? ' active' : '');
    btn.textContent = t('filter.' + f.id);
    btn.style.setProperty('--fc', f.color);
    btn.setAttribute('data-filter', f.id);
    btn.addEventListener('click', () => applyFilter(f.id));
    container.appendChild(btn);
  });
}

// ── 表示判定 ─────────────────────────────────────────────────────
function isVisible(r) {
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
  var catWrapper = document.getElementById('catLabelWrapper');
  if (catWrapper) catWrapper.style.display = 'none';

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterId);
  });

  markersData.forEach(d => {
    if (isVisible(d.restaurant)) d.show(); else d.hide();
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
    const warnBadge   = r.warn ? `<span class="warn-badge">要確認</span>` : '';
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
function focusShop(idx) {
  const data = markersData[idx];
  if (!data) return;

  switchTab('map');
  setActiveItem(idx);

  const r = data.restaurant;
  setTimeout(() => {
    closeCurrentPopup();
    map.stop();

    // ポップアップ（ピン上方）が見えるよう画面下寄りに表示
    map.flyTo({
      center:   [r.lng, r.lat],
      zoom:     16,
      offset:   [0, 120],
      duration: 800
    });

    map.once('moveend', function() {
      data.openPopup();
    });
  }, 200);
}

// ── アクティブ店舗ハイライト ─────────────────────────────────────
function setActiveItem(idx) {
  document.querySelectorAll('.shop-item').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.idx) === idx);
  });
  const activeEl = document.querySelector(`.shop-item[data-idx="${idx}"]`);
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ── タブ切り替え ─────────────────────────────────────────────────
function switchTab(tab) {
  const appBody = document.getElementById('appBody');
  appBody.dataset.view = tab;

  document.getElementById('tabMap').classList.toggle('active',  tab === 'map');
  document.getElementById('tabMap').setAttribute('aria-selected', tab === 'map');
  document.getElementById('tabList').classList.toggle('active', tab === 'list');
  document.getElementById('tabList').setAttribute('aria-selected', tab === 'list');

  const bMap  = document.getElementById('bottomTabMap');
  const bList = document.getElementById('bottomTabList');
  if (bMap)  bMap.classList.toggle('active',  tab === 'map');
  if (bList) bList.classList.toggle('active', tab === 'list');

  if (tab === 'map') setTimeout(() => map.resize(), 50);
}

// ── 検索ボックス初期化 ──────────────────────────────────────────
function initSearch() {
  const input    = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');

  function applySearch() {
    currentSearch   = input.value.trim();
    clearBtn.hidden = (currentSearch === '');
    markersData.forEach(d => {
      if (isVisible(d.restaurant)) d.show(); else d.hide();
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
