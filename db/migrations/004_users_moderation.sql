-- 004_users_moderation.sql
-- Adds admin-moderation columns to users, plus search index.
-- Status is derived at query time, not stored as an enum column, so it can
-- never drift out of sync with the underlying timestamps.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS suspended_until   timestamptz NULL,
  ADD COLUMN IF NOT EXISTS suspended_reason  text NULL,
  ADD COLUMN IF NOT EXISTS suspended_by      uuid NULL REFERENCES admin_users(id),
  ADD COLUMN IF NOT EXISTS banned_at         timestamptz NULL,
  ADD COLUMN IF NOT EXISTS banned_reason     text NULL,
  ADD COLUMN IF NOT EXISTS banned_by         uuid NULL REFERENCES admin_users(id),
  ADD COLUMN IF NOT EXISTS warning_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_warning_at   timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_warning_reason text NULL;

-- Trigram search across name / phone / email (pg_trgm already enabled in 003)
CREATE INDEX IF NOT EXISTS idx_users_name_trgm  ON public.users USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_phone_trgm ON public.users USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON public.users USING gin (email gin_trgm_ops);

-- Helper: derives a single status string from the timestamp columns.
CREATE OR REPLACE FUNCTION public.fn_user_status(
  p_is_active   boolean,
  p_deleted_at  timestamptz,
  p_banned_at   timestamptz,
  p_suspended_until timestamptz
) RETURNS text AS $$
BEGIN
  IF p_deleted_at IS NOT NULL THEN
    RETURN 'deleted';
  ELSIF p_banned_at IS NOT NULL THEN
    RETURN 'banned';
  ELSIF p_suspended_until IS NOT NULL AND p_suspended_until > now() THEN
    RETURN 'suspended';
  ELSIF p_is_active THEN
    RETURN 'active';
  ELSE
    RETURN 'inactive';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Single-user overview: profile + address count + blocked-worker count +
-- default city, in one round trip for the detail page header.
CREATE OR REPLACE FUNCTION public.get_user_overview(p_user_id uuid)
RETURNS TABLE (
  id uuid, phone varchar, email varchar, name varchar, avatar_url text,
  preferred_language varchar, preferred_currency varchar,
  total_bookings integer, is_active boolean, role text,
  created_at timestamptz, updated_at timestamptz, deleted_at timestamptz,
  push_enabled boolean, email_enabled boolean,
  suspended_until timestamptz, suspended_reason text, banned_at timestamptz,
  banned_reason text, warning_count integer, last_warning_at timestamptz,
  last_warning_reason text, status text,
  default_city varchar, address_count bigint, blocked_worker_count bigint
) AS $$
  SELECT
    u.id, u.phone, u.email, u.name, u.avatar_url,
    u.preferred_language, u.preferred_currency,
    u.total_bookings, u.is_active, u.role,
    u.created_at, u.updated_at, u.deleted_at,
    u.push_enabled, u.email_enabled,
    u.suspended_until, u.suspended_reason, u.banned_at,
    u.banned_reason, u.warning_count, u.last_warning_at,
    u.last_warning_reason,
    fn_user_status(u.is_active, u.deleted_at, u.banned_at, u.suspended_until) AS status,
    (SELECT a.city FROM user_addresses a WHERE a.user_id = u.id AND a.is_default = true LIMIT 1) AS default_city,
    (SELECT count(*) FROM user_addresses a WHERE a.user_id = u.id) AS address_count,
    (SELECT count(*) FROM user_blocks b WHERE b.user_id = u.id) AS blocked_worker_count
  FROM users u
  WHERE u.id = p_user_id;
$$ LANGUAGE sql STABLE;