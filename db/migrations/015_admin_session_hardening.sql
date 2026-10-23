-- 015_admin_session_hardening.sql
-- Trusted devices ("remember this device 7 days") + case-insensitive email index.

CREATE TABLE IF NOT EXISTS admin_trusted_devices (
  id           UUID PRIMARY KEY,
  admin_id     UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash   CHAR(64) NOT NULL,          -- sha256 of the secret half of the cookie
  ip_address   VARCHAR(64),
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_trusted_devices_admin
  ON admin_trusted_devices (admin_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_trusted_devices_expires
  ON admin_trusted_devices (expires_at);

-- Login now looks accounts up with LOWER(email). If this fails, you have two
-- admins whose emails differ only by case: fix those rows first.
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email_lower
  ON admin_users (LOWER(email));