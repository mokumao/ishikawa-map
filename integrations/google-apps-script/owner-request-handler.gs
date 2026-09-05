// 石川マップ 店舗主依頼連携
// このファイルを「石川マップ ご意見・ご要望」のフォームに紐づく
// Google Apps Scriptへ貼り付け、setupOwnerRequestAutomation()を一度実行する。

const OWNER_REQUEST_HANDLER = 'ownerRequestOnFormSubmit';
const GITHUB_DISPATCH_URL = 'https://api.github.com/repos/mokumao/ishikawa-map/dispatches';

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
    dispatchGitHub_({
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

function dispatchGitHub_(clientPayload) {
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
      event_type: 'owner_delete_request',
      client_payload: clientPayload,
    }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 204) {
    throw new Error('GitHub dispatch失敗 HTTP ' + response.getResponseCode() + ': ' + response.getContentText());
  }
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
