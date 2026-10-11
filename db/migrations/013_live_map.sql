-- 013_live_map.sql
-- Live Map page: demand log (written by search-service), supporting indexes,
-- and the demand-grid function. Additive only (IF NOT EXISTS), same as 006/007/008.
--
-- NOTE: `worker_locations` belongs to worker-service, `bookings` to booking-service.
-- Only indexes are added to them here. Tell both teams (section 12 "Backend contract").

-- ---------------------------------------------------------
-- 1. Demand log: one row per customer search that has a location.
--    search-service must INSERT into this table (see "Backend contract" below).
--    Until it does, the map falls back to booking job-site locations.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.search_demand_log (
  id            bigserial PRIMARY KEY,
  user_id       uuid NULL,                      -- no FK (cross-service table)
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  category_id   varchar(50) NULL,               -- NULL = searched without a category
  query_text    text NULL,
  result_count  integer NOT NULL DEFAULT 0,     -- 0 = "no workers found" (unserved demand)
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_demand_created
  ON public.search_demand_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_demand_category_created
  ON public.search_demand_log (category_id, created_at DESC);

-- ---------------------------------------------------------
-- 2. Supporting indexes for the map queries
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_worker_locations_updated_at
  ON public.worker_locations (updated_at DESC);

-- plain index on the enum column (a partial index on status::text is not allowed: cast is not IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON public.bookings (status);

-- ---------------------------------------------------------
-- 3. Demand grid.
--    Buckets points into ~2 km cells (0.02 deg) and compares them with ONLINE verified workers
--    in the same cell.
--      demand   = searches (or bookings) in the last p_hours
--      supply   = online verified workers in the cell
--      unserved = GREATEST(demand - supply * 2, 0)   -- "2 requests per online worker" is the tolerance
--    p_source: 'search' reads search_demand_log, 'bookings' reads bookings.job_site_location.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_map_demand_cells(
  p_hours    integer,
  p_category text,
  p_source   text,
  p_grid     double precision DEFAULT 0.02
)
RETURNS TABLE (
  lat      double precision,
  lng      double precision,
  demand   bigint,
  supply   bigint,
  unserved bigint
)
LANGUAGE sql STABLE AS $$
  WITH pts AS (
    SELECT round(s.lng / p_grid)::int AS ix,
           round(s.lat / p_grid)::int AS iy
    FROM search_demand_log s
    WHERE p_source = 'search'
      AND s.created_at >= now() - make_interval(hours => p_hours)
      AND (p_category IS NULL OR s.category_id = p_category)
    UNION ALL
    SELECT round(ST_X(b.job_site_location::geometry) / p_grid)::int,
           round(ST_Y(b.job_site_location::geometry) / p_grid)::int
    FROM bookings b
    WHERE p_source = 'bookings'
      AND b.job_site_location IS NOT NULL
      AND b.created_at >= now() - make_interval(hours => p_hours)
      AND (p_category IS NULL OR b.category_id = p_category)
  ),
  dem AS (
    SELECT ix, iy, count(*) AS demand FROM pts GROUP BY ix, iy
  ),
  sup AS (
    SELECT round(ST_X(wl.location::geometry) / p_grid)::int AS ix,
           round(ST_Y(wl.location::geometry) / p_grid)::int AS iy,
           count(*) AS supply
    FROM worker_locations wl
    JOIN workers w ON w.id = wl.worker_id
    WHERE w.deleted_at IS NULL
      AND w.verification_status::text = 'VERIFIED'
      AND fn_worker_presence(w.is_active, w.manually_paused, w.is_on_job, w.last_seen_at) = 'online'
      AND (p_category IS NULL OR EXISTS (
            SELECT 1 FROM worker_skills ws
            WHERE ws.worker_id = w.id AND ws.category_id = p_category))
    GROUP BY 1, 2
  )
  SELECT (d.iy * p_grid)::double precision,
         (d.ix * p_grid)::double precision,
         d.demand::bigint,
         COALESCE(sp.supply, 0)::bigint,
         GREATEST(d.demand - COALESCE(sp.supply, 0) * 2, 0)::bigint
  FROM dem d
  LEFT JOIN sup sp ON sp.ix = d.ix AND sp.iy = d.iy
  ORDER BY 5 DESC, 3 DESC
  LIMIT 2000;
$$;

-- Optional housekeeping (run from a cron / pg_cron later): keep the demand log small.
-- DELETE FROM public.search_demand_log WHERE created_at < now() - interval '30 days';