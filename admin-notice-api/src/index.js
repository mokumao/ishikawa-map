import { normalizeNoticeInput } from './validation.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === 'GET' && url.pathname === '/') {
        const actor = await requireAdmin(env, ctx);
        return json({ ok: true, message: '管理者投稿APIにログインしています。', actor }, 200, cors);
      }
      if (request.method === 'GET' && url.pathname === '/api/v1/notices') {
        return json(await listPublicNotices(env.DB, url.searchParams.get('region') || 'ishikawa'), 200, cors);
      }

      if (!url.pathname.startsWith('/api/v1/admin/')) return json({ error: 'not_found' }, 404, cors);
      const actor = await requireAdmin(env, ctx);

      if (request.method === 'GET' && url.pathname === '/api/v1/admin/notices') {
        return json(await listAdminNotices(env.DB, url.searchParams.get('region') || 'ishikawa'), 200, cors);
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/admin/notices') {
        return json(await createNotice(request, env.DB, actor), 201, cors);
      }

      const match = url.pathname.match(/^\/api\/v1\/admin\/notices\/([a-zA-Z0-9-]+)$/);
      if (match && request.method === 'PUT') {
        return json(await updateNotice(request, env.DB, actor, match[1]), 200, cors);
      }
      if (match && request.method === 'DELETE') {
        return json(await hideNotice(env.DB, actor, match[1]), 200, cors);
      }
      return json({ error: 'not_found' }, 404, cors);
    } catch (error) {
      const status = error.status || 500;
      return json({ error: error.code || 'server_error', message: status === 500 ? '処理に失敗しました。' : error.message }, status, cors);
    }
  },
};

async function listPublicNotices(db, regionId) {
  const now = new Date().toISOString();
  const result = await db.prepare(`
    SELECT id, region_id AS regionId, title, body, category, status,
           starts_at AS startsAt, starts_at AS publishedAt,
           ends_at AS endsAt, updated_at AS updatedAt
    FROM admin_notices
    WHERE region_id = ? AND status = 'published'
      AND (starts_at IS NULL OR starts_at <= ?)
      AND (ends_at IS NULL OR ends_at >= ?)
    ORDER BY COALESCE(starts_at, created_at) DESC
  `).bind(regionId, now, now).all();
  return { updated: now, items: result.results || [] };
}

async function listAdminNotices(db, regionId) {
  const result = await db.prepare(`
    SELECT id, region_id AS regionId, title, body, category, status,
           starts_at AS startsAt, ends_at AS endsAt, created_at AS createdAt,
           updated_at AS updatedAt, revision
    FROM admin_notices WHERE region_id = ? ORDER BY updated_at DESC
  `).bind(regionId).all();
  return { items: result.results || [] };
}

async function createNotice(request, db, actor) {
  const { value, errors } = normalizeNoticeInput(await readJson(request));
  if (errors.length) throw httpError(400, 'validation_error', errors.join(' '));
  await ensureRegion(db, value.regionId);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO admin_notices
      (id, region_id, title, body, category, status, starts_at, ends_at,
       created_at, updated_at, created_by, updated_by, revision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .bind(id, value.regionId, value.title, value.body, value.category, value.status,
        value.startsAt, value.endsAt, now, now, actor, actor),
    db.prepare(`INSERT INTO admin_notice_history
      (notice_id, action, snapshot_json, actor_email, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, value.status === 'published' ? 'publish' : 'create', JSON.stringify(value), actor, now),
  ]);
  return { id, revision: 1, message: '保存しました。' };
}

async function updateNotice(request, db, actor, id) {
  const input = await readJson(request);
  const { value, errors } = normalizeNoticeInput(input);
  const revision = Number(input.revision);
  if (errors.length || !Number.isInteger(revision) || revision < 1) {
    throw httpError(400, 'validation_error', errors.join(' ') || '更新番号が不正です。');
  }
  await ensureRegion(db, value.regionId);
  const now = new Date().toISOString();
  const result = await db.prepare(`UPDATE admin_notices SET
      region_id = ?, title = ?, body = ?, category = ?, status = ?, starts_at = ?, ends_at = ?,
      updated_at = ?, updated_by = ?, revision = revision + 1
    WHERE id = ? AND revision = ?`)
    .bind(value.regionId, value.title, value.body, value.category, value.status,
      value.startsAt, value.endsAt, now, actor, id, revision).run();
  if (!result.meta?.changes) throw httpError(409, 'edit_conflict', '別の更新があります。再読み込みしてください。');
  await recordHistory(db, id, value.status === 'published' ? 'publish' : 'update', value, actor, now);
  return { id, revision: revision + 1, message: '更新しました。' };
}

async function hideNotice(db, actor, id) {
  const now = new Date().toISOString();
  const result = await db.prepare(`UPDATE admin_notices
    SET status = 'hidden', updated_at = ?, updated_by = ?, revision = revision + 1 WHERE id = ?`)
    .bind(now, actor, id).run();
  if (!result.meta?.changes) throw httpError(404, 'not_found', '投稿が見つかりません。');
  await recordHistory(db, id, 'hide', { status: 'hidden' }, actor, now);
  return { id, message: '非公開にしました。' };
}

async function requireAdmin(env, ctx) {
  if (!ctx.access) throw httpError(401, 'unauthorized', '管理者としてログインしてください。');
  const identity = await ctx.access.getIdentity();
  const email = String(identity?.email || '').toLowerCase();
  const allowed = String(env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!email || !allowed.includes(email)) throw httpError(403, 'forbidden', 'この操作を行う権限がありません。');
  return email;
}

async function ensureRegion(db, regionId) {
  const region = await db.prepare("SELECT id FROM regions WHERE id = ? AND status = 'active'").bind(regionId).first();
  if (!region) throw httpError(400, 'invalid_region', '選択された地域は利用できません。');
}

async function recordHistory(db, id, action, snapshot, actor, now) {
  await db.prepare(`INSERT INTO admin_notice_history
    (notice_id, action, snapshot_json, actor_email, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, action, JSON.stringify(snapshot), actor, now).run();
}

async function readJson(request) {
  try { return await request.json(); } catch { throw httpError(400, 'invalid_json', '入力内容を読み取れません。'); }
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.PUBLIC_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  const headers = {
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-credentials': 'true',
    'vary': 'Origin',
  };
  if (allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
