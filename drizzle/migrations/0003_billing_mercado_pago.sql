-- RadarShop AI — Mercado Pago billing foundation
-- Apply only after 0002_plan_usage.sql.

BEGIN;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider text,
  ADD COLUMN IF NOT EXISTS billing_external_id text,
  ADD COLUMN IF NOT EXISTS billing_status text,
  ADD COLUMN IF NOT EXISTS billing_payer_id text,
  ADD COLUMN IF NOT EXISTS billing_next_payment_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_subscriptions_billing_provider_valid'
  ) THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT user_subscriptions_billing_provider_valid
      CHECK (billing_provider IS NULL OR billing_provider IN ('mercado_pago'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_billing_external_id_unique
  ON public.user_subscriptions (billing_external_id)
  WHERE billing_external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  resource_id text,
  status text NOT NULL DEFAULT 'received',
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT billing_webhook_events_provider_valid CHECK (provider IN ('mercado_pago')),
  CONSTRAINT billing_webhook_events_status_valid CHECK (
    status IN ('received', 'processed', 'ignored', 'failed')
  ),
  CONSTRAINT billing_webhook_events_provider_event_unique UNIQUE (provider, provider_event_id)
);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.billing_webhook_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.billing_webhook_events TO service_role;

COMMIT;
