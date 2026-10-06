-- 005_pricing_config.sql (admin panel)
-- Singleton table for the global dynamic-pricing multipliers currently hardcoded as
-- booking-service env vars (see booking-service pricing.config.ts / §9 of its docs).
-- booking-service must be updated to read this table (env vars as fallback) — not done here.

CREATE TABLE IF NOT EXISTS platform_pricing_config (
  id                            BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE), -- enforces one row
  platform_fee_percent          NUMERIC(5,2)  NOT NULL DEFAULT 15.00,
  demand_threshold              INT           NOT NULL DEFAULT 3,
  demand_multiplier             NUMERIC(4,3)  NOT NULL DEFAULT 1.200,
  urgency_same_day_multiplier   NUMERIC(4,3)  NOT NULL DEFAULT 1.300,
  urgency_within_2h_multiplier  NUMERIC(4,3)  NOT NULL DEFAULT 1.500,
  off_peak_multiplier           NUMERIC(4,3)  NOT NULL DEFAULT 0.900,
  updated_by                    UUID          NULL,
  updated_at                    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

INSERT INTO platform_pricing_config (id) VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;