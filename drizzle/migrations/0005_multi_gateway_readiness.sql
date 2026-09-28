-- RadarShop AI — multi-gateway readiness diagnostics
-- Adds a service-role-only, read-only RPC used by Admin > Prontidão.
-- Apply after 0004_multi_gateway_billing.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.check_multi_gateway_billing_schema()
RETURNS TABLE (
  subscription_constraint_ready boolean,
  webhook_constraint_ready boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'user_subscriptions'
        AND c.conname = 'user_subscriptions_billing_provider_valid'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%mercado_pago%'
        AND pg_get_constraintdef(c.oid) ILIKE '%paypal%'
        AND pg_get_constraintdef(c.oid) ILIKE '%pepper%'
    ),
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'billing_webhook_events'
        AND c.conname = 'billing_webhook_events_provider_valid'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%mercado_pago%'
        AND pg_get_constraintdef(c.oid) ILIKE '%paypal%'
        AND pg_get_constraintdef(c.oid) ILIKE '%pepper%'
    );
$$;

REVOKE ALL ON FUNCTION public.check_multi_gateway_billing_schema() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_multi_gateway_billing_schema() TO service_role;

COMMIT;
