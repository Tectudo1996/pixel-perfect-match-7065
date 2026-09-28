-- RadarShop AI — multi-gateway billing
-- Extends billing provider constraints without changing existing subscription data.

BEGIN;

ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT IF EXISTS user_subscriptions_billing_provider_valid;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_billing_provider_valid
  CHECK (
    billing_provider IS NULL
    OR billing_provider IN ('mercado_pago', 'paypal', 'pepper')
  );

ALTER TABLE public.billing_webhook_events
  DROP CONSTRAINT IF EXISTS billing_webhook_events_provider_valid;

ALTER TABLE public.billing_webhook_events
  ADD CONSTRAINT billing_webhook_events_provider_valid
  CHECK (provider IN ('mercado_pago', 'paypal', 'pepper'));

COMMIT;
