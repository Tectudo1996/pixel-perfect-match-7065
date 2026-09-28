import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type TikTokShopConnectionStatus = {
  connected: boolean;
  openId: string | null;
  userType: number | null;
  grantedScopes: string[];
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
};

export function useTikTokShopConnection() {
  return useQuery({
    queryKey: ["tiktok-shop-connection"],
    queryFn: async (): Promise<TikTokShopConnectionStatus> => {
      const token = await requireAccessToken();
      return requestJson<TikTokShopConnectionStatus>("/api/integrations/tiktok-shop/status", token);
    },
    retry: false,
    staleTime: 30_000,
  });
}

export function useConnectTikTokShop() {
  return useMutation({
    mutationFn: async () => {
      const token = await requireAccessToken();
      return requestJson<{ authorizationUrl: string; expiresAt: string }>(
        "/api/integrations/tiktok-shop/authorize",
        token,
        { method: "POST" },
      );
    },
  });
}

export function useDisconnectTikTokShop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await requireAccessToken();
      return requestJson<{ ok: true }>("/api/integrations/tiktok-shop/status", token, {
        method: "DELETE",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tiktok-shop-connection"] });
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
        : "Não foi possível concluir a operação com o TikTok Shop.";
    throw new Error(message);
  }

  return payload as T;
}
