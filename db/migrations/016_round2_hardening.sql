-- 016_round2_hardening.sql
-- Audit round 2. Safe to run once; every statement is idempotent.

-- ───────────────────────────────────────────────────────────
-- 1. audit log: resource_id was UUID but category / service / pricing
--    audits write slugs ("electrician", "pricing"). Those inserts failed AFTER the change committed.
-- ───────────────────────────────────────────────────────────
ALTER TABLE admin_audit_log
  ALTER COLUMN resource_id TYPE VARCHAR(100) USING resource_id::text;

CREATE INDEX IF NOT EXISTS idx_admin_audit_resource
  ON admin_audit_log (resource_type, resource_id, created_at DESC);

-- ───────────────────────────────────────────────────────────
-- 2. Pricing configuration shared with booking-service (M-05)
--    booking-service charges customer fee and worker commission separately.
-- ───────────────────────────────────────────────────────────
ALTER TABLE platform_pricing_config
  ADD COLUMN IF NOT EXISTS customer_platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS worker_commission_percent     NUMERIC(5,2) NOT NULL DEFAULT 5.00;

ALTER TABLE platform_pricing_config ALTER COLUMN platform_fee_percent SET DEFAULT 10.00;
-- platform_fee_percent is now informational: customer + worker
UPDATE platform_pricing_config
   SET platform_fee_percent = customer_platform_fee_percent + worker_commission_percent
 WHERE id = TRUE;

-- ───────────────────────────────────────────────────────────
-- 3. get_user_kpis() was called by the code but defined nowhere
-- ───────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_user_kpis();
CREATE OR REPLACE FUNCTION public.get_user_kpis()
RETURNS TABLE (
  total_users          bigint,
  signups_today        bigint,
  signups_yesterday    bigint,
  active_users         bigint,
  suspended_or_banned  bigint,
  signups_sparkline_7d bigint[]
) AS $$
  WITH b AS (
    SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi') AS today_start
  )
  SELECT
    (SELECT count(*) FROM users u WHERE u.deleted_at IS NULL),
    (SELECT count(*) FROM users u WHERE u.deleted_at IS NULL AND u.created_at >= b.today_start),
    (SELECT count(*) FROM users u
       WHERE u.deleted_at IS NULL
         AND u.created_at >= b.today_start - interval '1 day'
         AND u.created_at <  b.today_start),
    (SELECT count(*) FROM users u
       WHERE fn_user_status(u.is_active, u.deleted_at, u.banned_at, u.suspended_until) = 'active'),
    (SELECT count(*) FROM users u
       WHERE fn_user_status(u.is_active, u.deleted_at, u.banned_at, u.suspended_until) IN ('suspended', 'banned')),
    (SELECT array_agg(s.c ORDER BY s.d)
       FROM (
         SELECT g.d,
                (SELECT count(*) FROM users u
                   WHERE u.deleted_at IS NULL
                     AND u.created_at >= b.today_start - (6 - g.d) * interval '1 day'
                     AND u.created_at <  b.today_start - (5 - g.d) * interval '1 day') AS c
         FROM generate_series(0, 6) AS g(d)
       ) s)
  FROM b;
$$ LANGUAGE sql STABLE;

