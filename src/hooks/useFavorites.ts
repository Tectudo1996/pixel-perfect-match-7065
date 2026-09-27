import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProductCategory, Produto } from "@/types/product";

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) return [];

      const { data, error } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", userData.user.id);

      if (error) throw error;
      return (data ?? []).map((favorite) => favorite.product_id);
    },
  });
}

export function useFavoriteProducts() {
  return useQuery({
    queryKey: ["favorite-products"],
    queryFn: async (): Promise<Produto[]> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) return [];

      const { data: favoriteRows, error: favoritesError } = await supabase
        .from("favorites")
        .select("product_id,created_at")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (favoritesError) throw favoritesError;

      const productIds = (favoriteRows ?? []).map((favorite) => favorite.product_id);
      if (!productIds.length) return [];

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select(
          "id,name,image_url,price,commission_amount,commission_percent,store_name,sales_count,creators_count,source,data_updated_at,categories(name,slug)",
        )
        .in("id", productIds);

      if (productsError) throw productsError;

      const productsById = new Map(
        (products ?? []).map((product) => {
          const rawCategory = product.categories as ProductCategory | ProductCategory[] | null;
          const category = Array.isArray(rawCategory) ? (rawCategory[0] ?? null) : rawCategory;

          const normalized: Produto = {
            ...product,
            categories: category,
          };

          return [normalized.id, normalized] as const;
        }),
      );

      return productIds
        .map((productId) => productsById.get(productId))
        .filter((product): product is Produto => Boolean(product));
    },
    staleTime: 30_000,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, active }: { productId: string; active: boolean }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const userId = userData.user?.id;
      if (!userId) throw new Error("Sua sessão expirou. Entre novamente.");

      if (active) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("product_id", productId)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ product_id: productId, user_id: userId });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    },
  });
}
