import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type TikTokShopConnectionStatus = {
  enabled: boolean;
  configured: boolean;
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

export type TikTokShopShowcaseSyncResult = {
  ok: true;
  pages_read: number;
  showcase_items: number;
  saved: number;
  skipped: number;
  synced_at: string;
};

export function useSyncTikTokShowcase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await requireAccessToken();
      return requestJson<TikTokShopShowcaseSyncResult>(
        "/api/integrations/tiktok-shop/showcase/sync",
        token,
        { method: "POST" },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tiktok-shop-connection"] });
    },
  });
}

export type TikTokCreatorOpportunity = {
  id: string;
  title: string;
  detailLink: string | null;
  imageUrl: string | null;
  shopName: string | null;
  saleRegion: string | null;
  hasInventory: boolean | null;
  unitsSold: number | null;
  currency: string | null;
  minimumPrice: number | null;
  maximumPrice: number | null;
  commissionAmount: number | null;
  commissionCurrency: string | null;
  commissionPercent: number | null;
};

export type TikTokDiscoveryResult = {
  products: TikTokCreatorOpportunity[];
  nextPageToken: string | null;
  total: number;
};

export function useSearchTikTokOpportunities() {
  return useMutation({
    mutationFn: async ({
      search,
      sort,
      pageToken,
    }: {
      search?: string;
      sort: "commission" | "sales";
      pageToken?: string;
    }) => {
      const token = await requireAccessToken();
      return requestJson<TikTokDiscoveryResult>("/api/integrations/tiktok-shop/discovery", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(search?.trim() ? { search: search.trim() } : {}),
          sort,
          ...(pageToken ? { pageToken } : {}),
        }),
      });
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
