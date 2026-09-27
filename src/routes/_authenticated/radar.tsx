import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  FilterX,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { ProductCard, EmptyState, useFavorites } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/hooks/useAuth";
import { useProductRadar, type RadarSort } from "@/hooks/useProductRadar";

export const Route = createFileRoute("/_authenticated/radar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Radar de Produtos — RadarShop AI" },
      {
        name: "description",
        content: "Pesquise e filtre produtos cadastrados no RadarShop AI.",
      },
    ],
  }),
  component: ProductRadarPage,
});

const PAGE_SIZE = 20;

function ProductRadarPage() {
  const { data: categories = [] } = useCategories();
  const { data: favorites = [] } = useFavorites();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [commissionMin, setCommissionMin] = useState("");
  const [sort, setSort] = useState<RadarSort>("recent");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const numericFilters = useMemo(
    () => ({
      priceMin: parseCurrencyInput(priceMin),
      priceMax: parseCurrencyInput(priceMax),
      commissionMin: parseCurrencyInput(commissionMin),
    }),
    [priceMin, priceMax, commissionMin],
  );

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    categoryId,
    numericFilters.priceMin,
    numericFilters.priceMax,
    numericFilters.commissionMin,
    sort,
  ]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch,
      categoryId,
      priceMin: numericFilters.priceMin,
      priceMax: numericFilters.priceMax,
      commissionMin: numericFilters.commissionMin,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, categoryId, numericFilters, sort, page],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useProductRadar(filters);

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters =
    Boolean(debouncedSearch) ||
    Boolean(categoryId) ||
    numericFilters.priceMin !== null ||
    numericFilters.priceMax !== null ||
    numericFilters.commissionMin !== null ||
    sort !== "recent";

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCategoryId("");
    setPriceMin("");
    setPriceMax("");
    setCommissionMin("");
    setSort("recent");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <section>
        <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <PackageSearch className="h-3.5 w-3.5" /> Dados reais do catálogo
        </span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Radar de Produtos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Encontre produtos usando os dados atualmente disponíveis no banco. Nenhuma métrica é
          preenchida artificialmente quando a fonte não informou um valor.
        </p>
      </section>

      <section className="surface-card p-4 md:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative md:col-span-2 xl:col-span-2">
            <span className="sr-only">Buscar produto</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar pelo nome do produto..."
              className="pl-9"
            />
          </label>

          <label>
            <span className="sr-only">Categoria</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <Input
            value={priceMin}
            onChange={(event) => setPriceMin(event.target.value)}
            inputMode="decimal"
            placeholder="Preço mín. R$"
            aria-label="Preço mínimo"
          />

          <Input
            value={priceMax}
            onChange={(event) => setPriceMax(event.target.value)}
            inputMode="decimal"
            placeholder="Preço máx. R$"
            aria-label="Preço máximo"
          />

          <Input
            value={commissionMin}
            onChange={(event) => setCommissionMin(event.target.value)}
            inputMode="decimal"
            placeholder="Comissão mín. R$"
            aria-label="Comissão mínima"
          />
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as RadarSort)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            aria-label="Ordenar produtos"
          >
            <option value="recent">Atualizados recentemente</option>
            <option value="commission_desc">Maior comissão em R$</option>
            <option value="sales_desc">Mais vendas informadas</option>
            <option value="price_asc">Menor preço</option>
            <option value="price_desc">Maior preço</option>
          </select>

          {activeFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <FilterX className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {isLoading ? "Carregando produtos..." : formatResultCount(total)}
            </p>
            <p className="text-xs text-muted-foreground">
              Página {Math.min(page, totalPages)} de {totalPages}
            </p>
          </div>
          {isFetching && !isLoading && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Atualizando resultados
            </span>
          )}
        </div>

        {isError ? (
          <div className="surface-card flex flex-col items-center justify-center p-10 text-center">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <h2 className="mt-3 text-sm font-semibold">Não foi possível consultar o Radar</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Tente novamente em alguns instantes."}
            </p>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : isLoading ? (
          <ProductGridSkeleton />
        ) : products.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  produto={product}
                  favorito={favorites.includes(product.id)}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <EmptyState
            titulo={activeFilters ? "Nenhum produto encontrado" : "O catálogo ainda está vazio"}
            texto={
              activeFilters
                ? "Tente remover algum filtro ou buscar por outro nome."
                : "Quando produtos reais forem cadastrados ou importados, eles aparecerão aqui."
            }
          />
        )}
      </section>
    </div>
  );
}

function parseCurrencyInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;

  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function formatResultCount(total: number) {
  if (total === 1) return "1 produto encontrado";
  return `${total.toLocaleString("pt-BR")} produtos encontrados`;
}

function ProductGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="surface-card overflow-hidden">
          <div className="h-40 animate-pulse bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
