-- RadarShop AI — plan and AI usage foundation
-- Adds a server-controlled subscription record and an atomic AI generation reservation.
-- Billing provider identifiers and prices intentionally stay out of this migration.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  ai_generations_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_plan_valid CHECK (plan IN ('free', 'pro')),
  CONSTRAINT user_subscriptions_status_valid CHECK (
    status IN ('active', 'inactive', 'past_due', 'canceled')
  ),
  CONSTRAINT user_subscriptions_usage_nonnegative CHECK (ai_generations_used >= 0),
  CONSTRAINT user_subscriptions_period_valid CHECK (current_period_end > current_period_start)
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_subscriptions FROM anon, authenticated;
GRANT SELECT ON TABLE public.user_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_subscriptions TO service_role;

DROP POLICY IF EXISTS "users read own subscription" ON public.user_subscriptions;
CREATE POLICY "users read own subscription"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Existing accounts start on the free plan. Future accounts are also created lazily
-- by the server on first usage/read, so this migration does not need to modify the
-- existing auth trigger.
INSERT INTO public.user_subscriptions (user_id)
SELECT id
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_ai_generation(_user_id uuid, _limit integer)
RETURNS TABLE (
  allowed boolean,
  used integer,
  period_start timestamptz,
  period_end timestamptz,
  plan text,
  status text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  subscription public.user_subscriptions%ROWTYPE;
BEGIN
  IF _limit < 1 THEN
    RAISE EXCEPTION 'AI generation limit must be positive';
  END IF;

  INSERT INTO public.user_subscriptions (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- This UPDATE intentionally locks the user's row for the remainder of the
  -- transaction. Concurrent generations therefore cannot both pass the same limit.
  UPDATE public.user_subscriptions
  SET
    ai_generations_used = CASE
      WHEN now() >= current_period_end THEN 0
      ELSE ai_generations_used
    END,
    current_period_start = CASE
      WHEN now() >= current_period_end THEN date_trunc('month', now())
      ELSE current_period_start
    END,
    current_period_end = CASE
      WHEN now() >= current_period_end THEN date_trunc('month', now()) + interval '1 month'
      ELSE current_period_end
    END,
    updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO subscription;

  IF subscription.status <> 'active' THEN
    RETURN QUERY
    SELECT
      false,
      subscription.ai_generations_used,
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.plan,
      subscription.status;
    RETURN;
  END IF;

  IF subscription.ai_generations_used >= _limit THEN
    RETURN QUERY
    SELECT
      false,
      subscription.ai_generations_used,
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.plan,
      subscription.status;
    RETURN;
  END IF;

  UPDATE public.user_subscriptions
  SET
    ai_generations_used = ai_generations_used + 1,
    updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO subscription;

  RETURN QUERY
  SELECT
    true,
    subscription.ai_generations_used,
    subscription.current_period_start,
    subscription.current_period_end,
    subscription.plan,
    subscription.status;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_generation(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_ai_generation(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  remaining_used integer;
BEGIN
  UPDATE public.user_subscriptions
  SET
    ai_generations_used = GREATEST(ai_generations_used - 1, 0),
    updated_at = now()
  WHERE user_id = _user_id
  RETURNING ai_generations_used INTO remaining_used;

  RETURN COALESCE(remaining_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.refund_ai_generation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_generation(uuid) TO service_role;

COMMIT;
