-- Etapa 14J: hardening dos helpers SECURITY DEFINER expostos no schema public.
-- Mantém a assinatura de has_role usada pelas policies existentes, mas limita a consulta ao próprio
-- usuário autenticado e remove EXECUTE herdado de PUBLIC/anon.
--
-- Esta migration é aditiva. Não edite as migrations históricas 0000/0001 para fazer esta correção.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    _user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- handle_new_user é executada pelo trigger de auth.users; usuários da aplicação não precisam
-- invocá-la diretamente via RPC.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;
