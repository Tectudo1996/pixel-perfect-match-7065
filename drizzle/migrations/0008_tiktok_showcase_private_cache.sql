-- RadarShop AI — private TikTok Shop Creator Showcase cache
-- Keeps each creator's authorized Showcase data isolated by user.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_tiktok_showcase_products (
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
  synced_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id),
  CONSTRAINT user_tiktok_showcase_product_id_present CHECK (length(btrim(product_id)) > 0),
  CONSTRAINT user_tiktok_showcase_title_present CHECK (length(btrim(title)) > 0),
  CONSTRAINT user_tiktok_showcase_prices_nonnegative CHECK (
    (minimum_price IS NULL OR minimum_price >= 0)
    AND (maximum_price IS NULL OR maximum_price >= 0)
    AND (commission_amount IS NULL OR commission_amount >= 0)
  ),
  CONSTRAINT user_tiktok_showcase_commission_percent_valid CHECK (
    commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100)
  ),
  CONSTRAINT user_tiktok_showcase_units_sold_nonnegative CHECK (
    units_sold IS NULL OR units_sold >= 0
  )
);

CREATE INDEX IF NOT EXISTS user_tiktok_showcase_products_user_synced_idx
  ON public.user_tiktok_showcase_products (user_id, synced_at DESC);

ALTER TABLE public.user_tiktok_showcase_products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_tiktok_showcase_products FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_tiktok_showcase_products TO service_role;

DROP TRIGGER IF EXISTS user_tiktok_showcase_products_updated
  ON public.user_tiktok_showcase_products;
CREATE TRIGGER user_tiktok_showcase_products_updated
  BEFORE UPDATE ON public.user_tiktok_showcase_products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
