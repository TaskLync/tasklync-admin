-- 018_customer_charges_config.sql (admin panel)
-- Customer cancellation and no-show charges become admin-controlled settings on the same versioned, audited
-- platform_pricing_config row (Settings > Pricing & Commission), read by booking-service.
-- Additive and idempotent. The defaults are exactly what booking-service enforced in code until now
-- (10% / 50% / 100% kept, Rs 500 no-show fee), so this migration on its own changes no customer charge.
-- Existing bookings are never touched: a cancelled booking keeps the refund it was given.

ALTER TABLE platform_pricing_config
  ADD COLUMN IF NOT EXISTS cancellation_fees_enabled        BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cancel_fee_over_24h_percent      NUMERIC(5,2)  NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS cancel_fee_within_24h_percent    NUMERIC(5,2)  NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cancel_fee_after_arrival_percent NUMERIC(5,2)  NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS no_show_fee_enabled              BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS no_show_fee_pkr                  NUMERIC(10,2) NOT NULL DEFAULT 500;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pricing_config_customer_charges') THEN
    ALTER TABLE platform_pricing_config ADD CONSTRAINT chk_pricing_config_customer_charges CHECK (
      cancel_fee_over_24h_percent      BETWEEN 0 AND 100
      AND cancel_fee_within_24h_percent    BETWEEN 0 AND 100
      AND cancel_fee_after_arrival_percent BETWEEN 0 AND 100
      AND no_show_fee_pkr                  BETWEEN 0 AND 100000
    );
  END IF;
END $$;
