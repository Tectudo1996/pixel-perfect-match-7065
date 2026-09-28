-- RadarShop AI — TikTok Shop OAuth state and encrypted token storage
-- Server-only tables. Apply after the core schema and before enabling TikTok Shop Affiliate.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tiktok_shop_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_shop_oauth_states_hash_valid CHECK (length(state_hash) = 64),
  CONSTRAINT tiktok_shop_oauth_states_expiry_valid CHECK (expires_at > created_at),
  CONSTRAINT tiktok_shop_oauth_states_consumed_valid CHECK (
    consumed_at IS NULL OR consumed_at >= created_at
  )
);

CREATE INDEX IF NOT EXISTS tiktok_shop_oauth_states_expiry_idx
  ON public.tiktok_shop_oauth_states (expires_at);

ALTER TABLE public.tiktok_shop_oauth_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tiktok_shop_oauth_states FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tiktok_shop_oauth_states TO service_role;

CREATE TABLE IF NOT EXISTS public.tiktok_shop_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  open_id text NOT NULL UNIQUE,
  user_type integer NOT NULL DEFAULT 1,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  token_ciphertext text NOT NULL,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_shop_connections_creator_only CHECK (user_type = 1),
  CONSTRAINT tiktok_shop_connections_open_id_present CHECK (length(btrim(open_id)) > 0),
  CONSTRAINT tiktok_shop_connections_ciphertext_present CHECK (length(token_ciphertext) > 0)
);

ALTER TABLE public.tiktok_shop_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tiktok_shop_connections FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tiktok_shop_connections TO service_role;

DROP TRIGGER IF EXISTS tiktok_shop_connections_updated ON public.tiktok_shop_connections;
CREATE TRIGGER tiktok_shop_connections_updated
  BEFORE UPDATE ON public.tiktok_shop_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
