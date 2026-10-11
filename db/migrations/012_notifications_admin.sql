-- 012_notifications_admin.sql
-- Read-side indexes for the admin Notifications pages.
-- Tables are owned by notification-service; this is additive and idempotent.

DO $$
BEGIN
  IF to_regclass('public.broadcast_campaigns') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_created_at
      ON public.broadcast_campaigns (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_template_created
      ON public.broadcast_campaigns (template_key, created_at DESC);
  END IF;

  IF to_regclass('public.notification_deliveries') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_notification_deliveries_attempted_at
      ON public.notification_deliveries (attempted_at DESC);
  END IF;
END $$;