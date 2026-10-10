-- 006_workers_moderation.sql
-- Admin-moderation columns for workers, derived status/presence helpers,
-- KPI + overview functions, and worker badges.
--
-- NOTE: `workers` is owned by worker-service. Everything here is additive
-- (ADD COLUMN IF NOT EXISTS), so it is safe on the shared DB, but tell the
-- worker-service team (see section 12).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS suspended_until              timestamptz NULL,
  ADD COLUMN IF NOT EXISTS suspended_reason             text NULL,
  ADD COLUMN IF NOT EXISTS suspended_by                 uuid NULL REFERENCES admin_users(id),
  ADD COLUMN IF NOT EXISTS banned_at                    timestamptz NULL,
  ADD COLUMN IF NOT EXISTS banned_reason                text NULL,
  ADD COLUMN IF NOT EXISTS banned_by                    uuid NULL REFERENCES admin_users(id),
  ADD COLUMN IF NOT EXISTS warning_count                integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_warning_at              timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_warning_reason          text NULL,
  ADD COLUMN IF NOT EXISTS is_featured                  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_at                  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reverification_requested_at  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reverification_reason        text NULL;

-- Search + filter indexes
CREATE INDEX IF NOT EXISTS idx_workers_name_trgm  ON public.workers USING gin (name  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_workers_phone_trgm ON public.workers USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_workers_email_trgm ON public.workers USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_workers_verification_status ON public.workers (verification_status);
CREATE INDEX IF NOT EXISTS idx_workers_city        ON public.workers (city);
CREATE INDEX IF NOT EXISTS idx_workers_created_at  ON public.workers (created_at DESC);

-- Admin-awarded badges ("Top Rated", "Background Verified")
CREATE TABLE IF NOT EXISTS public.worker_badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  badge       varchar(50) NOT NULL CHECK (badge IN ('top_rated', 'background_verified')),
  awarded_by  uuid NULL REFERENCES admin_users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, badge)
);

