export const NOTICE_STATUSES = new Set(['draft', 'published', 'hidden']);

export function normalizeNoticeInput(value) {
  const input = value && typeof value === 'object' ? value : {};
  const normalized = {
    regionId: clean(input.regionId, 64),
    title: clean(input.title, 120),
    body: clean(input.body, 2000),
    category: clean(input.category, 40),
    status: clean(input.status, 16) || 'draft',
    startsAt: normalizeDate(input.startsAt),
    endsAt: normalizeDate(input.endsAt),
  };

  const errors = [];
  if (!normalized.regionId) errors.push('地域を選択してください。');
  if (!normalized.title) errors.push('タイトルを入力してください。');
  if (!NOTICE_STATUSES.has(normalized.status)) errors.push('公開状態が不正です。');
  if (input.startsAt && !normalized.startsAt) errors.push('掲載開始日時が不正です。');
  if (input.endsAt && !normalized.endsAt) errors.push('掲載終了日時が不正です。');
  if (normalized.startsAt && normalized.endsAt && normalized.endsAt <= normalized.startsAt) {
    errors.push('掲載終了日時は掲載開始日時より後にしてください。');
  }
  return { value: normalized, errors };
}

function clean(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
