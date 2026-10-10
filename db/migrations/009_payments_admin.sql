-- 009_payments_admin.sql
-- Finance pages: read indexes only. payments / worker_payouts / refunds /
-- worker_wallets / dead_letters are owned by payment-service (its migrations
-- 001-006 must already be applied on the shared DB).

CREATE INDEX IF NOT EXISTS idx_payments_created_at
  ON public.payments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_payouts_initiated_at
  ON public.worker_payouts (initiated_at DESC);

CREATE INDEX IF NOT EXISTS idx_refunds_initiated_at
  ON public.refunds (initiated_at DESC);

-- Finance dates revenue by completion time.
CREATE INDEX IF NOT EXISTS idx_bookings_completed_at
  ON public.bookings (completed_at);

CREATE INDEX IF NOT EXISTS idx_dead_letters_topic_created
  ON public.dead_letters (topic, created_at DESC);