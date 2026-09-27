import { createFileRoute } from "@tanstack/react-router";
import { Heart, Loader2, RefreshCw } from "lucide-react";
import { ProductCard, EmptyState } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { useFavoriteProducts, useFavorites } from "@/hooks/useFavorites";

export const Route = createFileRoute("/_authenticated/favoritos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Favoritos — RadarShop AI" },
      {
        name: "description",
        content: "Produtos que você salvou no RadarShop AI.",
      },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { data: favoriteIds = [] } = useFavorites();
  const {
    data: products = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useFavoriteProducts();

  return (
    <div className="space-y-6">
      <section>
        <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <Heart className="h-3.5 w-3.5" /> Sua seleção
        </span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Favoritos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Produtos salvos na sua conta para você revisar depois.
        </p>
      </section>

      {isError ? (
        <div className="surface-card flex flex-col items-center justify-center p-10 text-center">
          <RefreshCw className="h-5 w-5 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold">Não foi possível carregar seus favoritos</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Tente novamente em alguns instantes."}
          </p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => void refetch()}>
            {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="surface-card h-80 animate-pulse bg-muted" />
          ))}
        </div>
      ) : products.length ? (
        <>
          <p className="text-sm font-semibold">
            {products.length === 1
              ? "1 produto salvo"
              : `${products.length.toLocaleString("pt-BR")} produtos salvos`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                produto={product}
                favorito={favoriteIds.includes(product.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          titulo="Você ainda não favoritou nenhum produto"
          texto="Use o coração nos cards do Radar para montar sua lista de produtos para revisar depois."
        />
      )}
    </div>
  );
}
