import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Produto, ProductCategory } from "@/types/product";

export type RadarSort = "recent" | "commission_desc" | "sales_desc" | "price_asc" | "price_desc";

export type RadarFilters = {
  search: string;
  categoryId: string;
  priceMin: number | null;
  priceMax: number | null;
  commissionMin: number | null;
  sort: RadarSort;
  page: number;
  pageSize: number;
};

export type RadarResult = {
  products: Produto[];
  total: number;
};

export function useProductRadar(filters: RadarFilters) {
  return useQuery({
    queryKey: ["product-radar", filters],
    queryFn: async (): Promise<RadarResult> => {
      const offset = (filters.page - 1) * filters.pageSize;
      const lastItem = offset + filters.pageSize - 1;

      let query = supabase
        .from("products")
        .select(
          "id,name,image_url,price,commission_amount,commission_percent,store_name,sales_count,creators_count,source,data_updated_at,categories(name,slug)",
          { count: "exact" },
        );

      const search = filters.search.trim();
      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      if (filters.categoryId) {
        query = query.eq("category_id", filters.categoryId);
      }

      if (filters.priceMin !== null) {
        query = query.gte("price", filters.priceMin);
      }

      if (filters.priceMax !== null) {
        query = query.lte("price", filters.priceMax);
      }

      if (filters.commissionMin !== null) {
        query = query.gte("commission_amount", filters.commissionMin);
      }

      if (filters.sort === "commission_desc") {
        query = query
          .order("commission_amount", { ascending: false, nullsFirst: false })
          .order("data_updated_at", { ascending: false });
      } else if (filters.sort === "sales_desc") {
        query = query
          .order("sales_count", { ascending: false, nullsFirst: false })
          .order("data_updated_at", { ascending: false });
      } else if (filters.sort === "price_asc") {
        query = query
          .order("price", { ascending: true, nullsFirst: false })
          .order("data_updated_at", { ascending: false });
      } else if (filters.sort === "price_desc") {
        query = query
          .order("price", { ascending: false, nullsFirst: false })
          .order("data_updated_at", { ascending: false });
      } else {
        query = query.order("data_updated_at", { ascending: false });
      }

      const { data, error, count } = await query.range(offset, lastItem);

      if (error) throw error;

      const products: Produto[] = (data ?? []).map((product) => {
        const rawCategory = product.categories as ProductCategory | ProductCategory[] | null;
        const category = Array.isArray(rawCategory) ? (rawCategory[0] ?? null) : rawCategory;

        return {
          ...product,
          categories: category,
        };
      });

      return {
        products,
        total: count ?? 0,
      };
    },
    placeholderData: (previous) => previous,
  });
}
