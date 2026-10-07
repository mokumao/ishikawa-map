ALTER TABLE admin_notices ADD COLUMN deleted_at TEXT;
ALTER TABLE admin_notices ADD COLUMN deleted_by TEXT;

CREATE INDEX admin_notices_deleted_idx
  ON admin_notices(region_id, deleted_at, updated_at DESC);
