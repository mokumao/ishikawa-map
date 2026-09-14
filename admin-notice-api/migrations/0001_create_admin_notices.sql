CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL
);

CREATE TABLE admin_notices (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES regions(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'hidden')),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX admin_notices_public_idx
  ON admin_notices(region_id, status, starts_at, ends_at, updated_at DESC);

CREATE TABLE admin_notice_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notice_id TEXT NOT NULL REFERENCES admin_notices(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'publish', 'hide')),
  snapshot_json TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO regions (id, name, status, created_at)
VALUES ('ishikawa', 'うるま市石川地区', 'active', '2026-09-14T00:00:00+09:00');
