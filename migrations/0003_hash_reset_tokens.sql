-- Migration 0003: store password reset tokens as SHA-256 hashes.
--
-- Reset tokens used to be stored verbatim, so any copy of the database
-- (export, backup, admin access) made every outstanding reset link
-- immediately usable. The lookup path now hashes the incoming token, which
-- makes the stored value useless offline.
--
-- The column is renamed (token -> token_hash) so a stale build writing a
-- plaintext token fails loudly instead of silently breaking lookups.
-- Pre-migration plaintext rows can never match a hashed lookup: they are
-- dropped, which simply expires the few links outstanding at migration time.

ALTER TABLE password_reset_tokens RENAME COLUMN token TO token_hash;

DELETE FROM password_reset_tokens;
