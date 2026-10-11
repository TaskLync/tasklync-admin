-- 011_analytics.sql
-- Analytics & Insights page. Read-only SQL functions + supporting indexes.
-- "Day" always means a calendar day in Asia/Karachi (same convention as workers/bookings/payments).

-- ---------------------------------------------------------
-- 0. Indexes for the aggregations
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bookings_user_created     ON public.bookings (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_worker_created   ON public.bookings (worker_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_category_created ON public.bookings (category_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at          ON public.users (created_at);
CREATE INDEX IF NOT EXISTS idx_workers_created_at        ON public.workers (created_at);

-- ---------------------------------------------------------
-- 1. Helper: start of a Karachi calendar day as timestamptz
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_day_start(p_day date)
RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT p_day::timestamp AT TIME ZONE 'Asia/Karachi';
$$;

-- ---------------------------------------------------------
-- 2. Period stats: one row of counts for bookings CREATED in [p_from, p_to)
--    avg_value is by completion time (matches Finance).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_period_stats(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  active_users   bigint,
  active_workers bigint,
  created        bigint,
  decided        bigint,
  accepted       bigint,
  completed      bigint,
  closed         bigint,
  avg_value      numeric
)
LANGUAGE sql STABLE AS $$
  SELECT
    count(DISTINCT b.user_id),
    count(DISTINCT b.worker_id),
    count(*),
    count(*) FILTER (WHERE b.status::text <> 'PENDING'),
    count(*) FILTER (WHERE b.status::text IN
      ('ACCEPTED','IN_PROGRESS','COMPLETED_BY_WORKER','COMPLETED','AUTO_COMPLETED','DISPUTED','REFUNDED','RESOLVED')),
    count(*) FILTER (WHERE b.status::text IN ('COMPLETED','AUTO_COMPLETED')),
    count(*) FILTER (WHERE b.status::text IN
      ('COMPLETED','AUTO_COMPLETED','CANCELLED','REJECTED','DISPUTED','REFUNDED','RESOLVED')),
    (SELECT avg(x.estimated_total)
       FROM bookings x
      WHERE x.status::text IN ('COMPLETED','AUTO_COMPLETED')
        AND COALESCE(x.completed_at, x.updated_at) >= p_from
        AND COALESCE(x.completed_at, x.updated_at) <  p_to)
  FROM bookings b
  WHERE b.created_at >= p_from AND b.created_at < p_to;
$$;

-- ---------------------------------------------------------
-- 3. Retention: users whose FIRST booking falls in [p_from, p_to),
--    and how many booked again within 7 days of that first booking.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_retention(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (cohort bigint, retained bigint)
LANGUAGE sql STABLE AS $$
  WITH first_booking AS (
    SELECT b.user_id, min(b.created_at) AS first_at
    FROM bookings b
    WHERE b.user_id IS NOT NULL
    GROUP BY b.user_id
  ),
  cohort AS (
    SELECT * FROM first_booking
    WHERE first_at >= p_from AND first_at < p_to
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.user_id = c.user_id
        AND b.created_at >  c.first_at
        AND b.created_at <= c.first_at + interval '7 days'
    ))
  FROM cohort c;
$$;

-- ---------------------------------------------------------
-- 4. KPI payload (Section 8.1). Fixed 7-day windows.
--    today/yesterday are ROLLING 24h windows so they are comparable.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_analytics_kpis()
RETURNS json
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Karachi')::date;
BEGIN
  RETURN json_build_object(
    'last24h', (SELECT row_to_json(s) FROM analytics_period_stats(now() - interval '24 hours', now()) s),
    'prev24h', (SELECT row_to_json(s) FROM analytics_period_stats(now() - interval '48 hours', now() - interval '24 hours') s),
    'current', (SELECT row_to_json(s) FROM analytics_period_stats(
                  analytics_day_start(v_today - 6), analytics_day_start(v_today + 1)) s),
    'previous', (SELECT row_to_json(s) FROM analytics_period_stats(
                  analytics_day_start(v_today - 13), analytics_day_start(v_today - 6)) s),
    'retention', json_build_object(
      'current',  (SELECT row_to_json(r) FROM analytics_retention(
                     analytics_day_start(v_today - 13), analytics_day_start(v_today - 6)) r),
      'previous', (SELECT row_to_json(r) FROM analytics_retention(
                     analytics_day_start(v_today - 20), analytics_day_start(v_today - 13)) r)
    )
  );
END;
$$;

-- ---------------------------------------------------------
-- 5. Growth series (Section 8.2). One row per Karachi day.
--    Computes 6 extra days so the 7-day moving average is correct from day 1.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_analytics_growth(p_days int DEFAULT 30)
RETURNS TABLE (
  bucket             date,
  new_users          bigint,
  new_workers        bigint,
  bookings_created   bigint,
  bookings_completed bigint,
  bookings_cancelled bigint,
  gross_revenue      numeric,
  gross_ma7          numeric
)
LANGUAGE sql STABLE AS $$
  WITH t AS (
    SELECT (now() AT TIME ZONE 'Asia/Karachi')::date AS today
  ),
  lo AS (
    SELECT analytics_day_start(t.today - (p_days + 5)) AS ts FROM t
  ),
  span AS (
    SELECT t.today - n AS d FROM t, generate_series(0, p_days + 5) AS n
  ),
  nu AS (
    SELECT (u.created_at AT TIME ZONE 'Asia/Karachi')::date AS d, count(*) AS c
    FROM users u, lo WHERE u.created_at >= lo.ts GROUP BY 1
  ),
  nw AS (
    SELECT (w.created_at AT TIME ZONE 'Asia/Karachi')::date AS d, count(*) AS c
    FROM workers w, lo WHERE w.created_at >= lo.ts GROUP BY 1
  ),
  bc AS (
    SELECT (b.created_at AT TIME ZONE 'Asia/Karachi')::date AS d, count(*) AS c
    FROM bookings b, lo WHERE b.created_at >= lo.ts GROUP BY 1
  ),
  bd AS (
    SELECT (COALESCE(b.completed_at, b.updated_at) AT TIME ZONE 'Asia/Karachi')::date AS d,
           count(*) AS c, COALESCE(sum(b.estimated_total), 0) AS g
    FROM bookings b, lo
    WHERE b.status::text IN ('COMPLETED','AUTO_COMPLETED')
      AND COALESCE(b.completed_at, b.updated_at) >= lo.ts
    GROUP BY 1
  ),
  bx AS (
    SELECT (b.updated_at AT TIME ZONE 'Asia/Karachi')::date AS d, count(*) AS c
    FROM bookings b, lo
    WHERE b.status::text IN ('CANCELLED','REJECTED') AND b.updated_at >= lo.ts
    GROUP BY 1
  ),
  daily AS (
    SELECT s.d,
           COALESCE(nu.c, 0) AS new_users,
           COALESCE(nw.c, 0) AS new_workers,
           COALESCE(bc.c, 0) AS created,
           COALESCE(bd.c, 0) AS completed,
           COALESCE(bx.c, 0) AS cancelled,
           COALESCE(bd.g, 0) AS gross
    FROM span s
    LEFT JOIN nu ON nu.d = s.d
    LEFT JOIN nw ON nw.d = s.d
    LEFT JOIN bc ON bc.d = s.d
    LEFT JOIN bd ON bd.d = s.d
    LEFT JOIN bx ON bx.d = s.d
  ),
  with_ma AS (
    SELECT d.*,
           avg(d.gross) OVER (ORDER BY d.d ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7
    FROM daily d
  )
  SELECT m.d, m.new_users::bigint, m.new_workers::bigint, m.created::bigint,
         m.completed::bigint, m.cancelled::bigint, m.gross::numeric, round(m.ma7, 2)::numeric
  FROM with_ma m, t
  WHERE m.d >= t.today - (p_days - 1)
  ORDER BY m.d;
$$;

-- ---------------------------------------------------------
-- 6. Bookings per city per day (stacked area chart)
--    City = job address city, falling back to the worker's city (same as Bookings/Payments).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_analytics_city_trend(p_days int DEFAULT 30)
RETURNS TABLE (bucket date, city text, bookings bigint)
LANGUAGE sql STABLE AS $$
  SELECT (b.created_at AT TIME ZONE 'Asia/Karachi')::date,
         COALESCE(ua.city, w.city, 'Other')::text,
         count(*)
  FROM bookings b
  LEFT JOIN workers w         ON w.id  = b.worker_id
  LEFT JOIN user_addresses ua ON ua.id = b.address_id
  WHERE b.created_at >= analytics_day_start((now() AT TIME ZONE 'Asia/Karachi')::date - (p_days - 1))
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

-- ---------------------------------------------------------
-- 7. City performance
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_analytics_cities(p_days int DEFAULT 30)
RETURNS TABLE (
  city           text,
  bookings       bigint,
  completed      bigint,
  gross          numeric,
  active_workers bigint
)
LANGUAGE sql STABLE AS $$
  WITH bk AS (
    SELECT COALESCE(ua.city, w.city, 'Other')::text AS city,
           b.status::text AS status,
           b.estimated_total
    FROM bookings b
    LEFT JOIN workers w         ON w.id  = b.worker_id
    LEFT JOIN user_addresses ua ON ua.id = b.address_id
    WHERE b.created_at >= analytics_day_start((now() AT TIME ZONE 'Asia/Karachi')::date - (p_days - 1))
  ),
  bagg AS (
    SELECT bk.city,
           count(*) AS bookings,
           count(*) FILTER (WHERE bk.status IN ('COMPLETED','AUTO_COMPLETED')) AS completed,
           COALESCE(sum(bk.estimated_total) FILTER (WHERE bk.status IN ('COMPLETED','AUTO_COMPLETED')), 0) AS gross
    FROM bk GROUP BY bk.city
  ),
  wagg AS (
    SELECT w.city::text AS city, count(*) AS active_workers
    FROM workers w
    WHERE w.city IS NOT NULL
      AND fn_worker_status(w.is_active, w.deleted_at, w.banned_at, w.suspended_until) = 'active'
      AND w.verification_status::text = 'VERIFIED'
    GROUP BY w.city
  )
  SELECT COALESCE(bagg.city, wagg.city),
         COALESCE(bagg.bookings, 0)::bigint,
         COALESCE(bagg.completed, 0)::bigint,
         COALESCE(bagg.gross, 0)::numeric,
         COALESCE(wagg.active_workers, 0)::bigint
  FROM bagg
  FULL JOIN wagg ON wagg.city = bagg.city
  ORDER BY 4 DESC, 2 DESC;
$$;

-- ---------------------------------------------------------
-- 8. Funnels (Section 8.3). Cohort = people REGISTERED in the last p_days.
--    Every stage is a subset of the previous one, so drop-off is never negative.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_analytics_funnels(p_days int DEFAULT 30)
RETURNS json
LANGUAGE sql STABLE AS $$
  WITH win AS (
    SELECT analytics_day_start((now() AT TIME ZONE 'Asia/Karachi')::date - (p_days - 1)) AS from_ts
  ),
  u AS (
    SELECT us.id,
      EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = us.id) AS booked,
      EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = us.id AND b.status::text IN
        ('ACCEPTED','IN_PROGRESS','COMPLETED_BY_WORKER','COMPLETED','AUTO_COMPLETED','DISPUTED','REFUNDED','RESOLVED')) AS accepted,
      EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = us.id AND b.status::text IN
        ('COMPLETED','AUTO_COMPLETED')) AS completed,
      (SELECT count(*) FROM bookings b WHERE b.user_id = us.id) >= 2 AS repeated
    FROM users us, win
    WHERE us.created_at >= win.from_ts AND us.deleted_at IS NULL
  ),
  w AS (
    SELECT wk.id,
      wk.verification_status::text IN ('PENDING_REVIEW','VERIFIED','REJECTED','SUSPENDED') AS submitted,
      wk.verification_status::text = 'VERIFIED' AS verified,
      (wk.last_seen_at IS NOT NULL
        OR EXISTS (SELECT 1 FROM bookings b WHERE b.worker_id = wk.id)) AS seen,
      EXISTS (SELECT 1 FROM bookings b WHERE b.worker_id = wk.id AND b.status::text IN
        ('ACCEPTED','IN_PROGRESS','COMPLETED_BY_WORKER','COMPLETED','AUTO_COMPLETED','DISPUTED','REFUNDED','RESOLVED')) AS accepted,
      EXISTS (SELECT 1 FROM bookings b WHERE b.worker_id = wk.id AND b.status::text IN
        ('COMPLETED','AUTO_COMPLETED')) AS completed
    FROM workers wk, win
    WHERE wk.created_at >= win.from_ts AND wk.deleted_at IS NULL
  )
  SELECT json_build_object(
    'user', (SELECT json_build_object(
        'registered', count(*),
        'booked',     count(*) FILTER (WHERE booked),
        'accepted',   count(*) FILTER (WHERE booked AND accepted),
        'completed',  count(*) FILTER (WHERE booked AND accepted AND completed),
        'repeated',   count(*) FILTER (WHERE booked AND accepted AND completed AND repeated)
      ) FROM u),
    'worker', (SELECT json_build_object(
        'registered', count(*),
        'submitted',  count(*) FILTER (WHERE submitted),
        'verified',   count(*) FILTER (WHERE submitted AND verified),
        'online',     count(*) FILTER (WHERE submitted AND verified AND seen),
        'accepted',   count(*) FILTER (WHERE submitted AND verified AND seen AND accepted),
        'completed',  count(*) FILTER (WHERE submitted AND verified AND seen AND accepted AND completed)
      ) FROM w)
  );
$$;

-- ---------------------------------------------------------
-- 9. Category performance (Section 8.5)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_analytics_categories(p_days int DEFAULT 30)
RETURNS TABLE (
  category_id      text,
  category_name    text,
  bookings         bigint,
  completed        bigint,
  cancelled        bigint,
  closed           bigint,
  avg_value        numeric,
  avg_worker_rating numeric,
  top_worker_id    uuid,
  top_worker_name  text,
  top_worker_jobs  bigint
)
LANGUAGE sql STABLE AS $$
  WITH win AS (
    SELECT analytics_day_start((now() AT TIME ZONE 'Asia/Karachi')::date - (p_days - 1)) AS from_ts
  )
  SELECT c.id::text,
         c.name::text,
         COALESCE(s.bookings, 0)::bigint,
         COALESCE(s.completed, 0)::bigint,
         COALESCE(s.cancelled, 0)::bigint,
         COALESCE(s.closed, 0)::bigint,
         s.avg_value::numeric,
         r.avg_rating::numeric,
         tw.id,
         tw.name::text,
         tw.jobs::bigint
  FROM categories c
  CROSS JOIN win
  LEFT JOIN LATERAL (
    SELECT count(*) AS bookings,
           count(*) FILTER (WHERE b.status::text IN ('COMPLETED','AUTO_COMPLETED')) AS completed,
           count(*) FILTER (WHERE b.status::text = 'CANCELLED') AS cancelled,
           count(*) FILTER (WHERE b.status::text IN
             ('COMPLETED','AUTO_COMPLETED','CANCELLED','REJECTED','DISPUTED','REFUNDED','RESOLVED')) AS closed,
           avg(b.estimated_total) FILTER (WHERE b.status::text IN ('COMPLETED','AUTO_COMPLETED')) AS avg_value
    FROM bookings b
    WHERE b.category_id = c.id AND b.created_at >= win.from_ts
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT wk.id, wk.name, count(*) AS jobs
    FROM bookings b
    JOIN workers wk ON wk.id = b.worker_id
    WHERE b.category_id = c.id
      AND b.created_at >= win.from_ts
      AND b.status::text IN ('COMPLETED','AUTO_COMPLETED')
    GROUP BY wk.id, wk.name
    ORDER BY count(*) DESC, wk.name
    LIMIT 1
  ) tw ON true
  LEFT JOIN LATERAL (
    SELECT avg(wk.avg_rating) AS avg_rating
    FROM worker_skills ws
    JOIN workers wk ON wk.id = ws.worker_id
    WHERE ws.category_id = c.id AND wk.total_reviews > 0 AND wk.deleted_at IS NULL
  ) r ON true
  ORDER BY COALESCE(s.bookings, 0) DESC, c.name;
$$;