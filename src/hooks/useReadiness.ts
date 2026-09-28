import { useQuery } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type ReadinessCheck = {
  id: string;
  label: string;
  state: "ready" | "disabled" | "missing" | "error";
  detail: string;
};

export type ReadinessReport = {
  checkedAt: string;
  coreReady: boolean;
  paidLaunchReady: boolean;
  checks: ReadinessCheck[];
};

export function useReadiness(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-readiness"],
    enabled,
    queryFn: async (): Promise<ReadinessReport> => {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const token = data.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

      const response = await fetch("/api/admin/readiness", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && typeof payload.error === "string"
            ? payload.error
            : "Não foi possível verificar a prontidão.";
        throw new Error(message);
      }

      return payload as ReadinessReport;
    },
    staleTime: 15_000,
  });
}
