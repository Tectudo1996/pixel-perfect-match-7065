import { Link } from "@tanstack/react-router";
import { Heart, ImageOff } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, percent, NA } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Produto = {
  id: string;
  name: string;
  image_url: string | null;
  price: number | null;
  commission_amount: number | null;
  commission_percent: number | null;
  store_name: string | null;
  categories?: { name: string } | null;
};

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("product_id");
      return (data ?? []).map((f) => f.product_id);
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, ativo }: { productId: string; ativo: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      if (ativo) {
        await supabase.from("favorites").delete().eq("product_id", productId).eq("user_id", userId);
      } else {
        await supabase.from("favorites").insert({ product_id: productId, user_id: userId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-products"] });
    },
  });
}

export function ProductCard({ produto, favorito }: { produto: Produto; favorito: boolean }) {
  const toggle = useToggleFavorite();

  return (
    <div className="surface-card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <button
        onClick={() => toggle.mutate({ productId: produto.id, ativo: favorito })}
        aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className="absolute top-2 right-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-surface/90"
      >
        <Heart className={cn("h-4 w-4", favorito && "fill-gold text-gold")} />
      </button>
      <Link to="/produto/$id" params={{ id: produto.id }} className="flex flex-1 flex-col">
        <div className="flex h-36 items-center justify-center overflow-hidden border-b border-border bg-muted">
          {produto.image_url ? (
            <img src={produto.image_url} alt={produto.name} className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          {produto.categories?.name && (
            <span className="gold-chip w-fit rounded-full px-2 py-0.5 text-[11px] font-medium">
              {produto.categories.name}
            </span>
          )}
          <h3 className="line-clamp-2 text-sm font-semibold">{produto.name}</h3>
          <div className="mt-auto space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Preço</span>
              <span className="font-medium text-foreground">{brl(produto.price) ?? NA}</span>
            </div>
            <div className="flex justify-between">
              <span>Comissão</span>
              <span className="font-medium text-foreground">
                {brl(produto.commission_amount) ?? percent(produto.commission_percent) ?? NA}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

export function EmptyState({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="surface-card flex flex-col items-center justify-center p-10 text-center">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
