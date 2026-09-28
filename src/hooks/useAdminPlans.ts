import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type AdminPlanAccount = {
  userId: string;
  fullName: string | null;
  createdAt: string;
  plan: "free" | "pro";
  status: string;
  used: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export type AdminPlanResponse = {
  configured: boolean;
  accounts: AdminPlanAccount[];
};

type AdminPlanUpdate = {
  userId: string;
  plan: "free" | "pro";
  status: "active" | "inactive";
  resetUsage?: boolean;
};

export function useAdminPlanAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-plan-accounts"],
    enabled,
    queryFn: async (): Promise<AdminPlanResponse> => {
      const accessToken = await requireAccessToken();
      return requestJson<AdminPlanResponse>("/api/admin/subscriptions", accessToken);
    },
    staleTime: 20_000,
  });
}

export function useUpdateAdminPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: AdminPlanUpdate) => {
      const accessToken = await requireAccessToken();

      return requestJson<{ ok: true }>(
        "/api/admin/subscriptions",
        accessToken,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...values,
            resetUsage: values.resetUsage === true,
          }),
        },
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-plan-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["plan-usage"] }),
      ]);
    },
  });
}

async function requireAccessToken() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  const token = data.session?.access_token;

  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

  return token;
}

async function requestJson<T>(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível concluir a operação.";
    throw new Error(message);
  }

  return payload as T;
}
