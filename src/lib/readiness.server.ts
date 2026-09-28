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
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
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

  const supabaseEnvReady = hasEnv("SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY");

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
  let readinessMigrationReady = false;
  let multiGatewayMigrationReady = false;

  if (supabaseEnvReady) {
    const [profiles, products, subscriptions, billingEvents, multiGatewaySchema] =
      await Promise.all([
        checkTable("profiles"),
        checkTable("products"),
        checkTable("user_subscriptions"),
        checkTable("billing_webhook_events"),
        checkMultiGatewayBillingSchema(),
      ]);

    coreDatabaseReady = profiles && products;
    planMigrationReady = subscriptions;
    billingMigrationReady = billingEvents;
    readinessMigrationReady = multiGatewaySchema.diagnosticsReady;
    multiGatewayMigrationReady = multiGatewaySchema.multiGatewayReady;

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

    checks.push({
      id: "migration-0005",
      label: "Migration 0005 — diagnóstico do schema",
      state: readinessMigrationReady ? "ready" : "missing",
      detail: readinessMigrationReady
        ? "A verificação server-side do schema multi-gateway está disponível."
        : "A função de diagnóstico da migration 0005 não foi detectada.",
    });

    checks.push({
      id: "migration-0004",
      label: "Migration 0004 — multi-gateway",
      state: readinessMigrationReady ? (multiGatewayMigrationReady ? "ready" : "error") : "missing",
      detail: readinessMigrationReady
        ? multiGatewayMigrationReady
          ? "Os constraints aceitam Mercado Pago, PayPal e Pepper."
          : "Os constraints de billing ainda não aceitam corretamente os três gateways."
        : "A migration 0004 não pôde ser verificada sem o diagnóstico da migration 0005.",
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
      {
        id: "migration-0005",
        label: "Migration 0005 — diagnóstico do schema",
        state: "missing",
        detail: "Não verificada porque o Supabase do servidor não está configurado.",
      },
      {
        id: "migration-0004",
        label: "Migration 0004 — multi-gateway",
        state: "missing",
        detail: "Não verificada porque o Supabase do servidor não está configurado.",
      },
    );
  }

  const lovableAiReady = hasEnv("LOVABLE_API_KEY");
  const openAiReady = hasEnv("OPENAI_API_KEY") && hasEnv("OPENAI_MODEL");
  const aiReady = lovableAiReady || openAiReady;
  checks.push({
    id: "ai-provider",
    label: "Geração por IA",
    state: aiReady ? "ready" : "missing",
    detail: lovableAiReady
      ? "Lovable AI Gateway está disponível com a chave gerenciada pelo projeto."
      : openAiReady
        ? "OpenAI externo está configurado como fallback."
        : "Nenhum provedor de IA server-side está configurado.",
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

  const mercadoPagoEnabled = envFlag("MERCADO_PAGO_BILLING_ENABLED");
  const mercadoPagoAccessReady = hasEnv("MERCADO_PAGO_ACCESS_TOKEN");
  const mercadoPagoWebhookReady = hasStrongSecret("MERCADO_PAGO_WEBHOOK_SECRET");
  const mercadoPagoCheckoutReady =
    mercadoPagoAccessReady &&
    hasPositiveMoney("MERCADO_PAGO_PRO_MONTHLY_BRL") &&
    hasValidPublicUrl("APP_PUBLIC_URL");

  checks.push({
    id: "mercado-pago-webhook",
    label: "Reconciliação do Mercado Pago",
    state:
      mercadoPagoAccessReady && mercadoPagoWebhookReady && billingMigrationReady
        ? "ready"
        : "missing",
    detail:
      mercadoPagoAccessReady && mercadoPagoWebhookReady && billingMigrationReady
        ? "Webhooks do Mercado Pago podem ser validados e reconciliados."
        : "Faltam Access Token, segredo de Webhook ou migration 0003.",
  });

  checks.push({
    id: "mercado-pago-checkout",
    label: "Checkout Mercado Pago",
    state: mercadoPagoEnabled
      ? mercadoPagoCheckoutReady && billingMigrationReady && usageEnabled
        ? "ready"
        : "error"
      : "disabled",
    detail: mercadoPagoEnabled
      ? mercadoPagoCheckoutReady && billingMigrationReady && usageEnabled
        ? "Novas assinaturas via Mercado Pago estão habilitadas."
        : "Mercado Pago está ativo, mas faltam preço, URL pública, credencial, migration 0003 ou limites."
      : "Novas assinaturas via Mercado Pago estão desativadas.",
  });

  const paypalEnabled = envFlag("PAYPAL_BILLING_ENABLED");
  const paypalCredentialsReady =
    hasEnv("PAYPAL_CLIENT_ID") && hasStrongSecret("PAYPAL_CLIENT_SECRET");
  const paypalWebhookReady = paypalCredentialsReady && hasEnv("PAYPAL_WEBHOOK_ID");
  const paypalCheckoutReady =
    paypalCredentialsReady &&
    hasEnv("PAYPAL_PLAN_ID") &&
    hasPositiveMoney("PAYPAL_PRO_MONTHLY_BRL") &&
    hasValidPublicUrl("APP_PUBLIC_URL");

  checks.push({
    id: "paypal-webhook",
    label: "Reconciliação do PayPal",
    state:
      paypalWebhookReady && billingMigrationReady && multiGatewayMigrationReady
        ? "ready"
        : "missing",
    detail:
      paypalWebhookReady && billingMigrationReady && multiGatewayMigrationReady
        ? "Webhook, credenciais e schema multi-gateway do PayPal estão preparados."
        : "Faltam Client ID, Client Secret, Webhook ID, migration 0003 ou migration 0004.",
  });

  checks.push({
    id: "paypal-checkout",
    label: "Checkout PayPal",
    state: paypalEnabled
      ? paypalCheckoutReady && billingMigrationReady && multiGatewayMigrationReady && usageEnabled
        ? "ready"
        : "error"
      : "disabled",
    detail: paypalEnabled
      ? paypalCheckoutReady && billingMigrationReady && multiGatewayMigrationReady && usageEnabled
        ? "Novas assinaturas via PayPal estão habilitadas."
        : "PayPal está ativo, mas faltam plano, preço, URL pública, credenciais, migrations 0003/0004 ou limites."
      : "Novas assinaturas via PayPal estão desativadas.",
  });

  const pepperEnabled = envFlag("PEPPER_BILLING_ENABLED");
  const pepperCheckoutReady =
    hasValidPublicUrl("PEPPER_CHECKOUT_URL") && hasPositiveMoney("PEPPER_PRO_MONTHLY_BRL");

  checks.push({
    id: "pepper-checkout",
    label: "Checkout Pepper",
    state: pepperEnabled
      ? pepperCheckoutReady && multiGatewayMigrationReady
        ? "ready"
        : "error"
      : "disabled",
    detail: pepperEnabled
      ? pepperCheckoutReady && multiGatewayMigrationReady
        ? "Checkout Pepper está disponível em modo assistido; a ativação automática ainda depende da API/Webhook da conta."
        : "Pepper está ativo, mas faltam URL de checkout, preço ou migration 0004."
      : "Checkout Pepper está desativado.",
  });

  const coreReady = supabaseEnvReady && coreDatabaseReady;
  const automaticBillingReady =
    (mercadoPagoEnabled && mercadoPagoCheckoutReady && mercadoPagoWebhookReady) ||
    (paypalEnabled && paypalCheckoutReady && paypalWebhookReady);
  const paidLaunchReady =
    coreReady &&
    planMigrationReady &&
    billingMigrationReady &&
    readinessMigrationReady &&
    multiGatewayMigrationReady &&
    aiReady &&
    usageEnabled &&
    automaticBillingReady;

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

async function checkMultiGatewayBillingSchema() {
  const { data, error } = await supabaseAdmin.rpc("check_multi_gateway_billing_schema");

  if (error) {
    return {
      diagnosticsReady: false,
      multiGatewayReady: false,
    };
  }

  const row = data?.[0];

  return {
    diagnosticsReady: true,
    multiGatewayReady: Boolean(
      row?.subscription_constraint_ready && row?.webhook_constraint_ready,
    ),
  };
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