-- ───────────────────────────────────────────────────────────
-- 4. One date basis for money everywhere: completion time, Asia/Karachi.
--    (the dashboard used payments.created_at / UTC dates, finance used completion time)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_kpis()
RETURNS JSON AS $$
DECLARE
  v_today  date := (now() AT TIME ZONE 'Asia/Karachi')::date;
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'revenueToday', (
      SELECT COALESCE(SUM(b.estimated_total), 0) FROM bookings b
       WHERE b.status IN ('COMPLETED', 'AUTO_COMPLETED')
         AND (COALESCE(b.completed_at, b.updated_at) AT TIME ZONE 'Asia/Karachi')::date = v_today
    ),
    'revenueYesterday', (
      SELECT COALESCE(SUM(b.estimated_total), 0) FROM bookings b
       WHERE b.status IN ('COMPLETED', 'AUTO_COMPLETED')
         AND (COALESCE(b.completed_at, b.updated_at) AT TIME ZONE 'Asia/Karachi')::date = v_today - 1
    ),
    'revenueSparkline', (
      SELECT COALESCE(json_agg(day_total ORDER BY day), '[]')
      FROM (
        SELECT d::date AS day,
          (SELECT COALESCE(SUM(x.estimated_total), 0) FROM bookings x
            WHERE x.status IN ('COMPLETED', 'AUTO_COMPLETED')
              AND (COALESCE(x.completed_at, x.updated_at) AT TIME ZONE 'Asia/Karachi')::date = d::date) AS day_total
        FROM generate_series(v_today - 6, v_today, '1 day') d
      ) s
    ),
    'activeBookingsNow', (SELECT COUNT(*) FROM bookings WHERE status = 'IN_PROGRESS'),
    'activeBookingsSparkline', (
      SELECT COALESCE(json_agg(day_total ORDER BY day), '[]')
      FROM (
        SELECT d::date AS day,
          (SELECT COUNT(*) FROM bookings x
            WHERE x.started_at IS NOT NULL
              AND (x.started_at AT TIME ZONE 'Asia/Karachi')::date = d::date) AS day_total
        FROM generate_series(v_today - 6, v_today, '1 day') d
      ) s
    ),
    'newSignupsToday', (
      (SELECT COUNT(*) FROM users   WHERE (created_at AT TIME ZONE 'Asia/Karachi')::date = v_today) +
      (SELECT COUNT(*) FROM workers WHERE (created_at AT TIME ZONE 'Asia/Karachi')::date = v_today)
    ),
    'newSignupsYesterday', (
      (SELECT COUNT(*) FROM users   WHERE (created_at AT TIME ZONE 'Asia/Karachi')::date = v_today - 1) +
      (SELECT COUNT(*) FROM workers WHERE (created_at AT TIME ZONE 'Asia/Karachi')::date = v_today - 1)
    ),
    'signupsSparkline', (
      SELECT COALESCE(json_agg(day_total ORDER BY day), '[]')
      FROM (
        SELECT d::date AS day,
          ((SELECT COUNT(*) FROM users   WHERE (created_at AT TIME ZONE 'Asia/Karachi')::date = d::date) +
           (SELECT COUNT(*) FROM workers WHERE (created_at AT TIME ZONE 'Asia/Karachi')::date = d::date)) AS day_total
        FROM generate_series(v_today - 6, v_today, '1 day') d
      ) s
    ),
    'pendingVerifications', (SELECT COUNT(*) FROM workers WHERE verification_status = 'PENDING_REVIEW'),
    'pendingVerificationsSparkline', (
      SELECT COALESCE(json_agg(day_total ORDER BY day), '[]')
      FROM (
        SELECT d::date AS day,
          (SELECT COUNT(*) FROM workers
            WHERE verification_status = 'PENDING_REVIEW'
              AND (created_at AT TIME ZONE 'Asia/Karachi')::date <= d::date) AS day_total
        FROM generate_series(v_today - 6, v_today, '1 day') d
      ) s
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_revenue_chart(p_period TEXT DEFAULT 'daily')
RETURNS TABLE (bucket TIMESTAMPTZ, gross_revenue NUMERIC, platform_fees NUMERIC) AS $$
DECLARE
  v_unit TEXT;
  v_from TIMESTAMPTZ;
BEGIN
  IF p_period = 'weekly' THEN
    v_unit := 'week';  v_from := now() - INTERVAL '12 weeks';
  ELSIF p_period = 'monthly' THEN
    v_unit := 'month'; v_from := now() - INTERVAL '12 months';
  ELSE
    v_unit := 'day';   v_from := now() - INTERVAL '30 days';
  END IF;

  RETURN QUERY
    SELECT (date_trunc(v_unit, COALESCE(b.completed_at, b.updated_at) AT TIME ZONE 'Asia/Karachi')
              AT TIME ZONE 'Asia/Karachi'),
           COALESCE(SUM(b.estimated_total), 0),
           COALESCE(SUM(b.platform_fee), 0)
      FROM bookings b
     WHERE b.status IN ('COMPLETED', 'AUTO_COMPLETED')
       AND COALESCE(b.completed_at, b.updated_at) > v_from
     GROUP BY 1
     ORDER BY 1;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_revenue_by_city()
RETURNS TABLE (city TEXT, gross_revenue NUMERIC, bookings_count BIGINT) AS $$
  SELECT COALESCE(ua.city, w.city, 'Other')::text,
         COALESCE(SUM(b.estimated_total), 0),
         COUNT(*)
    FROM bookings b
    LEFT JOIN workers w         ON w.id  = b.worker_id
    LEFT JOIN user_addresses ua ON ua.id = b.address_id
   WHERE b.status IN ('COMPLETED', 'AUTO_COMPLETED')
     AND COALESCE(b.completed_at, b.updated_at) > now() - INTERVAL '30 days'
   GROUP BY 1
   ORDER BY 2 DESC;
$$ LANGUAGE sql STABLE;

-- ───────────────────────────────────────────────────────────
-- 5. CANONICAL get_needs_attention(). It was redefined in 002, 010 and 014.
--    This is the final version (014 + stuck IN_PROGRESS jobs). Never re-run 002 / 010 / 014 after 016 without
--    re-running this file's section 5.
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_needs_attention()
RETURNS JSON AS $$
DECLARE
  v_flagged JSON := '[]'::json;
  v_result  JSON;
BEGIN
  IF to_regclass('public.review_reports') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COALESCE(json_agg(json_build_object(
        'id', x.id, 'rating', x.rating, 'reportCount', x.open_reports
      )), '[]'::json)
      FROM (
        SELECT r.id, r.rating, count(*)::int AS open_reports
        FROM review_reports rr
        JOIN reviews r ON r.id = rr.review_id
        WHERE rr.resolved_at IS NULL
        GROUP BY r.id, r.rating
      ) x
    $q$ INTO v_flagged;
  END IF;

  SELECT json_build_object(
    'staleDisputes', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', d.id, 'bookingId', d.booking_id,
        'ageHours', EXTRACT(EPOCH FROM (NOW() - d.created_at)) / 3600
      )), '[]')
      FROM disputes d
      WHERE d.status::text IN ('OPEN', 'WORKER_RESPONDED', 'UNDER_REVIEW')
        AND d.created_at < NOW() - INTERVAL '24 hours'
    ),
    'staleVerifications', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', w.id, 'name', w.name,
        'category', (
          SELECT c.name FROM worker_skills ws
          JOIN categories c ON c.id = ws.category_id
          WHERE ws.worker_id = w.id
          ORDER BY ws.created_at LIMIT 1
        ),
        'ageHours', EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600
      )), '[]')
      FROM workers w
      WHERE w.verification_status = 'PENDING_REVIEW' AND w.created_at < NOW() - INTERVAL '48 hours'
    ),
    'failedPayments', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', p.id, 'bookingId', p.booking_id, 'amount', p.booking_amount
      )), '[]')
      FROM payments p WHERE p.status = 'FAILED'
    ),
    'stuckPendingBookings', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', b.id, 'city', w.city, 'category', b.category_id,
        'ageMinutes', EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 60
      )), '[]')
      FROM bookings b
      LEFT JOIN workers w ON w.id = b.worker_id
      WHERE b.status = 'PENDING' AND b.created_at < NOW() - INTERVAL '30 minutes'
    ),
    'stuckInProgress', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', b.id, 'workerId', b.worker_id,
        'hoursOverdue', EXTRACT(EPOCH FROM (
           NOW() - COALESCE(b.scheduled_end_at, b.scheduled_at + b.duration_hours * INTERVAL '1 hour'))) / 3600
      )), '[]')
      FROM bookings b
      WHERE b.status = 'IN_PROGRESS'
        AND COALESCE(b.scheduled_end_at, b.scheduled_at + b.duration_hours * INTERVAL '1 hour')
            < NOW() - INTERVAL '6 hours'
    ),
    'flaggedReviews', v_flagged
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ───────────────────────────────────────────────────────────
-- 6. Row level security on admin-owned tables (C-08).
--    Tables shared with other services (worker_badges, worker_verification_reviews) are NOT touched here.
--    The admin server connects with a role that bypasses RLS (Supabase `postgres`).
-- ───────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_users', 'admin_mfa_backup_codes', 'admin_trusted_devices', 'admin_audit_log',
    'admin_event_outbox', 'platform_events', 'platform_pricing_config', 'booking_status_history',
    'booking_admin_notes', 'dispute_admin_notes', 'review_admin_notes', 'search_demand_log',
    'admin_migrations'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────
-- 7. admin_event_outbox is deprecated: owning services emit their own events now.
-- ───────────────────────────────────────────────────────────
COMMENT ON TABLE admin_event_outbox IS
  'DEPRECATED since admin v1.1.0. Nothing writes here any more; owning services publish their own events.';