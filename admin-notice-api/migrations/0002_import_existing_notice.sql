INSERT INTO admin_notices (
  id, region_id, title, body, category, status, starts_at, ends_at,
  created_at, updated_at, created_by, updated_by, revision
) VALUES (
  'admin-0cea8f07143b8414',
  'ishikawa',
  '練習2 2026/9/13',
  '練習9/13',
  'お店',
  'published',
  '2026-09-13T16:19:04+09:00',
  '2026-09-20T16:19:04+09:00',
  '2026-09-13T16:19:04+09:00',
  '2026-09-13T16:19:04+09:00',
  'legacy-google-form',
  'legacy-google-form',
  1
);

INSERT INTO admin_notice_history (
  notice_id, action, snapshot_json, actor_email, created_at
) VALUES (
  'admin-0cea8f07143b8414',
  'create',
  '{"source":"legacy-google-form"}',
  'legacy-google-form',
  '2026-09-13T16:19:04+09:00'
);
