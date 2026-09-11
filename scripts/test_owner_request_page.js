const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'owner-request.html'), 'utf8');
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);

assert(inlineScript, 'ページ内のJavaScriptを取得できること');
new Function(inlineScript[1]);

assert(html.includes('id="editHoursStartHour"'), '開始時刻の時を1時間単位で選べること');
assert(html.includes('id="editHoursStartMinute"'), '開始時刻の分を選べること');
assert(html.includes("var minutes = ['00', '10', '20', '30', '40', '50']"), '分の選択肢が10分刻みであること');
assert(html.includes('id="editHoursEndHour"'), '終了時刻の時を1時間単位で選べること');
assert(html.includes('id="editHoursEndMinute"'), '終了時刻の分を選べること');
assert(html.includes('hasIncompleteHoursRange'), '開始・終了の片方だけの入力を検出すること');
assert(html.includes('営業時間は開始時間と終了時間を両方選んでください。'), '不完全な営業時間の案内があること');
assert(!html.includes('id="editTel"'), '電話番号の修正欄がないこと');
assert(!html.includes('for="editHours"'), '存在しない営業時間入力欄をラベルが参照しないこと');

console.log('owner-request page tests: OK');
