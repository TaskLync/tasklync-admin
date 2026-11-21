-- 019_commission_free_rollout.sql (admin panel)
-- Business decision: Tasklync is free for now. Switches OFF, in ONE new configuration version:
--   customer platform fee, worker commission, tax, customer cancellation fees and the no-show fee.
-- This is a configuration change, not code: every value stays editable in Settings > Pricing & Commission,
-- and turning a charge back on later needs no app release.
--
-- Safe and auditable:
--   * one atomic UPDATE + one history row (version, full config, reason), like a save from the dashboard;
--   * idempotent: does nothing if everything is already off, so re-running never bumps the version;
--   * only NEW bookings / quotes are affected. Existing bookings keep their stored pricing snapshot, and
--     quotes already sent keep the price the customer was shown (booking-service never reprices them).

WITH changed AS (
  UPDATE platform_pricing_config
     SET customer_fee_enabled = FALSE, customer_platform_fee_percent = 0,
         worker_commission_enabled = FALSE, worker_commission_percent = 0,
         platform_fee_percent = 0,
         tax_enabled = FALSE, tax_percent = 0,
         cancellation_fees_enabled = FALSE,
         cancel_fee_over_24h_percent = 0, cancel_fee_within_24h_percent = 0, cancel_fee_after_arrival_percent = 0,
         no_show_fee_enabled = FALSE, no_show_fee_pkr = 0,
         version = version + 1, effective_from = NOW(), updated_at = NOW()
   WHERE id = TRUE
     AND (customer_fee_enabled OR customer_platform_fee_percent <> 0
          OR worker_commission_enabled OR worker_commission_percent <> 0
          OR tax_enabled OR tax_percent <> 0
          OR cancellation_fees_enabled
          OR cancel_fee_over_24h_percent <> 0 OR cancel_fee_within_24h_percent <> 0 OR cancel_fee_after_arrival_percent <> 0
          OR no_show_fee_enabled OR no_show_fee_pkr <> 0)
  RETURNING *
)
INSERT INTO platform_pricing_config_history (version, config, changed_by, changed_by_email, reason)
SELECT c.version, to_jsonb(c), NULL, 'migration:019',
       'Commission-free launch: platform fee, worker commission, tax, cancellation and no-show fees switched off'
  FROM changed c
ON CONFLICT (version) DO NOTHING;
