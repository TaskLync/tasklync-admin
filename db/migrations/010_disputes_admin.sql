-- 010_disputes_admin.sql
-- Disputes pages: assignment + escalation columns, internal notes, list indexes,
-- and a get_needs_attention() that counts EVERY unresolved dispute.
--
-- NOTE: `disputes` is owned by booking-service. Everything here is additive
-- (IF NOT EXISTS), same as 006, 007 and 008. Tell the booking-service team
-- (see section 9 "Backend contract").

-- ---------------------------------------------------------
-- 1. Assignment + escalation (the status enum is NOT touched)
-- ---------------------------------------------------------
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS assigned_to     uuid NULL REFERENCES admin_users(id),
  ADD COLUMN IF NOT EXISTS assigned_at     timestamptz NULL,
  ADD COLUMN IF NOT EXISTS is_escalated    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at    timestamptz NULL,
  ADD COLUMN IF NOT EXISTS escalated_by    uuid NULL REFERENCES admin_users(id),
  ADD COLUMN IF NOT EXISTS escalation_note text NULL;

-- Index predicates use enum literals (not ::text) because enum->text is not IMMUTABLE.
CREATE INDEX IF NOT EXISTS idx_disputes_created_at
  ON public.disputes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_disputes_assigned_to
  ON public.disputes (assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_disputes_escalated
  ON public.disputes (created_at)
  WHERE is_escalated AND status NOT IN ('RESOLVED', 'CLOSED');

CREATE INDEX IF NOT EXISTS idx_disputes_resolved_at
  ON public.disputes (resolved_at DESC) WHERE resolved_at IS NOT NULL;

-- Refund tab joins refunds -> disputes on booking_id
CREATE INDEX IF NOT EXISTS idx_refunds_booking_initiated
  ON public.refunds (booking_id, initiated_at DESC);

-- ---------------------------------------------------------
-- 2. Internal dispute notes (never visible to customer or worker)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispute_admin_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  uuid NOT NULL,                       -- no FK (cross-service table)
  admin_id    uuid NULL REFERENCES admin_users(id),
  admin_email varchar(255) NOT NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_admin_notes_dispute
  ON public.dispute_admin_notes (dispute_id, created_at DESC);

-- ---------------------------------------------------------
-- 3. get_needs_attention() — dashboard "unresolved disputes older than 24h"
--    Copied from 002_dashboard_functions.sql. ONLY the staleDisputes block changed:
--    it used to count status = 'OPEN' only, so disputes the worker had already
--    answered (WORKER_RESPONDED) or that were UNDER_REVIEW disappeared from
--    the dashboard even though nobody had decided them.
--    If you edited this function after 002, re-apply just that one block.
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
    'flaggedReviews', '[]'::json
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;