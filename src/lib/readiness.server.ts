import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiAdminError, ApiAuthError, requireApiAdmin } from "@/lib/api-auth.server";

type CheckState = "ready" | "disabled" | "missing" | "error";

export type ReadinessCheck = {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
};

export type ReadinessReport = {
  checkedAt: string;
  coreReady: boolean;
  paidLaunchReady: boolean;
  checks: ReadinessCheck[];
};

export async function handleAdminReadinessGet(request: Request) {
  try {
    await requireApiAdmin(request);
    return Response.json(await buildReadinessReport());
  } catch (error) {
    if (error instanceof ApiAuthError || error instanceof ApiAdminError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    console.error("[RadarShop AI] readiness error", error);
    return Response.json(
      { error: "Não foi possível verificar a prontidão do ambiente.", code: "READINESS_ERROR" },
      { status: 500 },
    );
  }
}

async function buildReadinessReport(): Promise<ReadinessReport> {
  const checks: ReadinessCheck[] = [];

  const supabaseEnvReady =
    hasEnv("SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY");

  checks.push({
    id: "supabase-env",
    label: "Credenciais do Supabase no servidor",
    state: supabaseEnvReady ? "ready" : "missing",
    detail: supabaseEnvReady
      ? "URL e chave administrativa estão disponíveis somente no servidor."
      : "Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.",
  });

  let coreDatabaseReady = false;
  let planMigrationReady = false;
  let billingMigrationReady = false;

  if (supabaseEnvReady) {
    const [profiles, products, subscriptions, billingEvents] = await Promise.all([
      checkTable("profiles"),
      checkTable("products"),
      checkTable("user_subscriptions"),
      checkTable("billing_webhook_events"),
    ]);

    coreDatabaseReady = profiles && products;
    planMigrationReady = subscriptions;
    billingMigrationReady = billingEvents;

    checks.push({
      id: "core-database",
      label: "Banco base",
      state: coreDatabaseReady ? "ready" : "error",
      detail: coreDatabaseReady
        ? "Tabelas principais estão acessíveis pelo servidor."
        : "Profiles e/ou products não estão acessíveis.",
    });

    checks.push({
      id: "migration-0002",
      label: "Migration 0002 — planos e limites",
      state: planMigrationReady ? "ready" : "missing",
      detail: planMigrationReady
        ? "user_subscriptions está disponível."
        : "A tabela user_subscriptions não foi detectada.",
    });

    checks.push({
      id: "migration-0003",
      label: "Migration 0003 — billing",
      state: billingMigrationReady ? "ready" : "missing",
      detail: billingMigrationReady
        ? "billing_webhook_events está disponível."
        : "A tabela billing_webhook_events não foi detectada.",
    });
  } else {
    checks.push(
      {
        id: "core-database",
        label: "Banco base",
        state: "missing",
        detail: "Não é possível testar o banco sem as credenciais do servidor.",
      },
      {
        id: "migration-0002",
        label: "Migration 0002 — planos e limites",
        state: "missing",
        detail: "Não verificada porque o Supabase do servidor não está configurado.",
      },
      {
        id: "migration-0003",
        label: "Migration 0003 — billing",
        state: "missing",
        detail: "Não verificada porque o Supabase do servidor não está configurado.",
      },
    );
  }

  const aiReady = hasEnv("OPENAI_API_KEY");
  checks.push({
    id: "ai-provider",
    label: "Geração por IA",
    state: aiReady ? "ready" : "missing",
    detail: aiReady
      ? "A chave do provedor de IA está configurada no servidor."
      : "OPENAI_API_KEY ainda não está configurada.",
  });

  const ingestionReady = hasStrongSecret("PRODUCT_INGEST_SECRET");
  checks.push({
    id: "product-ingestion",
    label: "Ingestão server-to-server",
    state: ingestionReady ? "ready" : "missing",
    detail: ingestionReady
      ? "Segredo de ingestão está configurado."
      : "Defina PRODUCT_INGEST_SECRET com um valor longo antes de integrar fontes externas.",
  });

  const usageEnabled = envFlag("AI_USAGE_LIMITS_ENABLED");
  checks.push({
    id: "usage-limits",
    label: "Limites de uso",
    state: usageEnabled ? (planMigrationReady ? "ready" : "error") : "disabled",
    detail: usageEnabled
      ? planMigrationReady
        ? "Bloqueio server-side de cota está ativo."
        : "A feature flag está ativa, mas a migration 0002 não foi detectada."
      : "AI_USAGE_LIMITS_ENABLED está desativado.",
  });

  const billingEnabled = envFlag("MERCADO_PAGO_BILLING_ENABLED");
  const billingSecretsReady =
    hasEnv("MERCADO_PAGO_ACCESS_TOKEN") &&
    hasStrongSecret("MERCADO_PAGO_WEBHOOK_SECRET") &&
    hasPositiveMoney("MERCADO_PAGO_PRO_MONTHLY_BRL") &&
    hasValidPublicUrl("APP_PUBLIC_URL");

  checks.push({
    id: "billing-provider",
    label: "Mercado Pago",
    state: billingEnabled
      ? billingSecretsReady && billingMigrationReady && usageEnabled
        ? "ready"
        : "error"
      : "disabled",
    detail: billingEnabled
      ? billingSecretsReady && billingMigrationReady && usageEnabled
        ? "Billing recorrente está habilitado e com pré-requisitos detectados."
        : "Billing está ativo, mas faltam credenciais, preço, URL pública, migration 0003 ou limites."
      : "MERCADO_PAGO_BILLING_ENABLED está desativado.",
  });

  const coreReady = supabaseEnvReady && coreDatabaseReady;
  const paidLaunchReady =
    coreReady &&
    planMigrationReady &&
    billingMigrationReady &&
    aiReady &&
    usageEnabled &&
    billingEnabled &&
    billingSecretsReady;

  return {
    checkedAt: new Date().toISOString(),
    coreReady,
    paidLaunchReady,
    checks,
  };
}

async function checkTable(
  table: "profiles" | "products" | "user_subscriptions" | "billing_webhook_events",
) {
  if (table === "user_subscriptions") {
    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .select("user_id", { head: true })
      .limit(1);
    return !error;
  }

  const { error } = await supabaseAdmin.from(table).select("id", { head: true }).limit(1);
  return !error;
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function hasStrongSecret(name: string) {
  const value = process.env[name]?.trim() ?? "";
  return value.length >= 24 && !/^(replace|your-|example|changeme)/i.test(value);
}

function envFlag(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function hasPositiveMoney(name: string) {
  const raw = process.env[name]?.trim();
  if (!raw) return false;

  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0;
}

function hasValidPublicUrl(name: string) {
  const raw = process.env[name]?.trim();
  if (!raw) return false;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}
