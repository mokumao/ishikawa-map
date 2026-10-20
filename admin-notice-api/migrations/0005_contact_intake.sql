ALTER TABLE owner_contacts ADD COLUMN submission_fingerprint TEXT;
CREATE TABLE contact_notifications (
  contact_id TEXT PRIMARY KEY REFERENCES owner_contacts(id),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  sent_at TEXT
);
CREATE TABLE contact_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
