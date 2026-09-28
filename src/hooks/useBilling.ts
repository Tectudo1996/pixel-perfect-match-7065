import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type BillingSummary = {
  configured: boolean;
  provider: "mercado_pago";
  currency: "BRL";
  monthlyPrice: number | null;
  billingStatus: string | null;
  externalSubscriptionId: string | null;
  nextPaymentAt: string | null;
};

export function useBillingSummary() {
  return useQuery({
    queryKey: ["billing-summary"],
    queryFn: async (): Promise<BillingSummary> => {
      const token = await requireAccessToken();
      return requestJson<BillingSummary>("/api/billing/status", token);
    },
    staleTime: 30_000,
  });
}

export function useStartProCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await requireAccessToken();
      return requestJson<{ checkoutUrl: string; provider: "mercado_pago"; reused: boolean }>(
        "/api/billing/checkout",
        token,
        { method: "POST" },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
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
