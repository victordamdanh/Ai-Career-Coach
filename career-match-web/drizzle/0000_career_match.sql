CREATE TABLE IF NOT EXISTS candidate_profiles (
  owner TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  resume TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_jobs (
  owner TEXT NOT NULL,
  company TEXT NOT NULL,
  job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  location TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner, company, job_id)
);
