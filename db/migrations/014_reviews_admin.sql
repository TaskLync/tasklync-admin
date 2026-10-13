-- 014_reviews_admin.sql
-- Reviews pages: moderation audit columns, report resolution, internal notes,
-- list/audit indexes, and a get_needs_attention() that counts reviews with open reports.
--
-- NOTE: `reviews` and `review_reports` are owned by review-service. Everything here
-- is additive (IF NOT EXISTS), same as 006, 007, 008 and 010. Tell the review-service team.

DO $$
BEGIN
  IF to_regclass('public.reviews') IS NULL OR to_regclass('public.review_reports') IS NULL THEN
    RAISE EXCEPTION 'review-service tables not found. Run review-service migrations 001-004 first.';
  END IF;
END $$;

-- ---------------------------------------------------------
-- 1. Who moderated a review, when, and why
-- ---------------------------------------------------------
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS moderated_by    uuid NULL REFERENCES admin_users(id),
  ADD COLUMN IF NOT EXISTS moderated_at    timestamptz NULL,
  ADD COLUMN IF NOT EXISTS moderation_note text NULL;

-- ---------------------------------------------------------
-- 2. Report resolution (drives the Flagged queue)
--    NULL resolved_at = still needs an admin decision.
-- ---------------------------------------------------------
ALTER TABLE public.review_reports
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resolved_by uuid NULL REFERENCES admin_users(id);

CREATE INDEX IF NOT EXISTS idx_review_reports_open
  ON public.review_reports (review_id) WHERE resolved_at IS NULL;

-- ---------------------------------------------------------
-- 3. Internal review notes (never visible to customer or worker)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.review_admin_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid NOT NULL,                       -- no FK, review-service owns reviews
  admin_id    uuid NULL REFERENCES admin_users(id),
  admin_email varchar(255) NOT NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_admin_notes_review
  ON public.review_admin_notes (review_id, created_at DESC);

-- ---------------------------------------------------------
-- 4. List / signal / audit indexes (pg_trgm already enabled in 003)
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reviews_created_at
  ON public.reviews (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_one_star_by_user
  ON public.reviews (user_id, created_at) WHERE rating = 1;

CREATE INDEX IF NOT EXISTS idx_reviews_comment_trgm
  ON public.reviews USING gin (comment gin_trgm_ops);

-- Rating audit: disputes raised against a worker in the last 30 days
CREATE INDEX IF NOT EXISTS idx_disputes_raised_against
  ON public.disputes (raised_against, created_at DESC);

-- ---------------------------------------------------------
-- 5. get_needs_attention()
--    Copied from 010_disputes_admin.sql. ONLY the flaggedReviews block changed:
--    it used to be a hard-coded '[]'. It now lists reviews with unresolved reports.
--    If you edited this function after 010, re-apply just that one block.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION get_needs_attention()
RETURNS JSON AS $$
DECLARE
  v_flagged JSON := '[]'::json;
  v_result  JSON;
BEGIN
  -- Dynamic SQL so the function still compiles if review tables are ever missing.
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
      SELECT COALESCE(json_agg(json_build_object(
        'id', b.id, 'city', w.city, 'category', b.category_id,
        'ageMinutes', EXTRACT(EPOCH FROM (NOW() - b.created_at)) / 60
      )), '[]')
      FROM bookings b
      LEFT JOIN workers w ON w.id = b.worker_id
      WHERE b.status = 'PENDING' AND b.created_at < NOW() - INTERVAL '30 minutes'
    ),
    'flaggedReviews', v_flagged
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;