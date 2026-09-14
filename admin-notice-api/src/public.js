const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET' || url.pathname !== '/api/v1/notices') {
      return json({ error: 'not_found' }, 404, cors);
    }

    const regionId = url.searchParams.get('region') || 'ishikawa';
    const now = new Date().toISOString();
    const result = await env.DB.prepare(`
      SELECT id, region_id AS regionId, title, body, category, status,
             starts_at AS startsAt, starts_at AS publishedAt,
             ends_at AS endsAt, updated_at AS updatedAt
      FROM admin_notices
      WHERE region_id = ? AND status = 'published'
        AND (starts_at IS NULL OR starts_at <= ?)
        AND (ends_at IS NULL OR ends_at >= ?)
      ORDER BY COALESCE(starts_at, created_at) DESC
    `).bind(regionId, now, now).all();
    return json({ updated: now, items: result.results || [] }, 200, cors);
  },
};

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.PUBLIC_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  const headers = {
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin',
  };
  if (allowed.includes(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}
