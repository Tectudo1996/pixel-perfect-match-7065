import { useQuery } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";
import type { ProductCategory, Produto } from "@/types/product";

export type ProductDetail = Produto & {
  description: string | null;
  original_url: string | null;
  identified_at: string;
};

export type ProductMetricPoint = {
  id: string;
  price: number | null;
  commission_amount: number | null;
  commission_percent: number | null;
  currency: string | null;
  sales_count: number | null;
  sales_7d: number | null;
  gmv_7d: number | null;
  gmv_total: number | null;
  creators_count: number | null;
  video_count: number | null;
  source: string | null;
  recorded_at: string;
};

export function useProductDetail(productId: string) {
  return useQuery({
    queryKey: ["product-detail", productId],
    enabled: Boolean(productId),
    queryFn: async () => {
      const [productResult, metricsResult] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,image_url,price,commission_amount,commission_percent,store_name,sales_count,creators_count,source,data_updated_at,description,original_url,identified_at,external_id,region,currency,sales_7d,gmv_7d,gmv_total,video_count,data_provenance,categories(name,slug)",
          )
          .eq("id", productId)
          .maybeSingle(),
        supabase
          .from("product_metrics_history")
          .select(
            "id,price,commission_amount,commission_percent,currency,sales_count,sales_7d,gmv_7d,gmv_total,creators_count,video_count,source,recorded_at",
          )
          .eq("product_id", productId)
          .order("recorded_at", { ascending: false })
          .limit(12),
      ]);

      if (productResult.error) throw productResult.error;
      if (metricsResult.error) throw metricsResult.error;
      if (!productResult.data) return null;

      const rawCategory = productResult.data.categories as
        ProductCategory | ProductCategory[] | null;
      const category = Array.isArray(rawCategory) ? (rawCategory[0] ?? null) : rawCategory;

      const product: ProductDetail = {
        ...productResult.data,
        categories: category,
      };

      return {
        product,
        metrics: (metricsResult.data ?? []) as ProductMetricPoint[],
      };
    },
    staleTime: 30_000,
  });
}
