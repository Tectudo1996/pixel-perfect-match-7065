import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type BillingProvider = "mercado_pago" | "paypal" | "pepper";

export type BillingProviderOption = {
  id: BillingProvider;
  label: string;
  description: string;
  configured: boolean;
  managementAvailable: boolean;
  automaticEntitlement: boolean;
  monthlyPrice: number | null;
};

export type BillingSummary = {
  configured: boolean;
  managementAvailable: boolean;
  provider: BillingProvider | null;
  currency: "BRL";
  monthlyPrice: number | null;
  billingStatus: string | null;
  externalSubscriptionId: string | null;
  nextPaymentAt: string | null;
  providers: BillingProviderOption[];
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
    mutationFn: async (provider: BillingProvider) => {
      const token = await requireAccessToken();
      const params = new URLSearchParams({ provider });
      return requestJson<{
        checkoutUrl: string;
        provider: BillingProvider;
        reused: boolean;
        requiresManualActivation?: boolean;
      }>(`/api/billing/checkout?${params.toString()}`, token, { method: "POST" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
    },
  });
}

export function useSyncBilling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await requireAccessToken();
      return requestJson<{ ok: true; status: string }>("/api/billing/sync", token, {
        method: "POST",
      });
    },
    onSuccess: () => invalidateBillingQueries(queryClient),
  });
}

export function useCancelBilling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await requireAccessToken();
      return requestJson<{ ok: true; status: string }>("/api/billing/cancel", token, {
        method: "POST",
      });
    },
    onSuccess: () => invalidateBillingQueries(queryClient),
  });
}

async function invalidateBillingQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["billing-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["plan-usage"] }),
  ]);
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
