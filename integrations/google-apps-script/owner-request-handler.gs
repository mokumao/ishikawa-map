// 石川マップ 店舗主依頼連携
// このファイルを「石川マップ ご意見・ご要望」のフォームに紐づく
// Google Apps Scriptへ貼り付け、setupOwnerRequestAutomation()を一度実行する。

const OWNER_REQUEST_HANDLER = 'ownerRequestOnFormSubmit';
const GITHUB_DISPATCH_URL = 'https://api.github.com/repos/mokumao/ishikawa-map/dispatches';
const ADMIN_RESTORE_CACHE_PREFIX = 'admin-restore:';
const ADMIN_RESTORE_CACHE_SECONDS = 600;

function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  if (parameters.action !== 'restore') {
    return renderAdminRestorePage_('操作を確認できませんでした', '<p>管理者ページから再度お試しください。</p>');
  }

  const storeId = String(parameters.store_id || '');
  const storeName = String(parameters.store_name || '');
  if (!/^\d{1,6}$/.test(storeId) || !storeName || storeName.length > 200) {
    return renderAdminRestorePage_('店舗情報を確認できませんでした', '<p>管理者ページから再度お試しください。</p>');
  }

  const nonce = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(
    ADMIN_RESTORE_CACHE_PREFIX + nonce,
    JSON.stringify({ storeId: storeId, storeName: storeName }),
    ADMIN_RESTORE_CACHE_SECONDS
  );

  const safeName = escapeHtml_(storeName);
  const body =
    '<p class="store-name">' + safeName + '</p>' +
    '<p>本当に地図に再表示しますか？</p>' +
    '<p class="note">実行するとGitHubの自動処理が始まり、通常は数分後に地図へ反映されます。</p>' +
    '<form method="post">' +
      '<input type="hidden" name="nonce" value="' + escapeHtml_(nonce) + '">' +
      '<button type="submit">地図に再表示する</button>' +
    '</form>' +
    '<button type="button" class="cancel" onclick="window.close()">キャンセル</button>';
  return renderAdminRestorePage_('店舗を再表示', body);
}

function doPost(event) {
  const nonce = String(event && event.parameter && event.parameter.nonce || '');
  if (!/^[a-f0-9]{32}$/.test(nonce)) {
    return renderAdminRestorePage_('再表示を受け付けられませんでした', '<p>確認情報が正しくありません。管理者ページから再度お試しください。</p>');
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = ADMIN_RESTORE_CACHE_PREFIX + nonce;
  const saved = cache.get(cacheKey);
  cache.remove(cacheKey);
  if (!saved) {
    return renderAdminRestorePage_('確認の有効期限が切れました', '<p>管理者ページから再度「再表示」を押してください。</p>');
  }

  const request = JSON.parse(saved);
  const requestRef = sha256_(nonce + '|' + new Date().toISOString() + '|' + request.storeId).slice(0, 24);
  try {
    dispatchGitHub_('admin_restore_request', {
      store_id: request.storeId,
      request_ref: requestRef,
    });
    notifyAdmin_(
      '【石川マップ】管理者が店舗の再表示を実行しました',
      '店舗番号：' + request.storeId + '\n店舗名：' + request.storeName + '\n受付番号：' + requestRef + '\nGitHubへ再表示処理を依頼しました。'
    );
    return renderAdminRestorePage_(
      '再表示を受け付けました',
      '<p class="store-name">' + escapeHtml_(request.storeName) + '</p>' +
      '<p>通常は数分後に地図へ反映されます。</p>' +
      '<button type="button" onclick="window.close()">管理者ページへ戻る</button>'
    );
  } catch (error) {
    notifyAdmin_(
      '【要確認・石川マップ】管理者による再表示処理に失敗しました',
      '店舗番号：' + request.storeId + '\n店舗名：' + request.storeName + '\nエラー：' + String(error)
    );
    throw error;
  }
}

function setupOwnerRequestAutomation() {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty('GITHUB_TOKEN');
  const adminEmail = properties.getProperty('ADMIN_EMAIL');
  if (!token) throw new Error('スクリプトプロパティ GITHUB_TOKEN が設定されていません。');
  if (!adminEmail) throw new Error('スクリプトプロパティ ADMIN_EMAIL が設定されていません。');

  const form = FormApp.getActiveForm();
  if (!form) throw new Error('Googleフォームに紐づいたApps Scriptから実行してください。');

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === OWNER_REQUEST_HANDLER)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(OWNER_REQUEST_HANDLER)
    .forForm(form)
    .onFormSubmit()
    .create();
}

