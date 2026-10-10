-- 008_bookings_admin.sql
-- Bookings pages: refund columns (idempotent), status history + trigger,
-- internal admin notes, list indexes and the KPI function.
--
-- NOTE: `bookings` is owned by booking-service. Everything here is additive
-- (IF NOT EXISTS), same as 006 and 007. Tell the booking-service team
-- (see section 12 "Backend contract").

-- ---------------------------------------------------------
-- 1. Refund tracking (booking-service v2.1.0 already has these; no-op then)
-- ---------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_amount     numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS refund_percentage numeric(5,2)  NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_updated_at ON public.bookings (updated_at DESC);

-- ---------------------------------------------------------
-- 2. Status history (powers the timeline on the detail page)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id            bigserial PRIMARY KEY,
  booking_id    uuid NOT NULL,                 -- no FK (cross-service table)
  from_status   varchar(30) NULL,
  to_status     varchar(30) NOT NULL,
  actor         varchar(255) NULL,             -- 'admin:<email>' or NULL = platform (user/worker/system)
  is_backfilled boolean NOT NULL DEFAULT false,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bsh_booking_changed
  ON public.booking_status_history (booking_id, changed_at, id);

CREATE OR REPLACE FUNCTION public.fn_log_booking_status_history() RETURNS trigger AS $$
DECLARE
  v_actor text;
BEGIN
  -- Admin transactions run: SELECT set_config('app.actor', 'admin:<email>', true)
  -- Everything else (booking-service) leaves it unset -> NULL.
  v_actor := NULLIF(current_setting('app.actor', true), '');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO booking_status_history (booking_id, from_status, to_status, actor, changed_at)
    VALUES (NEW.id, NULL, NEW.status::text, v_actor, NEW.created_at);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO booking_status_history (booking_id, from_status, to_status, actor, changed_at)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, v_actor, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_status_history ON public.bookings;
CREATE TRIGGER trg_booking_status_history
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.fn_log_booking_status_history();

-- Backfill: bookings that existed before this trigger get an approximate history
-- (created as PENDING, then one jump to the current status at updated_at).
INSERT INTO public.booking_status_history (booking_id, from_status, to_status, is_backfilled, changed_at)
SELECT b.id, NULL, 'PENDING', true, b.created_at
FROM public.bookings b
WHERE NOT EXISTS (SELECT 1 FROM public.booking_status_history h WHERE h.booking_id = b.id);

INSERT INTO public.booking_status_history (booking_id, from_status, to_status, is_backfilled, changed_at)
SELECT b.id, 'PENDING', b.status::text, true, b.updated_at
FROM public.bookings b
WHERE b.status::text <> 'PENDING'
  AND (SELECT count(*) FROM public.booking_status_history h WHERE h.booking_id = b.id) = 1;

-- ---------------------------------------------------------
-- 3. Internal admin notes (never visible to user or worker)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_admin_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL,
  admin_id    uuid NULL REFERENCES admin_users(id),
  admin_email varchar(255) NOT NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_admin_notes_booking
  ON public.booking_admin_notes (booking_id, created_at DESC);

-- ---------------------------------------------------------
-- 4. KPI cards for the list page. "Today" uses Asia/Karachi (same as workers).
-- ---------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_booking_kpis();
CREATE OR REPLACE FUNCTION public.get_booking_kpis()
RETURNS TABLE (
  bookings_today       bigint,
  bookings_yesterday   bigint,
  pending_now          bigint,
  in_progress_now      bigint,
  disputed_now         bigint,
  created_sparkline_7d bigint[]
) AS $$
  WITH b AS (
    SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi') AS today_start
  )
  SELECT
    (SELECT count(*) FROM bookings x WHERE x.created_at >= b.today_start),
    (SELECT count(*) FROM bookings x
       WHERE x.created_at >= b.today_start - interval '1 day'
         AND x.created_at <  b.today_start),
    (SELECT count(*) FROM bookings x WHERE x.status::text = 'PENDING'),
    (SELECT count(*) FROM bookings x WHERE x.status::text = 'IN_PROGRESS'),
    (SELECT count(*) FROM bookings x WHERE x.status::text = 'DISPUTED'),
    (SELECT array_agg(s.c ORDER BY s.d)
       FROM (
         SELECT g.d,
                (SELECT count(*) FROM bookings x
                   WHERE x.created_at >= b.today_start - (6 - g.d) * interval '1 day'
                     AND x.created_at <  b.today_start - (5 - g.d) * interval '1 day') AS c
         FROM generate_series(0, 6) AS g(d)
       ) s)
  FROM b;
$$ LANGUAGE sql STABLE;