import { useQuery } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";
import {
  buildMarketIntelligence,
  type IntelligenceMetricPoint,
  type IntelligenceProduct,
} from "@/lib/market-intelligence";
import type { ProductCategory } from "@/types/product";

const PRODUCT_LIMIT = 200;
const METRIC_CHUNK_SIZE = 40;

export function useMarketIntelligence() {
  return useQuery({
    queryKey: ["market-intelligence"],
    queryFn: async () => {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select(
          "id,name,image_url,price,commission_amount,commission_percent,store_name,sales_count,creators_count,source,data_updated_at,identified_at,categories(name,slug)",
        )
        .order("data_updated_at", { ascending: false })
        .limit(PRODUCT_LIMIT);

      if (productsError) throw productsError;

      const normalizedProducts: IntelligenceProduct[] = (products ?? []).map((product) => {
        const rawCategory = product.categories as ProductCategory | ProductCategory[] | null;
        const category = Array.isArray(rawCategory) ? (rawCategory[0] ?? null) : rawCategory;

        return {
          ...product,
          categories: category,
        };
      });

      const metricsByProduct = new Map<string, IntelligenceMetricPoint[]>();
      const productIds = normalizedProducts.map((product) => product.id);

      for (let index = 0; index < productIds.length; index += METRIC_CHUNK_SIZE) {
        const ids = productIds.slice(index, index + METRIC_CHUNK_SIZE);
        const { data: metrics, error: metricsError } = await supabase
          .from("product_metrics_history")
          .select("product_id,sales_count,creators_count,recorded_at")
          .in("product_id", ids)
          .order("recorded_at", { ascending: true })
          .limit(1000);

        if (metricsError) throw metricsError;

        for (const metric of metrics ?? []) {
          const current = metricsByProduct.get(metric.product_id) ?? [];
          current.push({
            sales_count: metric.sales_count,
            creators_count: metric.creators_count,
            recorded_at: metric.recorded_at,
          });
          metricsByProduct.set(metric.product_id, current);
        }
      }

      return {
        ...buildMarketIntelligence(normalizedProducts, metricsByProduct),
        analyzedCount: normalizedProducts.length,
        limit: PRODUCT_LIMIT,
      };
    },
    staleTime: 60_000,
  });
}
