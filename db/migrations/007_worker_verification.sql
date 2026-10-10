-- 007_worker_verification.sql
-- Worker verification review flow.
--
-- NOTE: `workers` is owned by worker-service. Everything is additive
-- (ADD COLUMN IF NOT EXISTS), same as 006. Tell the worker-service team
-- (see section 12 "Backend contract").

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS cnic_number                       varchar(13) NULL,
  ADD COLUMN IF NOT EXISTS date_of_birth                     date NULL,
  ADD COLUMN IF NOT EXISTS registration_ip                   varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS verification_rejection_code       varchar(40) NULL,
  ADD COLUMN IF NOT EXISTS verification_rejection_note       text NULL,
  ADD COLUMN IF NOT EXISTS verification_resubmission_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified_at                       timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verified_by                       uuid NULL REFERENCES admin_users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workers_cnic_format_chk'
  ) THEN
    ALTER TABLE public.workers
      ADD CONSTRAINT workers_cnic_format_chk
      CHECK (cnic_number IS NULL OR cnic_number ~ '^[0-9]{13}$');
  END IF;
END $$;

-- CNIC duplicate lookup
CREATE INDEX IF NOT EXISTS idx_workers_cnic
  ON public.workers (cnic_number) WHERE cnic_number IS NOT NULL;

-- Queue query joins pending docs per worker
CREATE INDEX IF NOT EXISTS idx_worker_documents_worker_status
  ON public.worker_documents (worker_id, status);

-- History of every verification decision (attempts timeline + 30-day tabs)
CREATE TABLE IF NOT EXISTS public.worker_verification_reviews (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id          uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  decision           varchar(20) NOT NULL
                     CHECK (decision IN ('approved', 'rejected', 'info_requested')),
  reason_code        varchar(40) NULL,
  note               text NULL,
  allow_resubmission boolean NULL,
  admin_id           uuid NULL REFERENCES admin_users(id),
  admin_email        varchar(255) NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wvr_worker_created
  ON public.worker_verification_reviews (worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wvr_decision_created
  ON public.worker_verification_reviews (decision, created_at DESC);

-- Transactional outbox: decisions write their Kafka event here in the SAME
-- transaction. A relay (scripts/publish-outbox.ts) publishes to Kafka.
CREATE TABLE IF NOT EXISTS public.admin_event_outbox (
  id           bigserial PRIMARY KEY,
  topic        varchar(100) NOT NULL,
  event_type   varchar(100) NOT NULL,
  event_key    varchar(100) NOT NULL,
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  attempts     integer NOT NULL DEFAULT 0,
  last_error   text NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
  ON public.admin_event_outbox (id) WHERE published_at IS NULL;