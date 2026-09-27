import { useQuery } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type DashboardProduct = {
  id: string;
  name: string;
  image_url: string | null;
  price: number | null;
  commission_amount: number | null;
  commission_percent: number | null;
  store_name: string | null;
  data_updated_at: string;
};

export type DashboardOverview = {
  productsCount: number;
  favoritesCount: number;
  projectsCount: number;
  recentProducts: DashboardProduct[];
};

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async (): Promise<DashboardOverview> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!userData.user) throw new Error("Sua sessão expirou. Entre novamente.");

      const userId = userData.user.id;

      const [products, favorites, projects, recentProducts] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase
          .from("favorites")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("content_projects")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("products")
          .select(
            "id,name,image_url,price,commission_amount,commission_percent,store_name,data_updated_at",
          )
          .order("data_updated_at", { ascending: false })
          .limit(4),
      ]);

      const errors = [products.error, favorites.error, projects.error, recentProducts.error].filter(
        Boolean,
      );

      if (errors.length) {
        throw errors[0];
      }

      return {
        productsCount: products.count ?? 0,
        favoritesCount: favorites.count ?? 0,
        projectsCount: projects.count ?? 0,
        recentProducts: recentProducts.data ?? [],
      };
    },
    staleTime: 30_000,
  });
}
