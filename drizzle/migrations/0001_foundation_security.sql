-- RadarShop AI — foundation hardening
-- Keeps commercial data behind authentication, removes automatic admin promotion,
-- and adds integrity constraints for user-owned and monetary data.

BEGIN;

-- Commercial intelligence must not be readable anonymously.
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.product_metrics_history FROM anon;

DROP POLICY IF EXISTS "products public read" ON public.products;
CREATE POLICY "products authenticated read"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "metrics public read" ON public.product_metrics_history;
CREATE POLICY "metrics authenticated read"
  ON public.product_metrics_history
  FOR SELECT
  TO authenticated
  USING (true);

-- New users are always regular users. Admins must be granted explicitly.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- User-owned rows should follow the lifecycle of the auth account.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_auth_user_fk') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_auth_user_fk
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_auth_user_fk') THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_auth_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_auth_user_fk') THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_auth_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_auth_user_fk') THEN
    ALTER TABLE public.favorites
      ADD CONSTRAINT favorites_auth_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_projects_auth_user_fk') THEN
    ALTER TABLE public.content_projects
      ADD CONSTRAINT content_projects_auth_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_created_by_auth_user_fk') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_created_by_auth_user_fk
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
      NOT VALID;
  END IF;
END
$$;

-- Protect future writes from obviously invalid monetary and counter values.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_price_nonnegative') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_price_nonnegative
      CHECK (price IS NULL OR price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_commission_amount_nonnegative') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_commission_amount_nonnegative
      CHECK (commission_amount IS NULL OR commission_amount >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_commission_percent_range') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_commission_percent_range
      CHECK (commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100))
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_sales_count_nonnegative') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sales_count_nonnegative
      CHECK (sales_count IS NULL OR sales_count >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_creators_count_nonnegative') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_creators_count_nonnegative
      CHECK (creators_count IS NULL OR creators_count >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metrics_price_nonnegative') THEN
    ALTER TABLE public.product_metrics_history
      ADD CONSTRAINT metrics_price_nonnegative
      CHECK (price IS NULL OR price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metrics_commission_amount_nonnegative') THEN
    ALTER TABLE public.product_metrics_history
      ADD CONSTRAINT metrics_commission_amount_nonnegative
      CHECK (commission_amount IS NULL OR commission_amount >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metrics_sales_count_nonnegative') THEN
    ALTER TABLE public.product_metrics_history
      ADD CONSTRAINT metrics_sales_count_nonnegative
      CHECK (sales_count IS NULL OR sales_count >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metrics_creators_count_nonnegative') THEN
    ALTER TABLE public.product_metrics_history
      ADD CONSTRAINT metrics_creators_count_nonnegative
      CHECK (creators_count IS NULL OR creators_count >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preferences_commission_range_valid') THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT preferences_commission_range_valid
      CHECK (
        (commission_min IS NULL OR commission_min >= 0)
        AND (commission_max IS NULL OR commission_max >= 0)
        AND (commission_min IS NULL OR commission_max IS NULL OR commission_min <= commission_max)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_duration_positive') THEN
    ALTER TABLE public.content_projects
      ADD CONSTRAINT content_duration_positive
      CHECK (duration_seconds IS NULL OR duration_seconds > 0) NOT VALID;
  END IF;
END
$$;

COMMIT;
