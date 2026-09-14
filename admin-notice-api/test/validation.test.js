import { describe, expect, it } from 'vitest';
import { normalizeNoticeInput } from '../src/validation.js';

describe('normalizeNoticeInput', () => {
  it('accepts a publishable multi-region notice', () => {
    const result = normalizeNoticeInput({
      regionId: 'ishikawa', title: ' 地域のお知らせ ', body: '本文',
      category: '行政', status: 'published', startsAt: '2026-09-14T09:00:00+09:00',
      endsAt: '2026-09-21T09:00:00+09:00',
    });
    expect(result.errors).toEqual([]);
    expect(result.value.title).toBe('地域のお知らせ');
    expect(result.value.regionId).toBe('ishikawa');
  });

  it('rejects missing region and title', () => {
    const result = normalizeNoticeInput({ status: 'draft' });
    expect(result.errors).toHaveLength(2);
  });

  it('rejects an end before the start', () => {
    const result = normalizeNoticeInput({
      regionId: 'ishikawa', title: 'お知らせ', status: 'published',
      startsAt: '2026-09-21T09:00:00+09:00', endsAt: '2026-09-14T09:00:00+09:00',
    });
    expect(result.errors).toContain('掲載終了日時は掲載開始日時より後にしてください。');
  });

  it('rejects an invalid date instead of silently removing it', () => {
    const result = normalizeNoticeInput({
      regionId: 'ishikawa', title: 'お知らせ', status: 'published', startsAt: 'invalid-date',
    });
    expect(result.errors).toContain('掲載開始日時が不正です。');
  });
});