-- Account status, derived from timestamps (same idea as fn_user_status).
CREATE OR REPLACE FUNCTION public.fn_worker_status(
  p_is_active       boolean,
  p_deleted_at      timestamptz,
  p_banned_at       timestamptz,
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
$$ LANGUAGE plpgsql STABLE;

-- Live presence, derived from last_seen_at (worker-service doc section 7).
--   inactive account -> offline | manually paused -> paused | on a job -> on_job
--   < 90 s -> online | 90 s - 10 min -> away | > 10 min -> offline
CREATE OR REPLACE FUNCTION public.fn_worker_presence(
  p_is_active       boolean,
  p_manually_paused boolean,
  p_is_on_job       boolean,
  p_last_seen_at    timestamptz
) RETURNS text AS $$
DECLARE
  secs numeric;
BEGIN
  IF NOT COALESCE(p_is_active, false) THEN
    RETURN 'offline';
  ELSIF COALESCE(p_manually_paused, false) THEN
    RETURN 'paused';
  ELSIF COALESCE(p_is_on_job, false) THEN
    RETURN 'on_job';
  END IF;

  IF p_last_seen_at IS NULL THEN
    RETURN 'offline';
  END IF;

  secs := EXTRACT(EPOCH FROM (now() - p_last_seen_at));
  IF secs < 90 THEN
    RETURN 'online';
  ELSIF secs < 600 THEN
    RETURN 'away';
  ELSE
    RETURN 'offline';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- KPI cards for the list page. "Today" uses Asia/Karachi.
DROP FUNCTION IF EXISTS public.get_worker_kpis();
CREATE OR REPLACE FUNCTION public.get_worker_kpis()
RETURNS TABLE (
  total_workers        bigint,
  signups_today        bigint,
  signups_yesterday    bigint,
  online_now           bigint,
  suspended_or_banned  bigint,
  signups_sparkline_7d bigint[]
) AS $$
  WITH b AS (
    SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi') AS today_start
  )
  SELECT
    (SELECT count(*) FROM workers w WHERE w.deleted_at IS NULL),
    (SELECT count(*) FROM workers w
       WHERE w.deleted_at IS NULL AND w.created_at >= b.today_start),
    (SELECT count(*) FROM workers w
       WHERE w.deleted_at IS NULL
         AND w.created_at >= b.today_start - interval '1 day'
         AND w.created_at <  b.today_start),
    (SELECT count(*) FROM workers w
       WHERE w.deleted_at IS NULL
         AND fn_worker_presence(w.is_active, w.manually_paused, w.is_on_job, w.last_seen_at) = 'online'),
    (SELECT count(*) FROM workers w
       WHERE w.deleted_at IS NULL
         AND fn_worker_status(w.is_active, w.deleted_at, w.banned_at, w.suspended_until) IN ('suspended', 'banned')),
    (SELECT array_agg(s.c ORDER BY s.d)
       FROM (
         SELECT g.d,
                (SELECT count(*) FROM workers w
                   WHERE w.deleted_at IS NULL
                     AND w.created_at >= b.today_start - (6 - g.d) * interval '1 day'
                     AND w.created_at <  b.today_start - (5 - g.d) * interval '1 day') AS c
         FROM generate_series(0, 6) AS g(d)
       ) s)
  FROM b;
$$ LANGUAGE sql STABLE;

-- Single-worker overview: profile + counts + skills + badges in one round trip.
DROP FUNCTION IF EXISTS public.get_worker_overview(uuid);
CREATE OR REPLACE FUNCTION public.get_worker_overview(p_worker_id uuid)
RETURNS TABLE (
  id uuid, phone varchar, email varchar, name varchar, bio text, avatar_url text,
  verification_status text, manually_paused boolean, is_on_job boolean, is_active boolean,
  last_seen_at timestamptz, currency varchar, avg_rating numeric, total_reviews integer,
  total_bookings integer, response_time_mins integer, years_experience integer,
  city varchar, country varchar, preferred_language varchar,
  created_at timestamptz, updated_at timestamptz, deleted_at timestamptz,
  suspended_until timestamptz, suspended_reason text, banned_at timestamptz, banned_reason text,
  warning_count integer, last_warning_at timestamptz, last_warning_reason text,
  is_featured boolean, featured_at timestamptz,
  reverification_requested_at timestamptz, reverification_reason text,
  status text, presence text,
  skill_count bigint, offering_count bigint, document_count bigint, pending_document_count bigint,
  skills text[], badges text[]
) AS $$
  SELECT
    w.id, w.phone, w.email, w.name, w.bio, w.avatar_url,
    lower(w.verification_status::text), w.manually_paused, w.is_on_job, w.is_active,
    w.last_seen_at, w.currency, w.avg_rating, w.total_reviews,
    w.total_bookings, w.response_time_mins, w.years_experience,
    w.city, w.country, w.preferred_language,
    w.created_at, w.updated_at, w.deleted_at,
    w.suspended_until, w.suspended_reason, w.banned_at, w.banned_reason,
    w.warning_count, w.last_warning_at, w.last_warning_reason,
    w.is_featured, w.featured_at,
    w.reverification_requested_at, w.reverification_reason,
    fn_worker_status(w.is_active, w.deleted_at, w.banned_at, w.suspended_until),
    fn_worker_presence(w.is_active, w.manually_paused, w.is_on_job, w.last_seen_at),
    (SELECT count(*) FROM worker_skills s WHERE s.worker_id = w.id),
    (SELECT count(*) FROM worker_service_offerings o WHERE o.worker_id = w.id AND o.is_active = true),
    (SELECT count(*) FROM worker_documents d WHERE d.worker_id = w.id),
    (SELECT count(*) FROM worker_documents d WHERE d.worker_id = w.id AND d.status = 'PENDING'),
    ARRAY(
      SELECT c.name::text
      FROM worker_skills s JOIN categories c ON c.id = s.category_id
      WHERE s.worker_id = w.id
      ORDER BY c.sort_order, c.name
    ),
    ARRAY(
      SELECT b.badge::text FROM worker_badges b
      WHERE b.worker_id = w.id ORDER BY b.created_at
    )
  FROM workers w
  WHERE w.id = p_worker_id;
$$ LANGUAGE sql STABLE;