-- Migration 0002: Add nullable last_login_at column to users table
-- Stores the timestamp (Unix milliseconds, matching created_at) of the user's last login.

ALTER TABLE users ADD COLUMN last_login_at INTEGER;
