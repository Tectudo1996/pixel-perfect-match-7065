import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type MarketVideo = {
  id: string;
  externalVideoId: string;
  creatorUid: string | null;
  sellerId: string | null;
  isAd: boolean | null;
  commentCount: number | null;
  diggCount: number | null;
  playCount: number | null;
  shareCount: number | null;
  unitsSold: number | null;
  gmv: number | null;
  region: string | null;
  description: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
  fastmossUrl: string | null;
  tiktokUrl: string | null;
  publishedAt: string | null;
  fetchedAt: string;
};

export type MarketCreator = {
  id: string;
  creatorUid: string;
  uniqueId: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  unitsSold: number | null;
  gmv: number | null;
  categoryId: number | null;
  categoryName: string | null;
  followerCount: number | null;
  awemeCount: number | null;
  favoritingCount: number | null;
  region: string | null;
  fetchedAt: string;
};

export type ProductMarketContent = {
  productId: string;
  available: boolean;
  source: string;
  currency: string | null;
  lastUpdatedAt: string | null;
  canRefreshAt: string | null;
  videos: MarketVideo[];
  creators: MarketCreator[];
  totals: {
    videos: number;
    creators: number;
  };
  cached?: boolean;
  partial?: boolean;
  warnings?: string[];
};

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

  return token;
}

async function readResponse(response: Response): Promise<ProductMarketContent> {
  const payload = (await response.json().catch(() => null)) as
    (ProductMarketContent & { error?: string }) | { error?: string } | null;

  if (!response.ok || !payload || !("productId" in payload)) {
    throw new Error(payload?.error || "Não foi possível carregar a inteligência de mercado.");
  }

  return payload;
}

export function useProductMarketContent(productId: string, enabled = true) {
  return useQuery({
    queryKey: ["product-market-content", productId],
    enabled: enabled && Boolean(productId),
    queryFn: async () => {
      const token = await getAccessToken();
      const params = new URLSearchParams({
        productId,
        marketContent: "1",
      });
      const response = await fetch(`/api/integrations/products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      return readResponse(response);
    },
    staleTime: 30_000,
  });
}

export function useRefreshProductMarketContent(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const response = await fetch("/api/integrations/products", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "refresh-market-content",
          productId,
        }),
      });

      return readResponse(response);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-market-content", productId] }),
        queryClient.invalidateQueries({ queryKey: ["product-detail", productId] }),
      ]);
    },
  });
}
