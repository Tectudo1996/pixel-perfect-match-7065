import { useQuery } from "@tanstack/react-query";
import { cloudClient as supabase } from "@/lib/cloud-client";
import type { ProductCategory, Produto } from "@/types/product";

export type PersonalRadarResult = {
  products: Produto[];
  total: number;
  categoryNames: string[];
  commissionMin: number | null;
  commissionMax: number | null;
  goal: string | null;
  videoStyle: string | null;
  rules: string[];
};

export function usePersonalRadar() {
  return useQuery({
    queryKey: ["personal-radar"],
    queryFn: async (): Promise<PersonalRadarResult> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Sua sessão expirou. Entre novamente.");

      const { data: preferences, error: preferencesError } = await supabase
        .from("user_preferences")
        .select("categories,commission_min,commission_max,goal,video_style,onboarding_completed")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (preferencesError) throw preferencesError;
      if (!preferences?.onboarding_completed) {
        throw new Error("Conclua o onboarding para personalizar o seu Radar.");
      }

      const selectedSlugs = preferences.categories ?? [];
      let categoryIds: string[] = [];
      let categoryNames: string[] = [];

      if (selectedSlugs.length) {
        const { data: categories, error: categoriesError } = await supabase
          .from("categories")
          .select("id,name,slug")
          .in("slug", selectedSlugs);

        if (categoriesError) throw categoriesError;

        categoryIds = (categories ?? []).map((category) => category.id);
        categoryNames = (categories ?? []).map((category) => category.name);

        if (!categoryIds.length) {
          return {
            products: [],
            total: 0,
            categoryNames: [],
            commissionMin: preferences.commission_min,
            commissionMax: preferences.commission_max,
            goal: preferences.goal,
            videoStyle: preferences.video_style,
            rules: ["Nenhuma categoria configurada foi encontrada no catálogo atual."],
          };
        }
      }

      let query = supabase
        .from("products")
        .select(
          "id,name,image_url,price,commission_amount,commission_percent,store_name,sales_count,creators_count,source,data_updated_at,categories(name,slug)",
          { count: "exact" },
        );

      if (categoryIds.length) {
        query = query.in("category_id", categoryIds);
      }

      if (preferences.commission_min !== null) {
        query = query.gte("commission_amount", preferences.commission_min);
      }

      if (preferences.commission_max !== null) {
        query = query.lte("commission_amount", preferences.commission_max);
      }

      if (preferences.goal === "maior_comissao") {
        query = query
          .order("commission_amount", { ascending: false, nullsFirst: false })
          .order("data_updated_at", { ascending: false });
      } else if (preferences.goal === "novos_produtos") {
        query = query
          .order("identified_at", { ascending: false })
          .order("data_updated_at", { ascending: false });
      } else if (preferences.goal === "aumentar_vendas") {
        query = query
          .order("sales_count", { ascending: false, nullsFirst: false })
          .order("data_updated_at", { ascending: false });
      } else {
        query = query.order("data_updated_at", { ascending: false });
      }

      const { data, error, count } = await query.limit(24);
      if (error) throw error;

      const products: Produto[] = (data ?? []).map((product) => {
        const rawCategory = product.categories as ProductCategory | ProductCategory[] | null;
        const category = Array.isArray(rawCategory) ? (rawCategory[0] ?? null) : rawCategory;

        return {
          ...product,
          categories: category,
        };
      });

      const rules: string[] = [];

      if (categoryNames.length) {
        rules.push(`Categorias: ${categoryNames.join(", ")}`);
      }

      if (preferences.commission_min !== null && preferences.commission_max !== null) {
        rules.push(
          `Comissão entre R$ ${preferences.commission_min.toFixed(2)} e R$ ${preferences.commission_max.toFixed(2)}`,
        );
      } else if (preferences.commission_min !== null) {
        rules.push(`Comissão a partir de R$ ${preferences.commission_min.toFixed(2)}`);
      } else if (preferences.commission_max !== null) {
        rules.push(`Comissão até R$ ${preferences.commission_max.toFixed(2)}`);
      }

      if (preferences.goal === "maior_comissao") {
        rules.push("Ordenação: maiores comissões disponíveis primeiro");
      } else if (preferences.goal === "novos_produtos") {
        rules.push("Ordenação: produtos identificados mais recentemente primeiro");
      } else if (preferences.goal === "aumentar_vendas") {
        rules.push("Ordenação: maior número de vendas informadas primeiro");
      } else {
        rules.push("Ordenação: produtos atualizados recentemente");
      }

      return {
        products,
        total: count ?? 0,
        categoryNames,
        commissionMin: preferences.commission_min,
        commissionMax: preferences.commission_max,
        goal: preferences.goal,
        videoStyle: preferences.video_style,
        rules,
      };
    },
    staleTime: 30_000,
  });
}
