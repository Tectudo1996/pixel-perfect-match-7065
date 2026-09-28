-- RadarShop AI — ingestion observability
-- Records operational history for external API and admin CSV imports.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  accepted_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  snapshot_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  collected_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ingestion_runs_source_present CHECK (length(btrim(source)) > 0),
  CONSTRAINT ingestion_runs_channel_valid CHECK (channel IN ('api', 'csv')),
  CONSTRAINT ingestion_runs_status_valid CHECK (status IN ('running', 'succeeded', 'failed')),
  CONSTRAINT ingestion_runs_counts_nonnegative CHECK (
    accepted_count >= 0
    AND inserted_count >= 0
    AND updated_count >= 0
    AND snapshot_count >= 0
  ),
  CONSTRAINT ingestion_runs_period_valid CHECK (
    finished_at IS NULL OR finished_at >= started_at
  )
);

CREATE INDEX IF NOT EXISTS ingestion_runs_source_started_idx
  ON public.ingestion_runs (source, started_at DESC);

CREATE INDEX IF NOT EXISTS ingestion_runs_started_idx
  ON public.ingestion_runs (started_at DESC);

ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ingestion_runs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ingestion_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ingestion_runs TO service_role;

DROP POLICY IF EXISTS "admins read ingestion runs" ON public.ingestion_runs;
CREATE POLICY "admins read ingestion runs"
  ON public.ingestion_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "admins create ingestion runs" ON public.ingestion_runs;
CREATE POLICY "admins create ingestion runs"
  ON public.ingestion_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "admins update ingestion runs" ON public.ingestion_runs;
CREATE POLICY "admins update ingestion runs"
  ON public.ingestion_runs
  FOR UPDATE
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

COMMIT;
