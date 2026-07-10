-- =========================================================
-- 002_dashboard_functions.sql (CORRECTED — matches real schemas)
-- Matches column names from: auth-service, user-service,
-- worker-service, booking-service, payment-service.
--
-- v2 fix: get_needs_attention() staleVerifications no longer
-- references the non-existent workers.category_id column.
-- Worker category is now resolved via worker_skills -> categories,
-- same pattern already used in fn_log_worker_verified() below.
-- =========================================================

-- ---------------------------------------------------------
-- 1. platform_events — normalized feed for Section 1.3
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  VARCHAR(50) NOT NULL,
  message     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_created_at
  ON platform_events (created_at DESC);

-- NOTE: no Supabase Realtime publication — plain Postgres via pg pool.
-- ActivityFeed.tsx polls via SWR every 30s (see hooks/useDashboard.ts).

-- ---------------------------------------------------------
-- 2. Triggers that populate platform_events
-- ---------------------------------------------------------

-- booking.created
CREATE OR REPLACE FUNCTION fn_log_booking_created() RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
  v_worker_name TEXT;
  v_worker_city TEXT;      -- ⚠️ ASSUMPTION: city derived from assigned worker (bookings has no city column yet)
  v_category_name TEXT;
BEGIN
  SELECT name INTO v_user_name FROM users WHERE id = NEW.user_id;
  SELECT name, city INTO v_worker_name, v_worker_city FROM workers WHERE id = NEW.worker_id;
  SELECT name INTO v_category_name FROM categories WHERE id = NEW.category_id;

  INSERT INTO platform_events (event_type, message, metadata)
  VALUES (
    'booking.created',
    format('%s booked %s for %s in %s',
      COALESCE(v_user_name, 'A user'),
      COALESCE(v_worker_name, 'a worker'),
      COALESCE(v_category_name, NEW.category_id),
      COALESCE(v_worker_city, 'Unknown')),
    jsonb_build_object('booking_id', NEW.id, 'user_id', NEW.user_id, 'worker_id', NEW.worker_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_created ON bookings;
CREATE TRIGGER trg_booking_created
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION fn_log_booking_created();

-- booking.disputed
CREATE OR REPLACE FUNCTION fn_log_booking_disputed() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DISPUTED' AND (OLD.status IS DISTINCT FROM 'DISPUTED') THEN
    INSERT INTO platform_events (event_type, message, metadata)
    VALUES (
      'booking.disputed',
      format('Dispute opened on booking #%s — needs review', LEFT(NEW.id::text, 8)),
      jsonb_build_object('booking_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_disputed ON bookings;
CREATE TRIGGER trg_booking_disputed
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION fn_log_booking_disputed();

-- worker.verified
CREATE OR REPLACE FUNCTION fn_log_worker_verified() RETURNS TRIGGER AS $$
DECLARE
  v_category_name TEXT;
BEGIN
  IF NEW.verification_status = 'VERIFIED' AND (OLD.verification_status IS DISTINCT FROM 'VERIFIED') THEN
    SELECT c.name INTO v_category_name
    FROM worker_skills ws
    JOIN categories c ON c.id = ws.category_id
    WHERE ws.worker_id = NEW.id
    ORDER BY ws.created_at
    LIMIT 1;

    INSERT INTO platform_events (event_type, message, metadata)
    VALUES (
      'worker.verified',
      format('Admin approved %s (%s)', NEW.name, COALESCE(v_category_name, 'General')),
      jsonb_build_object('worker_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_worker_verified ON workers;
CREATE TRIGGER trg_worker_verified
  AFTER UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION fn_log_worker_verified();

-- payment.completed
CREATE OR REPLACE FUNCTION fn_log_payment_completed() RETURNS TRIGGER AS $$
DECLARE
  v_worker_name TEXT;
BEGIN
  IF NEW.status = 'RELEASED' AND (OLD.status IS DISTINCT FROM 'RELEASED') THEN
    SELECT name INTO v_worker_name FROM workers WHERE id = NEW.worker_id;

    INSERT INTO platform_events (event_type, message, metadata)
    VALUES (
      'payment.completed',
      format('PKR %s released to worker %s', NEW.worker_amount, COALESCE(v_worker_name, 'unknown')),
      jsonb_build_object('payment_id', NEW.id, 'booking_id', NEW.booking_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_completed ON payments;
CREATE TRIGGER trg_payment_completed
  AFTER UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION fn_log_payment_completed();

-- user.registered
CREATE OR REPLACE FUNCTION fn_log_user_registered() RETURNS TRIGGER AS $$
BEGIN
  -- ⚠️ ASSUMPTION: no city at signup (user_addresses is a separate table, populated later)
  INSERT INTO platform_events (event_type, message, metadata)
  VALUES (
    'user.registered',
    format('New user: %s', COALESCE(NEW.name, NEW.phone, NEW.email, 'Unknown')),
    jsonb_build_object('user_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_registered ON users;
CREATE TRIGGER trg_user_registered
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION fn_log_user_registered();

-- ---------------------------------------------------------
-- 3. get_dashboard_kpis() — Section 1.1
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_dashboard_kpis()
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'revenueToday', (
      SELECT COALESCE(SUM(p.booking_amount), 0)
      FROM payments p
      WHERE p.status IN ('HELD','RELEASED') AND p.created_at::date = CURRENT_DATE
    ),
    'revenueYesterday', (
      SELECT COALESCE(SUM(p.booking_amount), 0)
      FROM payments p
      WHERE p.status IN ('HELD','RELEASED') AND p.created_at::date = CURRENT_DATE - 1
    ),
    'revenueSparkline', (
      SELECT COALESCE(json_agg(day_total ORDER BY day), '[]')
      FROM (
        SELECT d::date AS day,
          (SELECT COALESCE(SUM(booking_amount), 0) FROM payments
           WHERE status IN ('HELD','RELEASED') AND created_at::date = d::date) AS day_total
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
      ) s
    ),
    'activeBookingsNow', (
      SELECT COUNT(*) FROM bookings WHERE status = 'IN_PROGRESS'
    ),
    'activeBookingsSparkline', (
      SELECT COALESCE(json_agg(day_total ORDER BY day), '[]')
      FROM (
        SELECT d::date AS day,
          (SELECT COUNT(*) FROM bookings
           WHERE status = 'IN_PROGRESS' AND created_at::date = d::date) AS day_total
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
      ) s
    ),
    'newSignupsToday', (
      (SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE) +
      (SELECT COUNT(*) FROM workers WHERE created_at::date = CURRENT_DATE)
    ),
    'newSignupsYesterday', (
      (SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE - 1) +
      (SELECT COUNT(*) FROM workers WHERE created_at::date = CURRENT_DATE - 1)
    ),
    'signupsSparkline', (
      SELECT COALESCE(json_agg(day_total ORDER BY day), '[]')
      FROM (
        SELECT d::date AS day,
          ((SELECT COUNT(*) FROM users WHERE created_at::date = d::date) +
           (SELECT COUNT(*) FROM workers WHERE created_at::date = d::date)) AS day_total
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
      ) s
    ),
    'pendingVerifications', (
      SELECT COUNT(*) FROM workers WHERE verification_status = 'PENDING_REVIEW'
    ),
    'pendingVerificationsSparkline', (
      SELECT COALESCE(json_agg(day_total ORDER BY day), '[]')
      FROM (
        SELECT d::date AS day,
          (SELECT COUNT(*) FROM workers
           WHERE verification_status = 'PENDING_REVIEW' AND created_at::date <= d::date) AS day_total
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') d
      ) s
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------
-- 4. get_needs_attention() — Section 1.2
-- FIXED: staleVerifications now resolves category via
-- worker_skills -> categories (workers has no category_id column)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_needs_attention()
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'staleDisputes', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', d.id, 'bookingId', d.booking_id,
        'ageHours', EXTRACT(EPOCH FROM (NOW() - d.created_at)) / 3600
      )), '[]')
      FROM disputes d
      WHERE d.status = 'OPEN' AND d.created_at < NOW() - INTERVAL '24 hours'
    ),
    'staleVerifications', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', w.id, 'name', w.name,
        'category', (
          SELECT c.name FROM worker_skills ws
          JOIN categories c ON c.id = ws.category_id
          WHERE ws.worker_id = w.id
          ORDER BY ws.created_at
          LIMIT 1
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
      FROM payments p
      WHERE p.status = 'FAILED'
    ),
    'stuckPendingBookings', (
      -- ⚠️ ASSUMPTION: city derived from assigned worker (bookings has no city column yet)
      SELECT COALESCE(json_agg(json_build_object(
        'id', b.id, 'city', w.city, 'category', b.category_id,
        'ageMinutes', EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 60
      )), '[]')
      FROM bookings b
      LEFT JOIN workers w ON w.id = b.worker_id
      WHERE b.status = 'PENDING' AND b.created_at < NOW() - INTERVAL '30 minutes'
    ),
    'flaggedReviews', '[]'::json  -- placeholder — reviews table not built yet
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------
-- 5. get_revenue_chart(period) — Section 1.4
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_revenue_chart(p_period TEXT DEFAULT 'daily')
RETURNS TABLE (
  bucket TIMESTAMPTZ,
  gross_revenue NUMERIC,
  platform_fees NUMERIC
) AS $$
BEGIN
  IF p_period = 'weekly' THEN
    RETURN QUERY
      SELECT date_trunc('week', b.created_at) AS bucket,
             COALESCE(SUM(b.estimated_total), 0),
             COALESCE(SUM(b.platform_fee), 0)
      FROM bookings b
      WHERE b.status IN ('COMPLETED','AUTO_COMPLETED') AND b.created_at > NOW() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1;
  ELSIF p_period = 'monthly' THEN
    RETURN QUERY
      SELECT date_trunc('month', b.created_at) AS bucket,
             COALESCE(SUM(b.estimated_total), 0),
             COALESCE(SUM(b.platform_fee), 0)
      FROM bookings b
      WHERE b.status IN ('COMPLETED','AUTO_COMPLETED') AND b.created_at > NOW() - INTERVAL '12 months'
      GROUP BY 1 ORDER BY 1;
  ELSE -- daily
    RETURN QUERY
      SELECT date_trunc('day', b.created_at) AS bucket,
             COALESCE(SUM(b.estimated_total), 0),
             COALESCE(SUM(b.platform_fee), 0)
      FROM bookings b
      WHERE b.status IN ('COMPLETED','AUTO_COMPLETED') AND b.created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- City breakdown table shown below the chart
CREATE OR REPLACE FUNCTION get_revenue_by_city()
RETURNS TABLE (city TEXT, gross_revenue NUMERIC, bookings_count BIGINT) AS $$
  -- ⚠️ ASSUMPTION: city derived from assigned worker (bookings has no city column yet)
  SELECT COALESCE(w.city, 'Other'), COALESCE(SUM(b.estimated_total), 0), COUNT(*)
  FROM bookings b
  LEFT JOIN workers w ON w.id = b.worker_id
  WHERE b.status IN ('COMPLETED','AUTO_COMPLETED') AND b.created_at > NOW() - INTERVAL '30 days'
  GROUP BY w.city
  ORDER BY 2 DESC;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------
-- 6. get_booking_funnel() — Section 1.5
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_booking_funnel()
RETURNS JSON AS $$
DECLARE
  v_created BIGINT;
  v_accepted BIGINT;
  v_started BIGINT;
  v_completed BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_created FROM bookings WHERE created_at > NOW() - INTERVAL '30 days';
  SELECT COUNT(*) INTO v_accepted FROM bookings
    WHERE created_at > NOW() - INTERVAL '30 days'
    AND status IN ('ACCEPTED','IN_PROGRESS','COMPLETED_BY_WORKER','COMPLETED','AUTO_COMPLETED');
  SELECT COUNT(*) INTO v_started FROM bookings
    WHERE created_at > NOW() - INTERVAL '30 days'
    AND status IN ('IN_PROGRESS','COMPLETED_BY_WORKER','COMPLETED','AUTO_COMPLETED');
  SELECT COUNT(*) INTO v_completed FROM bookings
    WHERE created_at > NOW() - INTERVAL '30 days'
    AND status IN ('COMPLETED','AUTO_COMPLETED');

  RETURN json_build_array(
    json_build_object('stage', 'Created',   'count', v_created,   'pct', 100),
    json_build_object('stage', 'Accepted',  'count', v_accepted,  'pct', CASE WHEN v_created = 0 THEN 0 ELSE ROUND(v_accepted::numeric / v_created * 100, 1) END),
    json_build_object('stage', 'Started',   'count', v_started,   'pct', CASE WHEN v_created = 0 THEN 0 ELSE ROUND(v_started::numeric / v_created * 100, 1) END),
    json_build_object('stage', 'Completed', 'count', v_completed, 'pct', CASE WHEN v_created = 0 THEN 0 ELSE ROUND(v_completed::numeric / v_created * 100, 1) END)
  );
END;
$$ LANGUAGE plpgsql STABLE;