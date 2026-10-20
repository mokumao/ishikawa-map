CREATE TABLE IF NOT EXISTS owner_contacts (
  id TEXT PRIMARY KEY,
  store_id INTEGER NOT NULL,
  store_name TEXT NOT NULL,
  body TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'in_progress', 'done')),
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS owner_contacts_created_idx ON owner_contacts(created_at DESC, id);
