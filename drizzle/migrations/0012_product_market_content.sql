-- RadarShop AI — Etapa 15B: conteúdo de mercado relacionado ao produto.
-- Cache server-only para vídeos e criadores FastMoss. Aplicar após 0011.

BEGIN;

CREATE TABLE IF NOT EXISTS public.product_related_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  external_video_id text NOT NULL,
  creator_uid text,
  seller_id text,
  is_ad boolean,
  comment_count bigint,
  digg_count bigint,
  play_count bigint,
  share_count bigint,
  units_sold bigint,
  gmv numeric(18,2),
  region text,
  description text,
  cover_url text,
  duration_seconds integer,
  fastmoss_url text,
  tiktok_url text,
  published_at timestamptz,
  source text NOT NULL DEFAULT 'fastmoss',
  fetched_at timestamptz NOT NULL,
  CONSTRAINT product_related_videos_product_external_unique
    UNIQUE (product_id, external_video_id)
);

CREATE INDEX IF NOT EXISTS product_related_videos_product_units_idx
  ON public.product_related_videos (product_id, units_sold DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS product_related_videos_product_gmv_idx
  ON public.product_related_videos (product_id, gmv DESC NULLS LAST);

ALTER TABLE public.product_related_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_related_videos FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_related_videos TO service_role;

CREATE TABLE IF NOT EXISTS public.product_related_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  creator_uid text NOT NULL,
  unique_id text,
  nickname text,
  avatar_url text,
  units_sold bigint,
  gmv numeric(18,2),
  category_id bigint,
  category_name text,
  follower_count bigint,
  aweme_count bigint,
  favoriting_count bigint,
  region text,
  source text NOT NULL DEFAULT 'fastmoss',
  fetched_at timestamptz NOT NULL,
  CONSTRAINT product_related_creators_product_creator_unique
    UNIQUE (product_id, creator_uid)
);

CREATE INDEX IF NOT EXISTS product_related_creators_product_units_idx
  ON public.product_related_creators (product_id, units_sold DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS product_related_creators_product_gmv_idx
  ON public.product_related_creators (product_id, gmv DESC NULLS LAST);

ALTER TABLE public.product_related_creators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_related_creators FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_related_creators TO service_role;

CREATE TABLE IF NOT EXISTS public.product_market_enrichment_state (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  videos_fetched_at timestamptz,
  creators_fetched_at timestamptz,
  next_refresh_at timestamptz,
  video_total integer,
  creator_total integer,
  last_error_code text,
  last_error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_market_enrichment_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_market_enrichment_state FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_market_enrichment_state TO service_role;

DROP TRIGGER IF EXISTS product_market_enrichment_state_updated
  ON public.product_market_enrichment_state;
CREATE TRIGGER product_market_enrichment_state_updated
  BEFORE UPDATE ON public.product_market_enrichment_state
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
