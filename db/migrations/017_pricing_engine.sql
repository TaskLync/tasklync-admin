-- 017_pricing_engine.sql (admin panel)
-- Centralised fee / commission / tax configuration, read by booking-service (single source of truth).
-- Additive and idempotent. It does NOT change any current percentage: switching the platform to zero
-- commission is an audited admin action in Settings > Pricing & Commission, not a migration side effect.

ALTER TABLE platform_pricing_config
  ADD COLUMN IF NOT EXISTS customer_fee_enabled      BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS worker_commission_enabled BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tax_enabled               BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_percent               NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_label                 VARCHAR(40)   NOT NULL DEFAULT 'Tax',
  ADD COLUMN IF NOT EXISTS tax_applies_to            VARCHAR(20)   NOT NULL DEFAULT 'subtotal',
  ADD COLUMN IF NOT EXISTS version                   INT           NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_from            TIMESTAMPTZ   NOT NULL DEFAULT NOW();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pricing_config_ranges') THEN
    ALTER TABLE platform_pricing_config ADD CONSTRAINT chk_pricing_config_ranges CHECK (
      customer_platform_fee_percent BETWEEN 0 AND 30
      AND worker_commission_percent BETWEEN 0 AND 30
      AND tax_percent BETWEEN 0 AND 50
      AND tax_applies_to IN ('subtotal', 'subtotal_and_fee')
      AND length(trim(tax_label)) BETWEEN 1 AND 40
      AND version >= 1
    );
  END IF;
END $$;

-- Every saved configuration, append-only (who, when, what). The live row is platform_pricing_config.
CREATE TABLE IF NOT EXISTS platform_pricing_config_history (
  id           BIGSERIAL    PRIMARY KEY,
  version      INT          NOT NULL,
  config       JSONB        NOT NULL,
  changed_by   UUID         NULL,
  changed_by_email VARCHAR(255) NULL,
  reason       TEXT         NULL,
  changed_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_config_history_version ON platform_pricing_config_history (version);

-- Seed history with the configuration that is live right now (version 1), once.
INSERT INTO platform_pricing_config_history (version, config, changed_by, reason)
SELECT p.version, to_jsonb(p), p.updated_by, 'Baseline captured by migration 017'
  FROM platform_pricing_config p
 WHERE p.id = TRUE
ON CONFLICT (version) DO NOTHING;

ALTER TABLE platform_pricing_config_history ENABLE ROW LEVEL SECURITY;
