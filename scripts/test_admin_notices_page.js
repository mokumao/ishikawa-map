const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'admin', 'notices.html'), 'utf8');
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

console.log('admin notices page tests: OK');
