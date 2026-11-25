CREATE TABLE IF NOT EXISTS history_records (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('resume','interview')),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (owner,id)
);
CREATE INDEX IF NOT EXISTS history_owner_created_idx ON history_records(owner,created_at DESC);