function ownerRequestOnFormSubmit(event) {
  if (!event || !event.response) throw new Error('フォーム回答イベントがありません。');

  const payloadText = findStructuredRequestPayload_(event.response);
  if (!payloadText) return;

  if (payloadText.startsWith('【店舗再掲載依頼】')) {
    notifyAdmin_('【石川マップ】店舗再掲載依頼を受け付けました', payloadText + '\n\n内容を確認後、GitHub Actionsからrestoreを実行してください。');
    return;
  }

  const request = parseOwnerRequest_(payloadText);
  if (request['依頼種別'] !== '削除依頼') {
    notifyAdmin_('【石川マップ】店舗主からの依頼を受け付けました', payloadText);
    return;
  }
  if (request['店舗主確認'] !== 'はい') throw new Error('店舗主確認がない削除依頼です。');

  const storeId = String(request['店舗番号'] || '');
  if (!/^\d{1,6}$/.test(storeId)) throw new Error('店舗番号が正しくありません。');

  const deleteKind = String(request['希望対応'] || '');
  if (!['一時的に非表示', '今後掲載しない'].includes(deleteKind)) {
    throw new Error('削除種別が正しくありません。');
  }

  const responseId = event.response.getId() || '';
  const timestamp = event.response.getTimestamp();
  const requestRef = sha256_(responseId + '|' + timestamp.toISOString() + '|' + storeId).slice(0, 24);
  const reasonProvided = !!request['理由（任意）'] && request['理由（任意）'] !== '記載なし';

  try {
    dispatchGitHub_('owner_delete_request', {
      store_id: storeId,
      request_ref: requestRef,
      delete_kind: deleteKind,
      reason_provided: reasonProvided,
    });
    notifyAdmin_(
      '【石川マップ】店舗削除依頼を受け付けました',
      payloadText + '\n\n受付番号：' + requestRef + '\nGitHubへ自動非表示処理を依頼しました。'
    );
  } catch (error) {
    notifyAdmin_(
      '【要確認・石川マップ】店舗削除依頼の自動処理に失敗しました',
      payloadText + '\n\n受付番号：' + requestRef + '\nエラー：' + String(error)
    );
    throw error;
  }
}

function findStructuredRequestPayload_(formResponse) {
  const itemResponses = formResponse.getItemResponses();
  for (let i = 0; i < itemResponses.length; i += 1) {
    const value = itemResponses[i].getResponse();
    if (typeof value === 'string' && (value.startsWith('【店舗主向け依頼】') || value.startsWith('【店舗再掲載依頼】'))) return value;
  }
  return '';
}

function parseOwnerRequest_(text) {
  const values = {};
  String(text).split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf('：');
    if (separator <= 0) return;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  });
  return values;
}

function dispatchGitHub_(eventType, clientPayload) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKENが設定されていません。');

  const response = UrlFetchApp.fetch(GITHUB_DISPATCH_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    payload: JSON.stringify({
      event_type: eventType,
      client_payload: clientPayload,
    }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 204) {
    throw new Error('GitHub dispatch失敗 HTTP ' + response.getResponseCode() + ': ' + response.getContentText());
  }
}

function renderAdminRestorePage_(title, body) {
  const html = '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHtml_(title) + '</title><style>' +
    '*{box-sizing:border-box}body{margin:0;background:#eef2f5;color:#263238;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP","Yu Gothic",sans-serif}' +
    'main{max-width:520px;margin:0 auto;padding:24px 16px}section{background:#fff;border-radius:16px;padding:24px 20px;box-shadow:0 4px 18px rgba(38,50,56,.12)}' +
    'h1{font-size:20px;line-height:1.5;margin:0 0 20px;color:#1257a3}.store-name{font-weight:700;font-size:16px}.note{font-size:13px;color:#607d8b;line-height:1.6}' +
    'form{margin-top:24px}button{width:100%;min-height:48px;border:0;border-radius:10px;background:#16833b;color:#fff;font:inherit;font-weight:700;cursor:pointer}' +
    'button.cancel{margin-top:12px;background:#fff;color:#455a64;border:1px solid #b0bec5}' +
    '</style></head><body><main><section><h1>' + escapeHtml_(title) + '</h1>' + body + '</section></main></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title);
}

function escapeHtml_(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function notifyAdmin_(subject, body) {
  const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  if (!adminEmail) throw new Error('ADMIN_EMAILが設定されていません。');
  MailApp.sendEmail({ to: adminEmail, subject: subject, body: body });
}

function sha256_(text) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  ).map((byte) => ((byte + 256) % 256).toString(16).padStart(2, '0')).join('');
}
