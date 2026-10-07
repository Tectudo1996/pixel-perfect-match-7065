-- Etapa 15A — motor de dados FastMoss BR (aditiva, idempotente, preserva RLS existente)
BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS sales_7d bigint,
  ADD COLUMN IF NOT EXISTS gmv_7d numeric(18,2),
  ADD COLUMN IF NOT EXISTS gmv_total numeric(18,2),
  ADD COLUMN IF NOT EXISTS video_count integer,
  ADD COLUMN IF NOT EXISTS data_provenance text;

ALTER TABLE public.product_metrics_history
  ADD COLUMN IF NOT EXISTS commission_percent numeric(6,2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS sales_7d bigint,
  ADD COLUMN IF NOT EXISTS gmv_7d numeric(18,2),
  ADD COLUMN IF NOT EXISTS gmv_total numeric(18,2),
  ADD COLUMN IF NOT EXISTS video_count integer;

CREATE INDEX IF NOT EXISTS products_source_external_id_idx
  ON public.products (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_region_gmv_7d_idx
  ON public.products (region, gmv_7d DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS product_metrics_history_product_recorded_market_idx
  ON public.product_metrics_history (product_id, recorded_at DESC);

COMMIT;
