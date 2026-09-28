-- Initial schema for the Sun Over The Cloud D1 database.
--
-- Only durable, relational data lives here: user accounts, their favorites and
-- password-reset tokens. Ephemeral caches (geocoding results, Open-Meteo day
-- summaries) live in the KV namespace, not in D1.
--
-- IDs are TEXT so the existing MongoDB ObjectId strings can be migrated as-is,
-- keeping every favorite's user_id reference valid.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  hashed_password TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  longitude REAL NOT NULL,
  latitude REAL NOT NULL,
  country_code TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_order
  ON user_favorites (user_id, sort_order);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
  ON password_reset_tokens (token);
