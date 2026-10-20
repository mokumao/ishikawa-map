const STATUSES = ['unread', 'in_progress', 'done'];
const fields = `id, store_id AS storeId, store_name AS storeName, body, email, status,
  memo, created_at AS createdAt, updated_at AS updatedAt, updated_by AS updatedBy, revision`;

export async function listContacts(db, url) {
  const status = url.searchParams.get('status') || '';
  if (status && !STATUSES.includes(status)) throw problem(400, '状態の指定が正しくありません。');
  const page = Number(url.searchParams.get('page') || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw problem(400, 'ページの指定が正しくありません。');
  const where = status ? ' WHERE status = ?' : '';
  const bindings = status ? [status] : [];
  const total = await db.prepare('SELECT COUNT(*) AS total FROM owner_contacts' + where).bind(...bindings).first();
  const result = await db.prepare('SELECT ' + fields + ' FROM owner_contacts' + where + ' ORDER BY created_at DESC, id LIMIT 50 OFFSET ?')
    .bind(...bindings, (page - 1) * 50).all();
  return { items: result.results || [], total: total.total, page, pageSize: 50 };
}

export function validateContactUpdate(input) {
  if (!input || !STATUSES.includes(input.status) || typeof input.memo !== 'string' || input.memo.length > 10000
      || !Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw problem(400, '状態・対応メモ（10000文字以内）を確認してください。');
  }
  return { status: input.status, memo: input.memo, revision: input.revision };
}

export async function updateContact(db, actor, id, input) {
  const value = validateContactUpdate(input);
  const result = await db.prepare(`UPDATE owner_contacts SET status = ?, memo = ?, updated_at = ?,
    updated_by = ?, revision = revision + 1 WHERE id = ? AND revision = ?`)
    .bind(value.status, value.memo, new Date().toISOString(), actor, id, value.revision).run();
  if (!result.meta?.changes) throw problem(409, '別の画面で更新されたか、連絡が見つかりません。再読み込みしてください。');
  return { message: '対応状況とメモを保存しました。', revision: value.revision + 1 };
}

function problem(status, message) { return Object.assign(new Error(message), { status, code: 'contact_error' }); }
