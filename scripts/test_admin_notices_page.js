const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'admin', 'notices.html'), 'utf8');

assert(
  html.includes('#editorTitle { color: var(--red); }')
    && html.includes('<h2 id="editorTitle">新規入力</h2>')
    && html.includes("editorTitle.textContent = '新規入力';"),
  '新規入力の見出しを赤色で表示すること',
);
assert(
  html.includes('<div class="new-entry-row">')
    && html.includes('class="button new-entry-button" id="resetButton"')
    && html.includes('.new-entry-row { display: flex; flex: 1 1 100%; justify-content: flex-end; }')
    && /\.actions \.new-entry-button\s*\{[\s\S]*?background: var\(--green\);[\s\S]*?color: #fff;/.test(html),
  '新規入力ボタンを操作欄の右下に置き、緑背景の白文字で表示すること',
);
assert(
  html.includes('<span class="editor-status" id="editorStatus" hidden></span>')
    && html.includes("editorTitle.textContent = '既存のお知らせを編集';")
    && html.includes("published: '公開中', scheduled: '公開中', draft: '下書き', hidden: '非公開', expired: '掲載期間終了'")
    && html.includes('editorStatus.hidden = false;')
    && html.includes('editorStatus.hidden = true;')
    && html.includes("publishButton.textContent = '修正して公開する（上書き）';")
    && html.includes("publishButton.textContent = '公開する';")
    && /\.editor-status\s*\{[\s\S]*?background: var\(--blue\);[\s\S]*?color: #fff;/.test(html),
  '既存投稿では見出しと公開ボタンを編集用表示へ切り替え、新規入力時は元へ戻すこと',
);
assert(
  html.includes('id="publishAsNewButton"')
    && html.includes('修正して公開する（新規で）')
    && html.includes("publishAsNewButton.addEventListener('click', function () { save('published', true); });")
    && html.includes("var id = createNew ? '' : value('noticeId');")
    && html.includes('if (createNew) delete requestBody.revision;')
    && html.includes("method: id ? 'PUT' : 'POST'"),
  '既存投稿を上書きする操作と、元を残して新規投稿する操作を分けること',
);
assert(
  html.includes('.publish-buttons { display: flex; max-width: 100%; flex-direction: column; gap: 8px; }')
    && html.includes('.actions .publish-buttons .button { flex: 0 0 auto; }')
    && html.includes('.actions { display: flex; flex-wrap: wrap; align-items: flex-start;'),
  '2つの公開ボタンを縦並びにし、左右の操作ボタンは従来の高さを保つこと',
);
const inlineScripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g));

assert(inlineScripts.length >= 2, '管理画面のJavaScriptを取得できること');
new Function(inlineScripts[inlineScripts.length - 1][1]);

