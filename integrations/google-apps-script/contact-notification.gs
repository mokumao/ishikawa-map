// 新しい独立したApps Scriptプロジェクトに設置する。
// 既存の削除依頼・再表示用Apps Scriptへ上書きしない。
// プロパティ CONTACT_MAIL_TOKEN と ADMIN_EMAIL を設定する。
function doPost(event) {
  var input;
  try { input = JSON.parse(event.postData.contents); } catch (_) { return result_({ ok: false }); }
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('CONTACT_MAIL_TOKEN');
  var recipient = props.getProperty('ADMIN_EMAIL');
  if (!secret || secret.length < 32 || !recipient || input.token !== secret || !/^[a-f0-9-]{36}$/.test(input.contactId || '')) return result_({ ok: false });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return result_({ ok: false });
  try {
    var key = 'sent:' + input.contactId;
    var cache = CacheService.getScriptCache();
    if (!cache.get(key)) {
      MailApp.sendEmail({
        to: recipient,
        subject: '【石川マップ】店舗主からのご連絡が届きました',
        body: '新しい連絡を受け付けました。\n受付番号：' + input.contactId +
          '\n\n管理者としてログインして内容をご確認ください。\nhttps://ishikawa-map-admin-notices.shinzatoisao1969.workers.dev/contacts\n\n連絡本文とメールアドレスは、この通知には含めていません。'
      });
      cache.put(key, 'sent', 21600);
    }
    return result_({ ok: true, contactId: input.contactId });
  } finally { lock.releaseLock(); }
}
function result_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }

// エディタで一度だけ実行する。秘密値はログへ出力しない。
function setupContactNotifications() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CONTACT_MAIL_TOKEN')) props.setProperty('CONTACT_MAIL_TOKEN', Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty('ADMIN_EMAIL')) throw new Error('スクリプトプロパティにADMIN_EMAILを設定してください。');
  MailApp.getRemainingDailyQuota();
}
