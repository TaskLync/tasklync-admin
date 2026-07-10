-- 003_waitlist_functions.sql

-- Enables fast ILIKE search on email (used by the search box).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_waitlist_status      ON waitlist (status);
CREATE INDEX IF NOT EXISTS idx_waitlist_utm_source  ON waitlist (utm_source);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at  ON waitlist (created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_position    ON waitlist (position);
CREATE INDEX IF NOT EXISTS idx_waitlist_email_trgm  ON waitlist USING gin (email gin_trgm_ops);

-- 3.1 KPI aggregate — single round trip for the whole KPI row
CREATE OR REPLACE FUNCTION get_waitlist_kpis()
RETURNS TABLE (
  total_signups      bigint,
  signups_today       bigint,
  signups_yesterday   bigint,
  signups_this_week   bigint,
  signups_last_week   bigint,
  pending_count       bigint,
  invited_count       bigint,
  converted_count     bigint
) AS $$
  SELECT
    (SELECT COUNT(*) FROM waitlist),
    (SELECT COUNT(*) FROM waitlist
       WHERE created_at >= date_trunc('day', now())),
    (SELECT COUNT(*) FROM waitlist
       WHERE created_at >= date_trunc('day', now()) - interval '1 day'
         AND created_at <  date_trunc('day', now())),
    (SELECT COUNT(*) FROM waitlist
       WHERE created_at >= date_trunc('week', now())),
    (SELECT COUNT(*) FROM waitlist
       WHERE created_at >= date_trunc('week', now()) - interval '7 days'
         AND created_at <  date_trunc('week', now())),
    (SELECT COUNT(*) FROM waitlist WHERE status = 'pending'),
    (SELECT COUNT(*) FROM waitlist WHERE status = 'invited'),
    (SELECT COUNT(*) FROM waitlist WHERE status = 'converted');
$$ LANGUAGE sql STABLE;

-- 3.2 Growth series — bucketed signups + running cumulative total
CREATE OR REPLACE FUNCTION get_waitlist_growth(p_period text, p_buckets int)
RETURNS TABLE (bucket timestamptz, signups bigint) AS $$
DECLARE
  v_interval    interval;
  v_trunc_unit  text;
BEGIN
  v_interval := CASE p_period
    WHEN 'weekly'  THEN interval '1 week'
    WHEN 'monthly' THEN interval '1 month'
    ELSE interval '1 day'
  END;

  v_trunc_unit := CASE p_period
    WHEN 'weekly'  THEN 'week'
    WHEN 'monthly' THEN 'month'
    ELSE 'day'
  END;

  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(
      date_trunc(v_trunc_unit, now()) - (v_interval * (p_buckets - 1)),
      date_trunc(v_trunc_unit, now()),
      v_interval
    ) AS bucket_start
  )
  SELECT
    b.bucket_start,
    COUNT(w.id)
  FROM buckets b
  LEFT JOIN waitlist w
    ON w.created_at >= b.bucket_start
   AND w.created_at <  b.bucket_start + v_interval
  GROUP BY b.bucket_start
  ORDER BY b.bucket_start;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3.3 UTM source breakdown (NULL source bucketed as "direct" traffic)
CREATE OR REPLACE FUNCTION get_utm_breakdown()
RETURNS TABLE (utm_source text, count bigint) AS $$
  SELECT utm_source, COUNT(*)
  FROM waitlist
  GROUP BY utm_source
  ORDER BY COUNT(*) DESC;
$$ LANGUAGE sql STABLE;