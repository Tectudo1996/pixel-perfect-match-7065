import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiAdminError, ApiAuthError, requireApiAdmin } from "@/lib/api-auth.server";
import { readJsonBody, RequestBodyError } from "@/lib/request-body.server";
import { isUsageLimitsEnabled } from "@/lib/usage.server";

type PlanCode = "free" | "pro";
type PlanStatus = "active" | "inactive";

type UpdatePayload = {
  userId: string;
  plan: PlanCode;
  status: PlanStatus;
  resetUsage: boolean;
};

export async function handleAdminSubscriptionsGet(request: Request) {
  try {
    await requireApiAdmin(request);

    if (!isUsageLimitsEnabled()) {
      return Response.json({ configured: false, accounts: [] });
    }

    const [profilesResult, subscriptionsResult] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,full_name,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("user_subscriptions").select("*"),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;

    const subscriptions = new Map(
      (subscriptionsResult.data ?? []).map((subscription) => [subscription.user_id, subscription]),
    );

    const accounts = (profilesResult.data ?? []).map((profile) => {
      const subscription = subscriptions.get(profile.id);

      return {
        userId: profile.id,
        fullName: profile.full_name,
        createdAt: profile.created_at,
        plan: subscription?.plan === "pro" ? "pro" : "free",
        status: subscription?.status ?? "active",
        used: subscription?.ai_generations_used ?? 0,
        periodStart: subscription?.current_period_start ?? null,
        periodEnd: subscription?.current_period_end ?? null,
      };
    });

    return Response.json({ configured: true, accounts });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleAdminSubscriptionsPatch(request: Request) {
  try {
    await requireApiAdmin(request);

    if (!isUsageLimitsEnabled()) {
      throw new AdminSubscriptionError(
        503,
        "PLAN_LIMITS_NOT_CONFIGURED",
        "A migration de planos ainda não foi ativada neste ambiente.",
      );
    }

    const payload = parseUpdatePayload(await readJsonBody(request, 8_192));

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", payload.userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      throw new AdminSubscriptionError(404, "USER_NOT_FOUND", "O usuário não foi encontrado.");
    }

    const values = {
      user_id: payload.userId,
      plan: payload.plan,
      status: payload.status,
      updated_at: new Date().toISOString(),
      ...(payload.resetUsage ? { ai_generations_used: 0 } : {}),
    };

    const { data, error } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert(values, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw error;

    return Response.json({
      ok: true,
      subscription: {
        userId: data.user_id,
        plan: data.plan,
        status: data.status,
        used: data.ai_generations_used,
        periodStart: data.current_period_start,
        periodEnd: data.current_period_end,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function parseUpdatePayload(value: unknown): UpdatePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdminSubscriptionError(400, "INVALID_PAYLOAD", "Os dados enviados são inválidos.");
  }

  const body = value as Record<string, unknown>;
  const userId = typeof body["userId"] === "string" ? body["userId"].trim() : "";
  const plan = body["plan"];
  const status = body["status"];
  const resetUsage = body["resetUsage"] === true;

  if (!userId || (plan !== "free" && plan !== "pro")) {
    throw new AdminSubscriptionError(400, "INVALID_PAYLOAD", "Usuário ou plano inválido.");
  }

  if (status !== "active" && status !== "inactive") {
    throw new AdminSubscriptionError(400, "INVALID_PAYLOAD", "Status de plano inválido.");
  }

  return { userId, plan, status, resetUsage };
}

class AdminSubscriptionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function errorResponse(error: unknown) {
  if (
    error instanceof ApiAuthError ||
    error instanceof ApiAdminError ||
    error instanceof RequestBodyError ||
    error instanceof AdminSubscriptionError
  ) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error("[RadarShop AI] admin subscription error", error);
  return Response.json(
    { error: "Não foi possível administrar os planos agora.", code: "ADMIN_PLAN_INTERNAL_ERROR" },
    { status: 500 },
  );
}
