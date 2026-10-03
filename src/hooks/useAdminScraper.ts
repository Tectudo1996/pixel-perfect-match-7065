import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type AdminScraperInput = {
  url: string;
  source: string;
  categorySlug: string;
};

export type AdminScraperPreview = {
  name: string;
  description: string | null;
  imageUrl: string | null;
  originalUrl: string;
  price: number | null;
  currency: string | null;
  importPrice: number | null;
  storeName: string | null;
  source: string;
  categorySlug: string | null;
  extraction: "json-ld" | "metadata";
  warnings: string[];
};

type ScraperResponse = {
  ok: true;
  preview: AdminScraperPreview;
  result?: {
    ok: true;
    source: string;
    collected_at: string;
    accepted: number;
    inserted: number;
    updated: number;
    metric_snapshots: number;
  };
};

export function useAdminScraperPreview() {
  return useMutation({
    mutationFn: async (input: AdminScraperInput) =>
      requestScraper({
        ...input,
        action: "preview",
      }),
  });
}

export function useAdminScraperImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AdminScraperInput) =>
      requestScraper({
        ...input,
        action: "import",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-ingestion-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["product-radar"] }),
        queryClient.invalidateQueries({ queryKey: ["personal-radar"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      ]);
    },
  });
}

async function requestScraper(
  input: AdminScraperInput & { action: "preview" | "import" },
): Promise<ScraperResponse> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

  const response = await fetch("/api/admin/scraper", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: input.action,
      url: input.url.trim(),
      source: input.source.trim() || null,
      categorySlug: input.categorySlug || null,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : "Não foi possível concluir a raspagem.";
    throw new Error(message);
  }

  return payload as ScraperResponse;
}
