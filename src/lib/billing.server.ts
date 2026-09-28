import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiAuthError, requireApiUser } from "@/lib/api-auth.server";
import { readJsonBody, RequestBodyError } from "@/lib/request-body.server";
import { isUsageLimitsEnabled } from "@/lib/usage.server";

const MERCADO_PAGO_API = "https://api.mercadopago.com";

type MercadoPagoSubscription = {
  id: string;
  external_reference?: string | number | null;
  init_point?: string | null;
  payer_id?: string | number | null;
  status?: string | null;
  next_payment_date?: string | null;
};

type MercadoPagoInvoice = {
  id: string | number;
  preapproval_id?: string | null;
  payment?: {
    status?: string | null;
  } | null;
};

type WebhookPayload = {
  id?: string | number;
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

export class BillingError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function getBillingSummary(request: Request) {
  const user = await requireApiUser(request);
  const config = getBillingConfig();

  if (!isUsageLimitsEnabled()) {
    return {
      configured: false,
      managementAvailable: false,
      provider: "mercado_pago" as const,
      currency: "BRL" as const,
      monthlyPrice: config.monthlyPrice,
      billingStatus: null,
      externalSubscriptionId: null,
      nextPaymentAt: null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("billing_provider,billing_external_id,billing_status,billing_next_payment_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    configured: config.checkoutEnabled,
    managementAvailable: config.managementReady,
    provider: "mercado_pago" as const,
    currency: "BRL" as const,
    monthlyPrice: config.monthlyPrice,
    billingStatus: data?.billing_status ?? null,
    externalSubscriptionId: data?.billing_external_id ?? null,
    nextPaymentAt: data?.billing_next_payment_at ?? null,
  };
}

export async function createMercadoPagoCheckout(request: Request) {
  const user = await requireApiUser(request);
  const config = requireCheckoutConfig();

  if (!user.email) {
    throw new BillingError(
      400,
      "BILLING_EMAIL_REQUIRED",
      "Sua conta precisa ter um e-mail válido para iniciar a assinatura.",
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("user_subscriptions")
    .select("plan,billing_external_id,billing_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.plan === "pro" && existing.billing_status === "authorized") {
    throw new BillingError(409, "ALREADY_PRO", "Seu plano Pro já está ativo.");
  }

  if (existing?.billing_external_id && existing.billing_status === "pending") {
    const current = await fetchMercadoPagoSubscription(
      existing.billing_external_id,
      config.accessToken,
    );

    if (
      current.external_reference === user.id &&
      current.status === "pending" &&
      current.init_point
    ) {
      return {
        checkoutUrl: current.init_point,
        provider: "mercado_pago" as const,
        reused: true,
      };
    }
  }

  const response = await fetch(`${MERCADO_PAGO_API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: config.reason,
      external_reference: user.id,
      payer_email: user.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: config.monthlyPrice,
        currency_id: "BRL",
      },
      back_url: `${config.publicAppUrl}/plano?checkout=retorno`,
      status: "pending",
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await response.json().catch(() => null)) as MercadoPagoSubscription | null;

  if (!response.ok || !payload?.id || !payload.init_point) {
    console.error("[RadarShop AI] Mercado Pago checkout error", response.status, payload);
    throw new BillingError(502, "BILLING_PROVIDER_ERROR", "O checkout não pôde ser criado agora.");
  }

  const { error: saveError } = await supabaseAdmin.from("user_subscriptions").upsert(
    {
      user_id: user.id,
      billing_provider: "mercado_pago",
      billing_external_id: payload.id,
      billing_status: payload.status ?? "pending",
      billing_payer_id: payload.payer_id ? String(payload.payer_id) : null,
      billing_next_payment_at: payload.next_payment_date ?? null,
      billing_updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (saveError) throw saveError;

  return {
    checkoutUrl: payload.init_point,
    provider: "mercado_pago" as const,
    reused: false,
  };
}

export async function syncMercadoPagoBilling(request: Request) {
  const user = await requireApiUser(request);
  const config = requireManagementConfig();
  const subscription = await getOwnedMercadoPagoSubscription(user.id, config.accessToken);

  await reconcileMercadoPagoSubscription(subscription);

  return {
    ok: true,
    status: subscription.status ?? "unknown",
  };
}

export async function cancelMercadoPagoSubscription(request: Request) {
  const user = await requireApiUser(request);
  const config = requireManagementConfig();
  const current = await getOwnedMercadoPagoSubscription(user.id, config.accessToken);

  if (current.status === "canceled" || current.status === "cancelled") {
    await reconcileMercadoPagoSubscription(current);
    return { ok: true, status: current.status };
  }

  const response = await fetch(
    `${MERCADO_PAGO_API}/preapproval/${encodeURIComponent(current.id)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "canceled" }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  const payload = (await response.json().catch(() => null)) as MercadoPagoSubscription | null;

  if (!response.ok || !payload?.id) {
    console.error("[RadarShop AI] Mercado Pago cancellation error", response.status, payload);
    throw new BillingError(
      502,
      "BILLING_PROVIDER_ERROR",
      "A assinatura não pôde ser cancelada agora.",
    );
  }

  assertOwnedSubscription(payload, user.id);
  await reconcileMercadoPagoSubscription(payload);

  return {
    ok: true,
    status: payload.status ?? "canceled",
  };
}

export async function handleMercadoPagoWebhook(request: Request) {
  const config = requireWebhookConfig();
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("data_id");
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");

  verifyMercadoPagoSignature({
    dataId,
    xSignature,
    xRequestId,
    secret: config.webhookSecret,
  });

  const body = (await readJsonBody(request, 65_536)) as WebhookPayload;
  const resourceId = dataId ?? (body.data?.id ? String(body.data.id) : null);
  const eventType = url.searchParams.get("type") ?? body.type ?? "unknown";
  const providerEventId = body.id ? String(body.id) : (xRequestId ?? randomUUID());

  await recordWebhookEvent({
    providerEventId,
    eventType,
    resourceId,
    status: "received",
  });

  try {
    if (!resourceId) {
      await markWebhookEvent(providerEventId, "ignored");
      return { ok: true, ignored: true };
    }

    if (eventType === "subscription_preapproval") {
      const subscription = await fetchMercadoPagoSubscription(resourceId, config.accessToken);
      await reconcileMercadoPagoSubscription(subscription);
      await markWebhookEvent(providerEventId, "processed");
      return { ok: true };
    }

    if (eventType === "subscription_authorized_payment") {
      const invoice = await fetchMercadoPagoInvoice(resourceId, config.accessToken);

      if (invoice.payment?.status === "approved" && invoice.preapproval_id) {
        const subscription = await fetchMercadoPagoSubscription(
          invoice.preapproval_id,
          config.accessToken,
        );
        await reconcileMercadoPagoSubscription(subscription);
      }

      await markWebhookEvent(providerEventId, "processed");
      return { ok: true };
    }

    await markWebhookEvent(providerEventId, "ignored");
    return { ok: true, ignored: true };
  } catch (error) {
    await markWebhookEvent(
      providerEventId,
      "failed",
      error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido",
    );
    throw error;
  }
}

export function normalizeBillingError(error: unknown) {
  if (
    error instanceof BillingError ||
    error instanceof ApiAuthError ||
    error instanceof RequestBodyError
  ) {
    return new BillingError(error.status, error.code, error.message);
  }

  console.error("[RadarShop AI] billing error", error);
  return new BillingError(500, "BILLING_INTERNAL_ERROR", "Não foi possível concluir a operação.");
}

async function reconcileMercadoPagoSubscription(subscription: MercadoPagoSubscription) {
  const userId =
    typeof subscription.external_reference === "string"
      ? subscription.external_reference
      : subscription.external_reference !== null && subscription.external_reference !== undefined
        ? String(subscription.external_reference)
        : "";

  if (!userId || !subscription.id) {
    throw new Error("Assinatura do Mercado Pago sem referência interna válida.");
  }

  const providerStatus = subscription.status ?? "unknown";
  const now = new Date().toISOString();

  const baseValues = {
    user_id: userId,
    billing_provider: "mercado_pago",
    billing_external_id: subscription.id,
    billing_status: providerStatus,
    billing_payer_id: subscription.payer_id ? String(subscription.payer_id) : null,
    billing_next_payment_at: subscription.next_payment_date ?? null,
    billing_updated_at: now,
    updated_at: now,
  } as const;

  if (providerStatus === "authorized") {
    const { error } = await supabaseAdmin.from("user_subscriptions").upsert(
      {
        ...baseValues,
        plan: "pro",
        status: "active",
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;
    return;
  }

  if (
    providerStatus === "paused" ||
    providerStatus === "cancelled" ||
    providerStatus === "canceled"
  ) {
    const { error } = await supabaseAdmin.from("user_subscriptions").upsert(
      {
        ...baseValues,
        plan: "free",
        status: "active",
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("user_subscriptions").upsert(baseValues, {
    onConflict: "user_id",
  });

  if (error) throw error;
}

async function getOwnedMercadoPagoSubscription(userId: string, accessToken: string) {
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("billing_external_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.billing_external_id) {
    throw new BillingError(
      404,
      "BILLING_SUBSCRIPTION_NOT_FOUND",
      "Nenhuma assinatura vinculada foi encontrada.",
    );
  }

  const subscription = await fetchMercadoPagoSubscription(data.billing_external_id, accessToken);
  assertOwnedSubscription(subscription, userId);
  return subscription;
}

function assertOwnedSubscription(subscription: MercadoPagoSubscription, userId: string) {
  const reference =
    subscription.external_reference === null || subscription.external_reference === undefined
      ? ""
      : String(subscription.external_reference);

  if (reference !== userId) {
    throw new BillingError(
      403,
      "BILLING_SUBSCRIPTION_MISMATCH",
      "A assinatura retornada não pertence a esta conta.",
    );
  }
}

async function fetchMercadoPagoSubscription(id: string, accessToken: string) {
  const response = await fetch(`${MERCADO_PAGO_API}/preapproval/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await response.json().catch(() => null)) as MercadoPagoSubscription | null;

  if (!response.ok || !payload?.id) {
    throw new BillingError(
      502,
      "BILLING_PROVIDER_ERROR",
      "Não foi possível consultar a assinatura no provedor.",
    );
  }

  return payload;
}

async function fetchMercadoPagoInvoice(id: string, accessToken: string) {
  const response = await fetch(
    `${MERCADO_PAGO_API}/authorized_payments/${encodeURIComponent(id)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(20_000),
    },
  );

  const payload = (await response.json().catch(() => null)) as MercadoPagoInvoice | null;

  if (!response.ok || !payload?.id) {
    throw new BillingError(
      502,
      "BILLING_PROVIDER_ERROR",
      "Não foi possível consultar a cobrança recorrente no provedor.",
    );
  }

  return payload;
}

function verifyMercadoPagoSignature({
  dataId,
  xSignature,
  xRequestId,
  secret,
}: {
  dataId: string | null;
  xSignature: string | null;
  xRequestId: string | null;
  secret: string;
}) {
  if (!dataId || !xSignature || !xRequestId) {
    throw new BillingError(401, "INVALID_WEBHOOK_SIGNATURE", "Webhook sem assinatura válida.");
  }

  const parts = new Map(
    xSignature.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")] as const;
    }),
  );
  const timestamp = parts.get("ts");
  const receivedHash = parts.get("v1");

  if (!timestamp || !receivedHash) {
    throw new BillingError(401, "INVALID_WEBHOOK_SIGNATURE", "Webhook sem assinatura válida.");
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${timestamp};`;
  const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");

  if (!safeEqualHex(expectedHash, receivedHash)) {
    throw new BillingError(401, "INVALID_WEBHOOK_SIGNATURE", "Webhook com assinatura inválida.");
  }
}

function safeEqualHex(expected: string, received: string) {
  if (!/^[0-9a-f]+$/i.test(received) || expected.length !== received.length) return false;

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

async function recordWebhookEvent({
  providerEventId,
  eventType,
  resourceId,
  status,
}: {
  providerEventId: string;
  eventType: string;
  resourceId: string | null;
  status: "received" | "processed" | "ignored" | "failed";
}) {
  const { error } = await supabaseAdmin.from("billing_webhook_events").upsert(
    {
      provider: "mercado_pago",
      provider_event_id: providerEventId,
      event_type: eventType,
      resource_id: resourceId,
      status,
      received_at: new Date().toISOString(),
      processed_at: status === "received" ? null : new Date().toISOString(),
      error_message: null,
    },
    { onConflict: "provider,provider_event_id" },
  );

  if (error) throw error;
}

async function markWebhookEvent(
  providerEventId: string,
  status: "processed" | "ignored" | "failed",
  errorMessage: string | null = null,
) {
  const { error } = await supabaseAdmin
    .from("billing_webhook_events")
    .update({
      status,
      processed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("provider", "mercado_pago")
    .eq("provider_event_id", providerEventId);

  if (error) throw error;
}

function getBillingConfig() {
  const monthlyPrice = readPositiveMoney(process.env["MERCADO_PAGO_PRO_MONTHLY_BRL"]);
  const publicAppUrl = normalizePublicUrl(process.env["APP_PUBLIC_URL"]);
  const accessToken = process.env["MERCADO_PAGO_ACCESS_TOKEN"]?.trim() ?? "";
  const webhookSecret = process.env["MERCADO_PAGO_WEBHOOK_SECRET"]?.trim() ?? "";
  const salesFlagEnabled =
    process.env["MERCADO_PAGO_BILLING_ENABLED"]?.trim().toLowerCase() === "true";
  const managementReady = isUsageLimitsEnabled() && Boolean(accessToken);
  const webhookReady = Boolean(accessToken && webhookSecret);
  const checkoutEnabled = salesFlagEnabled && managementReady && Boolean(monthlyPrice && publicAppUrl);

  return {
    checkoutEnabled,
    managementReady,
    webhookReady,
    monthlyPrice,
    publicAppUrl,
    accessToken,
    webhookSecret,
    reason: process.env["MERCADO_PAGO_PRO_REASON"]?.trim() || "RadarShop AI Pro",
  };
}

function requireCheckoutConfig() {
  const config = getBillingConfig();

  if (!config.checkoutEnabled || !config.monthlyPrice || !config.publicAppUrl) {
    throw new BillingError(
      503,
      "BILLING_NOT_CONFIGURED",
      "Novas assinaturas do plano Pro estão desativadas ou incompletas neste ambiente.",
    );
  }

  return {
    ...config,
    monthlyPrice: config.monthlyPrice,
    publicAppUrl: config.publicAppUrl,
  };
}

function requireManagementConfig() {
  const config = getBillingConfig();

  if (!config.managementReady) {
    throw new BillingError(
      503,
      "BILLING_MANAGEMENT_NOT_CONFIGURED",
      "A gestão de assinaturas ainda não está configurada neste ambiente.",
    );
  }

  return config;
}

function requireWebhookConfig() {
  const config = getBillingConfig();

  if (!config.webhookReady) {
    throw new BillingError(
      503,
      "BILLING_WEBHOOK_NOT_CONFIGURED",
      "A reconciliação de Webhooks ainda não está configurada neste ambiente.",
    );
  }

  return config;
}

function readPositiveMoney(value: string | undefined) {
  if (!value) return null;

  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function normalizePublicUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    if (url.protocol !== "https:" && !local) return null;

    return url.origin;
  } catch {
    return null;
  }
}
