import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../drizzle/migrations/0010_security_definer_hardening.sql", import.meta.url),
  "utf8",
);

test("has_role fica vinculado ao próprio auth.uid", () => {
  assert.match(migration, /_user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /FROM public\.user_roles/);
});

test("has_role remove execução herdada de PUBLIC e anon", () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.has_role\(uuid, public\.app_role\) FROM PUBLIC, anon;/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.has_role\(uuid, public\.app_role\) TO authenticated;/,
  );
});

test("trigger de criação de usuário não fica exposto como RPC de aplicação", () => {
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.handle_new_user\(\) FROM PUBLIC, anon, authenticated;/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.handle_new_user\(\) TO supabase_auth_admin, service_role;/,
  );
});

test("função usa search_path fechado e objetos qualificados", () => {
  assert.match(migration, /SET search_path = ''/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /public\.user_roles/);
});
