CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE admin_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  role            VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN','OPS','FINANCE','SUPPORT')),
  is_active       BOOLEAN DEFAULT TRUE,
  mfa_secret      VARCHAR(255),              -- encrypted TOTP secret, null until set up
  mfa_enabled     BOOLEAN DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  last_login_ip   VARCHAR(50),
  failed_attempts INTEGER DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_by      UUID REFERENCES admin_users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_mfa_backup_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  code_hash   VARCHAR(255) NOT NULL,   -- bcrypt hash of the backup code
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      UUID REFERENCES admin_users(id),
  admin_email   VARCHAR(255),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id   UUID,
  old_value     JSONB,
  new_value     JSONB,
  notes         TEXT,
  ip_address    VARCHAR(50),
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_users_email ON admin_users(email);