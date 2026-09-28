import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiAuthError, requireApiUser } from "@/lib/api-auth.server";
import { readJsonBody, RequestBodyError } from "@/lib/request-body.server";
import { isUsageLimitsEnabled } from "@/lib/usage.server";

const MERCADO_PAGO_API = "https://api.mercadopago.com";

export type BillingProvider = "mercado_pago" | "paypal" | "pepper";

type BillingProviderOption = {
  id: BillingProvider;
  label: string;
  description: string;
  configured: boolean;
  managementAvailable: boolean;
  automaticEntitlement: boolean;
  monthlyPrice: number | null;
};

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

type PayPalSubscription = {
  id: string;
  status?: string;
  custom_id?: string;
  subscriber?: {
    payer_id?: string;
    email_address?: string;
  };
  billing_info?: {
    next_billing_time?: string;
  };
  links?: Array<{
    href?: string;
    rel?: string;
    method?: string;
  }>;
};

type PayPalWebhook = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
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
  const mercadoPago = getBillingConfig();
  const paypal = getPayPalConfig();
  const pepper = getPepperConfig();
  const providers = buildProviderOptions({ mercadoPago, paypal, pepper });

  if (!isUsageLimitsEnabled()) {
    return {
      configured: false,
      managementAvailable: false,
      provider: null as BillingProvider | null,
      currency: "BRL" as const,
      monthlyPrice: null,
      billingStatus: null,
      externalSubscriptionId: null,
      nextPaymentAt: null,
      providers,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("billing_provider,billing_external_id,billing_status,billing_next_payment_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  const provider = normalizeBillingProvider(data?.billing_provider);
  const activeOption = provider ? providers.find((item) => item.id === provider) : null;

  return {
    configured: providers.some((item) => item.configured),
    managementAvailable: activeOption?.managementAvailable ?? false,
    provider,
    currency: "BRL" as const,
    monthlyPrice: activeOption?.monthlyPrice ?? null,
    billingStatus: data?.billing_status ?? null,
    externalSubscriptionId: data?.billing_external_id ?? null,
    nextPaymentAt: data?.billing_next_payment_at ?? null,
    providers,
  };
}

export async function createBillingCheckout(request: Request) {
  const provider = getRequestedBillingProvider(request);

  if (provider === "mercado_pago") return createMercadoPagoCheckout(request);
  if (provider === "paypal") return createPayPalCheckout(request);
  return createPepperCheckout(request);
}

export async function syncBilling(request: Request) {
  const provider = await getUserBillingProvider(request);

  if (provider === "mercado_pago") return syncMercadoPagoBilling(request);
  if (provider === "paypal") return syncPayPalBilling(request);

  throw new BillingError(
    409,
    "BILLING_MANAGEMENT_UNAVAILABLE",
    "A sincronização automática ainda não está disponível para este gateway.",
  );
}

export async function cancelBilling(request: Request) {
  const provider = await getUserBillingProvider(request);

  if (provider === "mercado_pago") return cancelMercadoPagoSubscription(request);
  if (provider === "paypal") return cancelPayPalSubscription(request);

  throw new BillingError(
    409,
    "BILLING_MANAGEMENT_UNAVAILABLE",
    "O cancelamento automático ainda não está disponível para este gateway.",
  );
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
    .select("plan,billing_provider,billing_external_id,billing_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.plan === "pro" && existing.billing_status === "authorized") {
    throw new BillingError(409, "ALREADY_PRO", "Seu plano Pro já está ativo.");
  }

  assertGatewaySwitchAllowed(existing, "mercado_pago");

  if (
    existing?.billing_provider === "mercado_pago" &&
    existing.billing_external_id &&
    existing.billing_status === "pending"
  ) {
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

export async function createPayPalCheckout(request: Request) {
  const user = await requireApiUser(request);
  const config = requirePayPalCheckoutConfig();

  if (!user.email) {
    throw new BillingError(
      400,
      "BILLING_EMAIL_REQUIRED",
      "Sua conta precisa ter um e-mail válido para iniciar a assinatura.",
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("user_subscriptions")
    .select("plan,billing_provider,billing_external_id,billing_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (
    existing?.plan === "pro" &&
    existing.billing_provider === "paypal" &&
    existing.billing_status === "authorized"
  ) {
    throw new BillingError(409, "ALREADY_PRO", "Seu plano Pro já está ativo.");
  }

  assertGatewaySwitchAllowed(existing, "paypal");

  const accessToken = await getPayPalAccessToken(config);

  if (
    existing?.billing_provider === "paypal" &&
    existing.billing_external_id &&
    existing.billing_status === "pending"
  ) {
    const current = await fetchPayPalSubscription(
      existing.billing_external_id,
      accessToken,
      config.apiBase,
    );
    assertOwnedPayPalSubscription(current, user.id);
    const approvalUrl = findPayPalApprovalUrl(current);

    if (approvalUrl) {
      return {
        checkoutUrl: approvalUrl,
        provider: "paypal" as const,
        reused: true,
      };
    }
  }

  const response = await fetch(`${config.apiBase}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": randomUUID(),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      plan_id: config.planId,
      custom_id: user.id,
      subscriber: {
        email_address: user.email,
      },
      application_context: {
        brand_name: config.brandName,
        locale: "pt-BR",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: `${config.publicAppUrl}/plano?checkout=retorno&gateway=paypal`,
        cancel_url: `${config.publicAppUrl}/plano?checkout=cancelado&gateway=paypal`,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await response.json().catch(() => null)) as PayPalSubscription | null;
  const approvalUrl = payload ? findPayPalApprovalUrl(payload) : null;

  if (!response.ok || !payload?.id || !approvalUrl) {
    console.error("[RadarShop AI] PayPal checkout error", response.status, payload);
    throw new BillingError(502, "BILLING_PROVIDER_ERROR", "O checkout PayPal não pôde ser criado.");
  }

  const { error: saveError } = await supabaseAdmin.from("user_subscriptions").upsert(
    {
      user_id: user.id,
      billing_provider: "paypal",
      billing_external_id: payload.id,
      billing_status: normalizePayPalStatus(payload.status),
      billing_payer_id: payload.subscriber?.payer_id ?? null,
      billing_next_payment_at: payload.billing_info?.next_billing_time ?? null,
      billing_updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (saveError) throw saveError;

  return {
    checkoutUrl: approvalUrl,
    provider: "paypal" as const,
    reused: false,
  };
}

export async function syncPayPalBilling(request: Request) {
  const user = await requireApiUser(request);
  const config = requirePayPalManagementConfig();
  const accessToken = await getPayPalAccessToken(config);
  const subscription = await getOwnedPayPalSubscription(user.id, accessToken, config.apiBase);

  await reconcilePayPalSubscription(subscription);

  return {
    ok: true,
    status: normalizePayPalStatus(subscription.status),
  };
}

export async function cancelPayPalSubscription(request: Request) {
  const user = await requireApiUser(request);
  const config = requirePayPalManagementConfig();
  const accessToken = await getPayPalAccessToken(config);
  const current = await getOwnedPayPalSubscription(user.id, accessToken, config.apiBase);
  const normalized = normalizePayPalStatus(current.status);

  if (normalized === "canceled") {
    await reconcilePayPalSubscription(current);
    return { ok: true, status: normalized };
  }

  const response = await fetch(
    `${config.apiBase}/v1/billing/subscriptions/${encodeURIComponent(current.id)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Cancelado pelo usuário no RadarShop AI." }),
      signal: AbortSignal.timeout(20_000),
    },
  );

  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => null);
    console.error("[RadarShop AI] PayPal cancellation error", response.status, payload);
    throw new BillingError(
      502,
      "BILLING_PROVIDER_ERROR",
      "A assinatura PayPal não pôde ser cancelada agora.",
    );
  }

  const updated = await fetchPayPalSubscription(current.id, accessToken, config.apiBase);
  await reconcilePayPalSubscription(updated);

  return {
    ok: true,
    status: normalizePayPalStatus(updated.status),
  };
}

export async function createPepperCheckout(request: Request) {
  await requireApiUser(request);
  const config = requirePepperCheckoutConfig();

  return {
    checkoutUrl: config.checkoutUrl,
    provider: "pepper" as const,
    reused: true,
    requiresManualActivation: true,
  };
}

export async function handlePayPalWebhook(request: Request) {
  const config = requirePayPalWebhookConfig();
  const event = (await readJsonBody(request, 131_072)) as PayPalWebhook;
  const accessToken = await getPayPalAccessToken(config);

  await verifyPayPalWebhook(request, event, accessToken, config);

  const eventId = event.id ?? randomUUID();
  const eventType = event.event_type ?? "unknown";
  const resourceId = event.resource?.id ?? null;

  await recordWebhookEvent({
    provider: "paypal",
    providerEventId: eventId,
    eventType,
    resourceId,
    status: "received",
  });

  try {
    if (!resourceId || !eventType.startsWith("BILLING.SUBSCRIPTION.")) {
      await markWebhookEvent("paypal", eventId, "ignored");
      return { ok: true, ignored: true };
    }

    const subscription = await fetchPayPalSubscription(resourceId, accessToken, config.apiBase);
    await reconcilePayPalSubscription(subscription);
    await markWebhookEvent("paypal", eventId, "processed");

    return { ok: true };
  } catch (error) {
    await markWebhookEvent(
      "paypal",
      eventId,
      "failed",
      error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido",
    );
    throw error;
  }
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
    provider: "mercado_pago",
    providerEventId,
    eventType,
    resourceId,
    status: "received",
  });

  try {
    if (!resourceId) {
      await markWebhookEvent("mercado_pago", providerEventId, "ignored");
      return { ok: true, ignored: true };
    }

    if (eventType === "subscription_preapproval") {
      const subscription = await fetchMercadoPagoSubscription(resourceId, config.accessToken);
      await reconcileMercadoPagoSubscription(subscription);
      await markWebhookEvent("mercado_pago", providerEventId, "processed");
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

      await markWebhookEvent("mercado_pago", providerEventId, "processed");
      return { ok: true };
    }

    await markWebhookEvent("mercado_pago", providerEventId, "ignored");
    return { ok: true, ignored: true };
  } catch (error) {
    await markWebhookEvent(
      "mercado_pago",
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
  provider,
  providerEventId,
  eventType,
  resourceId,
  status,
}: {
  provider: BillingProvider;
  providerEventId: string;
  eventType: string;
  resourceId: string | null;
  status: "received" | "processed" | "ignored" | "failed";
}) {
  const { error } = await supabaseAdmin.from("billing_webhook_events").upsert(
    {
      provider,
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
  provider: BillingProvider,
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
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId);

  if (error) throw error;
}

async function reconcilePayPalSubscription(subscription: PayPalSubscription) {
  if (!subscription.id || !subscription.custom_id) {
    throw new Error("Assinatura PayPal sem referência interna válida.");
  }

  const normalizedStatus = normalizePayPalStatus(subscription.status);
  const now = new Date().toISOString();
  const baseValues = {
    user_id: subscription.custom_id,
    billing_provider: "paypal",
    billing_external_id: subscription.id,
    billing_status: normalizedStatus,
    billing_payer_id: subscription.subscriber?.payer_id ?? null,
    billing_next_payment_at: subscription.billing_info?.next_billing_time ?? null,
    billing_updated_at: now,
    updated_at: now,
  } as const;

  if (normalizedStatus === "authorized") {
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

  if (normalizedStatus === "paused" || normalizedStatus === "canceled") {
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

async function getOwnedPayPalSubscription(userId: string, accessToken: string, apiBase: string) {
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("billing_provider,billing_external_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data?.billing_provider !== "paypal" || !data.billing_external_id) {
    throw new BillingError(
      404,
      "BILLING_SUBSCRIPTION_NOT_FOUND",
      "Nenhuma assinatura PayPal vinculada foi encontrada.",
    );
  }

  const subscription = await fetchPayPalSubscription(
    data.billing_external_id,
    accessToken,
    apiBase,
  );
  assertOwnedPayPalSubscription(subscription, userId);
  return subscription;
}

async function fetchPayPalSubscription(id: string, accessToken: string, apiBase: string) {
  const response = await fetch(`${apiBase}/v1/billing/subscriptions/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await response.json().catch(() => null)) as PayPalSubscription | null;

  if (!response.ok || !payload?.id) {
    throw new BillingError(
      502,
      "BILLING_PROVIDER_ERROR",
      "Não foi possível consultar a assinatura PayPal.",
    );
  }

  return payload;
}

function assertOwnedPayPalSubscription(subscription: PayPalSubscription, userId: string) {
  if (subscription.custom_id !== userId) {
    throw new BillingError(
      403,
      "BILLING_SUBSCRIPTION_MISMATCH",
      "A assinatura PayPal retornada não pertence a esta conta.",
    );
  }
}

function findPayPalApprovalUrl(subscription: PayPalSubscription) {
  return subscription.links?.find((link) => link.rel === "approve")?.href ?? null;
}

function normalizePayPalStatus(status: string | undefined) {
  if (status === "ACTIVE") return "authorized";
  if (status === "SUSPENDED") return "paused";
  if (status === "CANCELLED" || status === "EXPIRED") return "canceled";
  if (status === "APPROVED" || status === "APPROVAL_PENDING") return "pending";
  return status?.toLowerCase() || "unknown";
}

async function getPayPalAccessToken(config: {
  clientId: string;
  clientSecret: string;
  apiBase: string;
}) {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${config.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await response.json().catch(() => null)) as { access_token?: string } | null;

  if (!response.ok || !payload?.access_token) {
    throw new BillingError(502, "BILLING_PROVIDER_ERROR", "Não foi possível autenticar no PayPal.");
  }

  return payload.access_token;
}

async function verifyPayPalWebhook(
  request: Request,
  event: PayPalWebhook,
  accessToken: string,
  config: ReturnType<typeof requirePayPalWebhookConfig>,
) {
  const authAlgo = request.headers.get("paypal-auth-algo");
  const certUrl = request.headers.get("paypal-cert-url");
  const transmissionId = request.headers.get("paypal-transmission-id");
  const transmissionSig = request.headers.get("paypal-transmission-sig");
  const transmissionTime = request.headers.get("paypal-transmission-time");

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    throw new BillingError(
      401,
      "INVALID_WEBHOOK_SIGNATURE",
      "Webhook PayPal sem assinatura válida.",
    );
  }

  const response = await fetch(`${config.apiBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: config.webhookId,
      webhook_event: event,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await response.json().catch(() => null)) as {
    verification_status?: string;
  } | null;

  if (!response.ok || payload?.verification_status !== "SUCCESS") {
    throw new BillingError(
      401,
      "INVALID_WEBHOOK_SIGNATURE",
      "Webhook PayPal com assinatura inválida.",
    );
  }
}

async function getUserBillingProvider(request: Request): Promise<BillingProvider> {
  const user = await requireApiUser(request);
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("billing_provider")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  const provider = normalizeBillingProvider(data?.billing_provider);
  if (!provider) {
    throw new BillingError(
      404,
      "BILLING_SUBSCRIPTION_NOT_FOUND",
      "Nenhuma assinatura vinculada foi encontrada.",
    );
  }

  return provider;
}

function assertGatewaySwitchAllowed(
  existing: {
    billing_provider: string | null;
    billing_external_id: string | null;
    billing_status: string | null;
  } | null,
  requestedProvider: BillingProvider,
) {
  if (
    !existing?.billing_provider ||
    !existing.billing_external_id ||
    existing.billing_provider === requestedProvider
  ) {
    return;
  }

  const terminalStatuses = new Set(["canceled", "cancelled", "expired", "inactive"]);
  if (existing.billing_status && terminalStatuses.has(existing.billing_status.toLowerCase())) {
    return;
  }

  throw new BillingError(
    409,
    "BILLING_GATEWAY_CONFLICT",
    "Já existe uma assinatura ou checkout vinculado a outro gateway. Atualize ou cancele esse fluxo antes de trocar.",
  );
}

function getRequestedBillingProvider(request: Request): BillingProvider {
  const raw = new URL(request.url).searchParams.get("provider");
  const provider = normalizeBillingProvider(raw);

  if (!provider) {
    throw new BillingError(
      400,
      "INVALID_BILLING_PROVIDER",
      "Selecione um gateway de pagamento válido.",
    );
  }

  return provider;
}

function normalizeBillingProvider(value: string | null | undefined): BillingProvider | null {
  return value === "mercado_pago" || value === "paypal" || value === "pepper" ? value : null;
}

function buildProviderOptions({
  mercadoPago,
  paypal,
  pepper,
}: {
  mercadoPago: ReturnType<typeof getBillingConfig>;
  paypal: ReturnType<typeof getPayPalConfig>;
  pepper: ReturnType<typeof getPepperConfig>;
}): BillingProviderOption[] {
  return [
    {
      id: "mercado_pago",
      label: "Mercado Pago",
      description: "Assinatura recorrente com confirmação automática por Webhook.",
      configured: mercadoPago.checkoutEnabled,
      managementAvailable: mercadoPago.managementReady,
      automaticEntitlement: true,
      monthlyPrice: mercadoPago.monthlyPrice,
    },
    {
      id: "paypal",
      label: "PayPal",
      description: "Assinatura recorrente pela API oficial do PayPal.",
      configured: paypal.checkoutEnabled,
      managementAvailable: paypal.managementReady,
      automaticEntitlement: true,
      monthlyPrice: paypal.monthlyPrice,
    },
    {
      id: "pepper",
      label: "Pepper",
      description:
        "Checkout brasileiro com Pix, cartão e boleto; ativação automática exige a API da conta.",
      configured: pepper.checkoutEnabled,
      managementAvailable: false,
      automaticEntitlement: false,
      monthlyPrice: pepper.monthlyPrice,
    },
  ];
}

function getPayPalConfig() {
  const environment =
    process.env["PAYPAL_ENVIRONMENT"]?.trim().toLowerCase() === "live" ? "live" : "sandbox";
  const apiBase =
    environment === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const clientId = process.env["PAYPAL_CLIENT_ID"]?.trim() ?? "";
  const clientSecret = process.env["PAYPAL_CLIENT_SECRET"]?.trim() ?? "";
  const planId = process.env["PAYPAL_PLAN_ID"]?.trim() ?? "";
  const webhookId = process.env["PAYPAL_WEBHOOK_ID"]?.trim() ?? "";
  const monthlyPrice = readPositiveMoney(process.env["PAYPAL_PRO_MONTHLY_BRL"]);
  const publicAppUrl = normalizePublicUrl(process.env["APP_PUBLIC_URL"]);
  const salesFlagEnabled = envFlag("PAYPAL_BILLING_ENABLED");
  const managementReady = isUsageLimitsEnabled() && Boolean(clientId && clientSecret);
  const webhookReady = Boolean(clientId && clientSecret && webhookId);
  const checkoutEnabled =
    salesFlagEnabled && managementReady && Boolean(planId && publicAppUrl && monthlyPrice);

  return {
    environment,
    apiBase,
    clientId,
    clientSecret,
    planId,
    webhookId,
    monthlyPrice,
    publicAppUrl,
    managementReady,
    webhookReady,
    checkoutEnabled,
    brandName: process.env["PAYPAL_BRAND_NAME"]?.trim() || "RadarShop AI",
  };
}

function requirePayPalCheckoutConfig() {
  const config = getPayPalConfig();
  if (!config.checkoutEnabled || !config.planId || !config.publicAppUrl) {
    throw new BillingError(
      503,
      "BILLING_NOT_CONFIGURED",
      "O checkout PayPal ainda não está configurado neste ambiente.",
    );
  }

  return {
    ...config,
    planId: config.planId,
    publicAppUrl: config.publicAppUrl,
  };
}

function requirePayPalManagementConfig() {
  const config = getPayPalConfig();
  if (!config.managementReady) {
    throw new BillingError(
      503,
      "BILLING_MANAGEMENT_NOT_CONFIGURED",
      "A gestão de assinaturas PayPal ainda não está configurada.",
    );
  }
  return config;
}

function requirePayPalWebhookConfig() {
  const config = getPayPalConfig();
  if (!config.webhookReady || !config.webhookId) {
    throw new BillingError(
      503,
      "BILLING_WEBHOOK_NOT_CONFIGURED",
      "O Webhook do PayPal ainda não está configurado.",
    );
  }
  return { ...config, webhookId: config.webhookId };
}

function getPepperConfig() {
  const checkoutUrl = normalizeExternalCheckoutUrl(process.env["PEPPER_CHECKOUT_URL"]);
  const monthlyPrice = readPositiveMoney(process.env["PEPPER_PRO_MONTHLY_BRL"]);
  const checkoutEnabled = envFlag("PEPPER_BILLING_ENABLED") && Boolean(checkoutUrl && monthlyPrice);

  return {
    checkoutUrl,
    monthlyPrice,
    checkoutEnabled,
  };
}

function requirePepperCheckoutConfig() {
  const config = getPepperConfig();
  if (!config.checkoutEnabled || !config.checkoutUrl) {
    throw new BillingError(
      503,
      "BILLING_NOT_CONFIGURED",
      "O checkout Pepper ainda não está configurado neste ambiente.",
    );
  }
  return { ...config, checkoutUrl: config.checkoutUrl };
}

function normalizeExternalCheckoutUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function envFlag(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
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
  const checkoutEnabled =
    salesFlagEnabled && managementReady && Boolean(monthlyPrice && publicAppUrl);

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
