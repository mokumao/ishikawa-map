const MAIL_PREFIX = 'https://script.google.com/macros/s/';
export function intakeReady(env) {
  return ['true', 'test'].includes(env.CONTACTS_LIVE) && Boolean(env.CONTACT_MAIL_TOKEN?.length >= 32 && env.CONTACT_MAIL_URL?.startsWith(MAIL_PREFIX) && env.CONTACT_MAIL_URL.endsWith('/exec'));
}
const issue = (status, message) => Object.assign(new Error(message), { status });
export function validateIntake(input) {
  if (!input || !/^[a-f0-9-]{36}$/.test(input.id || '') || !Number.isSafeInteger(input.storeId) || input.storeId < 0 || input.storeId > 1000000
      || typeof input.storeName !== 'string' || !input.storeName.trim() || input.storeName.length > 200
      || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 5000
      || typeof input.email !== 'string' || input.email.length > 254
      || (input.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.consent !== true))
      || input.website) throw issue(400, '入力内容を確認してください。');
  return { id: input.id, storeId: input.storeId, storeName: input.storeName.trim(), body: input.body.trim(), email: input.email.trim() };
}
async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}
export async function receiveContact(request, env) {
  if (!intakeReady(env)) throw issue(503, '新しい受付は準備中です。ページを再読み込みしてください。');
  if (!String(request.headers.get('content-type')).startsWith('application/json')) throw issue(415, '送信形式を確認してください。');
  if (Number(request.headers.get('content-length')) > 24000) throw issue(413, '送信内容が長すぎます。');
  const reader = request.body?.getReader();
  if (!reader) throw issue(400, '入力内容がありません。');
  let length = 0, chunks = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 24000) { await reader.cancel(); throw issue(413, '送信内容が長すぎます。'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.length; });
  let input; try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw issue(400, '送信内容を読み取れません。'); }
  const data = validateIntake(input);
  if (env.CONTACTS_LIVE === 'test' && data.storeId !== 0) throw issue(503, '現在はテスト用店舗のみ受付確認中です。');
  const fingerprint = await digest(JSON.stringify(data));
  const existing = await env.DB.prepare('SELECT submission_fingerprint AS fingerprint FROM owner_contacts WHERE id = ?').bind(data.id).first();
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw issue(409, '送信内容が変わっています。再読み込み後に送信してください。');
    return { id: data.id, message: 'ご連絡を受け付けました。管理者が内容を確認します。' };
  }
  const now = new Date();
  const bucket = Math.floor(now.getTime() / 900000);
  const key = await digest(env.CONTACT_MAIL_TOKEN + ':' + (request.headers.get('CF-Connecting-IP') || 'unknown') + ':' + bucket);
  const limit = await env.DB.prepare(`INSERT INTO contact_rate_limits (bucket_key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket_key) DO UPDATE SET count = count + 1 WHERE count < 10 RETURNING count`)
    .bind(key, new Date(now.getTime() + 1800000).toISOString()).first();
  if (!limit) throw issue(429, '送信回数が多いため、しばらく待ってからお試しください。');
  const timestamp = now.toISOString();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO owner_contacts (id, store_id, store_name, body, email, created_at, updated_at, submission_fingerprint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).bind(data.id, data.storeId, data.storeName, data.body, data.email, timestamp, timestamp, fingerprint),
    env.DB.prepare(`INSERT INTO contact_notifications (contact_id) VALUES (?) ON CONFLICT(contact_id) DO NOTHING`).bind(data.id),
    env.DB.prepare('DELETE FROM contact_rate_limits WHERE expires_at < ?').bind(timestamp),
  ]);
  // A concurrent retry may have inserted the ID; check its contents before acknowledging it.
  const stored = await env.DB.prepare('SELECT submission_fingerprint AS fingerprint FROM owner_contacts WHERE id = ?').bind(data.id).first();
  if (stored?.fingerprint !== fingerprint) throw issue(409, '送信内容が変わっています。再読み込み後に送信してください。');
  return { id: data.id, message: 'ご連絡を受け付けました。管理者が内容を確認します。' };
}

export async function deliverNotifications(env) {
  if (!env.CONTACT_MAIL_TOKEN || !env.CONTACT_MAIL_URL?.startsWith(MAIL_PREFIX) || !env.CONTACT_MAIL_URL.endsWith('/exec')) return;
  const now = new Date().toISOString();
  const pending = await env.DB.prepare(`SELECT contact_id AS id FROM contact_notifications
    WHERE state = 'pending' AND (lease_until IS NULL OR lease_until < ?) LIMIT 10`).bind(now).all();
  for (const item of pending.results || []) {
    const lock = await env.DB.prepare(`UPDATE contact_notifications SET lease_until = ?, attempts = attempts + 1
      WHERE contact_id = ? AND state = 'pending' AND (lease_until IS NULL OR lease_until < ?)`)
      .bind(new Date(Date.now() + 600000).toISOString(), item.id, now).run();
    if (!lock.meta?.changes) continue;
    try {
      const response = await fetch(env.CONTACT_MAIL_URL, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: env.CONTACT_MAIL_TOKEN, contactId: item.id }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true || result.contactId !== item.id) throw Error('notification_failed');
      await env.DB.prepare("UPDATE contact_notifications SET state = 'sent', sent_at = ?, lease_until = NULL WHERE contact_id = ?")
        .bind(new Date().toISOString(), item.id).run();
    } catch {
      // Keep the durable pending record for the next scheduled retry. Never log contact data or secrets.
    }
  }
}
