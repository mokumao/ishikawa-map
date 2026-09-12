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
assert(html.includes('class="time-wheel-trigger"'), '時刻欄がホイール選択画面を開くこと');
assert(html.includes('id="timeWheelPicker"'), '時刻用ホイール画面があること');
assert(html.includes('scroll-snap-type: y mandatory'), 'ホイールが中央の選択行へ止まること');
assert(html.includes('function openTimeWheel(trigger)'), '開始・終了時刻で同じホイールを使用できること');
assert(!html.includes('id="editHoursNote" required'), '営業時間の補足が任意入力であること');
assert(html.includes('曜日別・昼夜営業などの補足 <span class="optional">（任意）</span>'), '営業時間の補足に任意表示があること');
assert(html.includes('id="emailRequirement">（任意）</span>'), 'メールアドレスが初期状態では任意表示であること');
assert(!html.includes('id="ownerEmail" required'), 'メールアドレスが全依頼共通の必須入力ではないこと');
assert(html.includes("var isRequired = selectedType === 'edit';"), '修正依頼だけメールアドレスが必須になること');
assert(html.includes("emailRequirement.textContent = isRequired ? '（必須）' : '（任意）';"), '依頼種別で必須・任意表示が切り替わること');
assert(html.includes('メール連絡を希望しない場合は、メールアドレスの入力は不要です。'), '任意時のメール案内が表示されること');
assert(html.includes('id="emailError" role="alert" hidden>メールアドレスを入力してください。'), 'メール未入力時のエラー表示があること');
assert(html.includes('function blockMissingEmail()'), 'メール未入力時に送信を止めること');
assert(html.includes('hasIncompleteHoursRange'), '開始・終了の片方だけの入力を検出すること');
assert(html.includes('営業時間は開始時間と終了時間を両方選んでください。'), '不完全な営業時間の案内があること');
assert(!html.includes('id="editTel"'), '電話番号の修正欄がないこと');
assert(!html.includes('for="editHours"'), '存在しない営業時間入力欄をラベルが参照しないこと');

console.log('owner-request page tests: OK');
