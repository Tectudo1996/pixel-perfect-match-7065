import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

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
