-- RadarShop AI — private TikTok Shop opportunity tracking
-- Keeps each creator's tracked opportunities and metric history isolated server-side.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_tiktok_tracked_opportunities (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  title text NOT NULL,
  detail_link text,
  image_url text,
  shop_name text,
  sale_region text,
  currency text,
  minimum_price numeric,
  maximum_price numeric,
  commission_amount numeric,
  commission_currency text,
  commission_percent numeric,
  units_sold bigint,
  has_inventory boolean,
  previous_units_sold bigint,
  previous_commission_percent numeric,
  previous_minimum_price numeric,
  previous_checked_at timestamptz,
  tracked_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id),
  CONSTRAINT user_tiktok_tracked_product_id_present CHECK (length(btrim(product_id)) > 0),
  CONSTRAINT user_tiktok_tracked_title_present CHECK (length(btrim(title)) > 0),
  CONSTRAINT user_tiktok_tracked_values_nonnegative CHECK (
    (minimum_price IS NULL OR minimum_price >= 0)
    AND (maximum_price IS NULL OR maximum_price >= 0)
    AND (commission_amount IS NULL OR commission_amount >= 0)
    AND (units_sold IS NULL OR units_sold >= 0)
    AND (previous_minimum_price IS NULL OR previous_minimum_price >= 0)
    AND (previous_units_sold IS NULL OR previous_units_sold >= 0)
  ),
  CONSTRAINT user_tiktok_tracked_commission_percent_valid CHECK (
    commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100)
  ),
  CONSTRAINT user_tiktok_tracked_previous_commission_percent_valid CHECK (
    previous_commission_percent IS NULL
    OR (previous_commission_percent >= 0 AND previous_commission_percent <= 100)
  )
);

CREATE INDEX IF NOT EXISTS user_tiktok_tracked_opportunities_user_tracked_idx
  ON public.user_tiktok_tracked_opportunities (user_id, tracked_at DESC);

ALTER TABLE public.user_tiktok_tracked_opportunities ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_tiktok_tracked_opportunities FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.user_tiktok_tracked_opportunities
  TO service_role;

DROP TRIGGER IF EXISTS user_tiktok_tracked_opportunities_updated
  ON public.user_tiktok_tracked_opportunities;
CREATE TRIGGER user_tiktok_tracked_opportunities_updated
  BEFORE UPDATE ON public.user_tiktok_tracked_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.user_tiktok_opportunity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id text NOT NULL,
  currency text,
  minimum_price numeric,
  maximum_price numeric,
  commission_amount numeric,
  commission_currency text,
  commission_percent numeric,
  units_sold bigint,
  has_inventory boolean,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_tiktok_opportunity_history_tracked_fkey
    FOREIGN KEY (user_id, product_id)
    REFERENCES public.user_tiktok_tracked_opportunities (user_id, product_id)
    ON DELETE CASCADE,
  CONSTRAINT user_tiktok_opportunity_history_values_nonnegative CHECK (
    (minimum_price IS NULL OR minimum_price >= 0)
    AND (maximum_price IS NULL OR maximum_price >= 0)
    AND (commission_amount IS NULL OR commission_amount >= 0)
    AND (units_sold IS NULL OR units_sold >= 0)
  ),
  CONSTRAINT user_tiktok_opportunity_history_commission_percent_valid CHECK (
    commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100)
  )
);

CREATE INDEX IF NOT EXISTS user_tiktok_opportunity_history_user_product_recorded_idx
  ON public.user_tiktok_opportunity_history (user_id, product_id, recorded_at DESC);

ALTER TABLE public.user_tiktok_opportunity_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_tiktok_opportunity_history FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE
  ON TABLE public.user_tiktok_opportunity_history
  TO service_role;

COMMIT;
