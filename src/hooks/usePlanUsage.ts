import { useQuery } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type PlanUsage = {
  enforcementEnabled: boolean;
  plan: "free" | "pro";
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

export function usePlanUsage() {
  return useQuery({
    queryKey: ["plan-usage"],
    queryFn: async (): Promise<PlanUsage> => {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      const response = await fetch("/api/usage", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && typeof payload.error === "string"
            ? payload.error
            : "Não foi possível carregar os dados do plano.";
        throw new Error(message);
      }

      return payload as PlanUsage;
    },
    staleTime: 30_000,
  });
}