assert(
  html.includes("document.getElementById('noticeId').value = item.id;"),
  '投稿選択時にAPIのidを編集対象IDとして保持すること',
);
assert(
  !html.includes("['noticeId', 'revision', 'regionId', 'title', 'body', 'category']"),
  '存在しないitem.noticeIdを参照しないこと',
);
assert(
  html.includes("if (!value('noticeId')) return;"),
  '非公開操作は選択済み投稿だけに限定すること',
);
assert(
  html.includes('hideConfirm.hidden = false;'),
  '非公開を確定する前にページ内確認を表示すること',
);
assert(
  html.includes("if (item.startsAt && new Date(item.startsAt) > current) return 'scheduled';"),
  '掲載開始前の公開設定を公開予定として扱うこと',
);
assert(
  html.includes("if (item.endsAt && new Date(item.endsAt) < current) return 'expired';"),
  '掲載終了後の公開設定を掲載期間終了として扱うこと',
);
assert(
  html.includes("scheduled: '公開予定', expired: '掲載期間終了'"),
  '実際の掲載期間に応じた日本語ラベルを表示すること',
);
assert(
  html.includes("return itemStatus === 'expired' || itemStatus === 'hidden';"),
  '掲載期間終了と非公開を過去の投稿として扱うこと',
);
assert(
  html.includes("showPast ? '過去の投稿を隠す' : '過去の投稿を見る（' + pastCount + '件）'"),
  '過去の投稿を件数付きで開閉できること',
);
assert(
  html.includes("var visibleNotices = notices.filter(function (item) { return showPast || !isPastNotice(item); });"),
  '初期表示では過去の投稿を一覧から除外すること',
);
assert(
  html.includes('id="togglePastButton"') && html.includes('aria-expanded="false"'),
  '過去の投稿を開閉する操作に展開状態が設定されていること',
);
assert(
  html.includes('.list-actions .button[hidden] { display: none; }'),
  '過去の投稿がないときは切替ボタンを確実に隠すこと',
);
assert(
  html.includes('<h2 id="listTitle">お知らせ一覧</h2>')
    && html.includes('<p class="list-summary" id="listSummary">（公開中・公開予定・下書き）</p>'),
  'お知らせ一覧の右側に初期表示対象を案内すること',
);
assert(
  html.includes('.list-summary { margin: 0; color: var(--red); font-size: 14px;'),
  '一覧の表示対象案内を少し大きな赤文字にすること',
);
assert(
  html.includes('.list-head { display: flex; align-items: center; justify-content: flex-start; gap: 8px; }')
    && html.includes('font-weight: 700; text-align: left; }'),
  '一覧の表示対象案内をお知らせ一覧見出しのすぐ右側に配置すること',
);
assert(
  html.includes("? '（公開中・公開予定・下書き・掲載期間終了・非公開）'")
    && html.includes(": '（公開中・公開予定・下書き）';"),
  '過去の投稿の表示状態に合わせて一覧の案内を切り替えること',
);
assert(
  html.includes("deleteButton.textContent = '削除';")
    && html.includes("message.textContent = '投稿を削除しますか？';")
    && html.includes("okButton.textContent = 'OK';"),
  '各投稿に削除ボタンとページ内確認を表示すること',
);
assert(
  html.includes("'/delete', { method: 'POST' }")
    && html.includes("if (value('noticeId') === item.id) resetForm();"),
  '削除確定後に論理削除APIを呼び、編集中の投稿ならフォームを初期化すること',
);
assert(
  html.includes("if (event.target === article && event.key === 'Enter') editNotice(item.id);"),
  '削除ボタンのキーボード操作で投稿編集を誤って開かないこと',
);
assert(
  html.includes('grid-template-columns: minmax(0, 1fr);')
    && html.includes('.notice-title { margin: 4px 0; overflow-wrap: anywhere;'),
  '長い投稿タイトルでも削除ボタンを画面外へ押し出さないこと',
);
assert(
  html.includes("body.className = 'notice-body'; body.textContent = item.body || '';")
    && html.includes('if (item.body) article.appendChild(body);')
    && html.includes('white-space: pre-wrap;'),
  'お知らせ一覧に本文を改行保持・長文折り返しで表示すること',
);
assert(
  html.includes('padding: 12px 16px;')
    && html.includes('.notice-footer { display: flex; flex-wrap: wrap;')
    && html.includes('footer.append(meta, deleteArea);'),
  '投稿内容を切らずに投稿カードの縦余白を短くすること',
);
assert(
  html.includes("deleteArea.classList.add('is-confirming');")
    && html.includes("deleteArea.classList.remove('is-confirming');"),
  '削除確認中だけ確認欄を投稿カードの横幅に広げること',
);
assert(
  html.includes('.notice-meta { min-width: 0; flex: 1 1 180px; margin: 0; color: var(--blue-dark); font-size: 16px;'),
  '投稿の分類と更新日時を16pxの濃い青文字で表示すること',
);
assert(
  html.includes('.notice[data-status="published"] .badge { background: var(--green); color: #fff; }'),
  'お知らせ一覧の公開中ラベルを緑背景の白文字で表示すること',
);
assert(
  html.includes('.notice[data-status="expired"] .badge { background: var(--red); color: #fff; }'),
  'お知らせ一覧の掲載期間終了ラベルを赤背景の白文字で表示すること',
);
assert(
  html.includes("timeZone: 'Asia/Tokyo'")
    && html.includes("formatJst(item.updatedAt)")
    && html.includes("return parts.year + '-' + parts.month + '-' + parts.day + ' ' + parts.hour + ':' + parts.minute;"),
  'D1のUTC更新日時を日本時間の年月日時分へ変換して表示すること',
);
assert(
  /<div class="list-head">[\s\S]*?<\/div>\s*<div class="list-actions">/.test(html),
  '一覧の操作ボタンを見出しの下段に配置すること',
);

console.log('admin notices page tests: OK');
