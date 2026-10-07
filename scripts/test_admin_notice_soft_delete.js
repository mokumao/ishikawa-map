const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'admin-notice-api', 'src', 'index.js'), 'utf8');
const publicSource = fs.readFileSync(path.join(__dirname, '..', 'admin-notice-api', 'src', 'public.js'), 'utf8');
const migration = fs.readFileSync(
  path.join(__dirname, '..', 'admin-notice-api', 'migrations', '0003_add_notice_soft_delete.sql'),
  'utf8',
);

assert(source.includes("request.method === 'POST'"), '論理削除APIはPOSTで受け付けること');
assert(source.includes("AND deleted_at IS NULL"), '削除済み投稿を管理一覧と更新対象から除外すること');
assert(publicSource.includes("status = 'published' AND deleted_at IS NULL"), '削除済み投稿を公開APIから除外すること');
assert(source.includes("SET deleted_at = ?, deleted_by = ?"), '削除日時と操作者を投稿に記録すること');
assert(source.includes("{ operation: 'delete', deletedAt: now }"), '削除操作を履歴へ記録すること');
assert(migration.includes('ADD COLUMN deleted_at TEXT'), '削除日時の列を追加すること');
assert(migration.includes('ADD COLUMN deleted_by TEXT'), '削除操作者の列を追加すること');

console.log('admin notice soft-delete tests: OK');
