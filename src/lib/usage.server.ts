import type { Tables } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PlanCode = "free" | "pro";

type SubscriptionRow = Tables<"user_subscriptions">;

type ReservationRow = {
  allowed: boolean;
  used: number;
  period_start: string;
  period_end: string;
  plan: string;
  status: string;
};

export type PlanUsageSummary = {
  enforcementEnabled: boolean;
  plan: PlanCode;
  status: string;
  used: number;
  limit: number;
  remaining: number;
  periodStart: string | null;
  periodEnd: string | null;
  catalog: {
    free: { aiGenerationsMonthly: number };
    pro: { aiGenerationsMonthly: number };
  };
};

export class UsageLimitError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function getPlanUsage(userId: string): Promise<PlanUsageSummary> {
  const catalog = getPlanCatalog();

  if (!isUsageLimitsEnabled()) {
    return {
      enforcementEnabled: false,
      plan: "free",
      status: "unconfigured",
      used: 0,
      limit: catalog.free.aiGenerationsMonthly,
      remaining: catalog.free.aiGenerationsMonthly,
      periodStart: null,
      periodEnd: null,
      catalog,
    };
  }

  const subscription = await ensureSubscription(userId);
  const plan = normalizePlan(subscription.plan);
  const limit = catalog[plan].aiGenerationsMonthly;
  const periodExpired = new Date(subscription.current_period_end).getTime() <= Date.now();
  const used = periodExpired ? 0 : subscription.ai_generations_used;

  return {
    enforcementEnabled: true,
    plan,
    status: subscription.status,
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    periodStart: periodExpired
      ? startOfCurrentMonth().toISOString()
      : subscription.current_period_start,
    periodEnd: periodExpired ? startOfNextMonth().toISOString() : subscription.current_period_end,
    catalog,
  };
}

export async function reserveAiGeneration(userId: string) {
  if (!isUsageLimitsEnabled()) {
    return {
      reserved: false,
      summary: await getPlanUsage(userId),
    };
  }

  const subscription = await ensureSubscription(userId);
  const plan = normalizePlan(subscription.plan);
  const limit = getPlanCatalog()[plan].aiGenerationsMonthly;

  const { data, error } = await supabaseAdmin.rpc("reserve_ai_generation", {
    _user_id: userId,
    _limit: limit,
  });

  if (error) throw error;

  const row = (data?.[0] ?? null) as ReservationRow | null;

  if (!row) {
    throw new Error("Não foi possível reservar o uso da geração por IA.");
  }

  const summary = reservationToSummary(row);

  if (!row.allowed) {
    if (row.status !== "active") {
      throw new UsageLimitError(
        403,
        "PLAN_INACTIVE",
        "Seu plano não está ativo para novas gerações por IA.",
      );
    }

    throw new UsageLimitError(
      429,
      "AI_LIMIT_REACHED",
      "Você atingiu o limite mensal de gerações por IA do seu plano.",
    );
  }

  return { reserved: true, summary };
}

export async function refundAiGeneration(userId: string) {
  if (!isUsageLimitsEnabled()) return;

  const { error } = await supabaseAdmin.rpc("refund_ai_generation", {
    _user_id: userId,
  });

  if (error) throw error;
}

function reservationToSummary(row: ReservationRow): PlanUsageSummary {
  const catalog = getPlanCatalog();
  const plan = normalizePlan(row.plan);
  const limit = catalog[plan].aiGenerationsMonthly;

  return {
    enforcementEnabled: true,
    plan,
    status: row.status,
    used: row.used,
    limit,
    remaining: Math.max(limit - row.used, 0),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    catalog,
  };
}

async function ensureSubscription(userId: string): Promise<SubscriptionRow> {
  const { data: existing, error: readError } = await supabaseAdmin
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("user_subscriptions")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (!insertError && inserted) return inserted;

  // A simultaneous request may have created the row first.
  const { data: retry, error: retryError } = await supabaseAdmin
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (retryError) throw insertError ?? retryError;
  return retry;
}

function getPlanCatalog() {
  return {
    free: { aiGenerationsMonthly: readPositiveInt("AI_FREE_MONTHLY_LIMIT", 10) },
    pro: { aiGenerationsMonthly: readPositiveInt("AI_PRO_MONTHLY_LIMIT", 100) },
  } as const;
}

function normalizePlan(value: string): PlanCode {
  return value === "pro" ? "pro" : "free";
}

export function isUsageLimitsEnabled() {
  return process.env["AI_USAGE_LIMITS_ENABLED"]?.trim().toLowerCase() === "true";
}

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfNextMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
