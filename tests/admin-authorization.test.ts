import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiAuth = readFileSync(new URL("../src/lib/api-auth.server.ts", import.meta.url), "utf8");
const readiness = readFileSync(new URL("../src/lib/readiness.server.ts", import.meta.url), "utf8");
const adminSubscriptions = readFileSync(
  new URL("../src/lib/admin-subscriptions.server.ts", import.meta.url),
  "utf8",
);
const coreMigration = readFileSync(
  new URL("../drizzle/migrations/0000_radarshop_core_schema.sql", import.meta.url),
  "utf8",
);
const foundationMigration = readFileSync(
  new URL("../drizzle/migrations/0001_foundation_security.sql", import.meta.url),
  "utf8",
);

test("API administrativa revalida autenticação e role no servidor", () => {
  assert.match(apiAuth, /export async function requireApiAdmin\(request: Request\)/);
  assert.match(apiAuth, /requireApiUserId\(request\)/);
  assert.match(apiAuth, /\.from\("user_roles"\)/);
  assert.match(apiAuth, /\.eq\("role", "admin"\)/);
  assert.match(apiAuth, /throw new ApiAdminError\(\)/);
});

test("endpoints sensíveis usam requireApiAdmin antes de operar", () => {
  assert.match(readiness, /await requireApiAdmin\(request\)/);
  assert.match(adminSubscriptions, /await requireApiAdmin\(request\)/);
});

test("catálogo e configurações administrativas dependem de policies de admin", () => {
  assert.match(coreMigration, /CREATE POLICY "categories admin write"[\s\S]*public\.has_role\(auth\.uid\(\),'admin'\)/);
  assert.match(coreMigration, /CREATE POLICY "products admin write"[\s\S]*public\.has_role\(auth\.uid\(\),'admin'\)/);
  assert.match(coreMigration, /CREATE POLICY "admin settings"[\s\S]*public\.has_role\(auth\.uid\(\),'admin'\)/);
});

test("authenticated não recebe escrita direta em user_roles", () => {
  assert.match(coreMigration, /GRANT SELECT ON public\.user_roles TO authenticated;/);
  assert.doesNotMatch(
    coreMigration,
    /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[^;]*ON public\.user_roles TO authenticated;/i,
  );
});

test("migration de segurança garante que novos usuários entram somente como user", () => {
  const start = foundationMigration.indexOf("CREATE OR REPLACE FUNCTION public.handle_new_user()");
  const end = foundationMigration.indexOf("-- User-owned rows", start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const handler = foundationMigration.slice(start, end);
  assert.match(handler, /VALUES \(NEW\.id, 'user'\)/);
  assert.doesNotMatch(handler, /'admin'/);
});
