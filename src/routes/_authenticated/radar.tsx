import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Loader2,
  PackageSearch,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { ProductCard, EmptyState } from "@/components/product-card";
import { TikTokOpportunityCard } from "@/components/tiktok-opportunity-card";
import { useFavorites } from "@/hooks/useFavorites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/hooks/useAuth";
import { useProductRadar, type RadarSort } from "@/hooks/useProductRadar";
import {
  type TikTokDiscoveryResult,
  useSearchTikTokOpportunities,
  useTikTokShopConnection,
  useTikTokTrackedOpportunities,
  useTrackTikTokOpportunity,
  useUntrackTikTokOpportunity,
} from "@/hooks/useTikTokShop";

export const Route = createFileRoute("/_authenticated/radar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Radar de Produtos — RadarShop AI" },
      {
        name: "description",
        content:
          "Busque oportunidades oficiais do TikTok Shop ou consulte o catálogo importado do RadarShop AI.",
      },
    ],
  }),
  component: ProductRadarPage,
});

const PAGE_SIZE = 20;

type RadarSource = "tiktok" | "catalog";

function ProductRadarPage() {
  const [source, setSource] = useState<RadarSource>("tiktok");

  return (
    <div className="space-y-6">
      <section>
        <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <PackageSearch className="h-3.5 w-3.5" /> Descoberta com fonte identificada
        </span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Radar de Produtos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Consulte oportunidades oficiais disponíveis para a sua conta Creator ou use o catálogo
          administrado do RadarShop. As duas fontes permanecem separadas.
        </p>
      </section>

      <section className="surface-card p-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant={source === "tiktok" ? "gold" : "ghost"}
            className="justify-center"
            onClick={() => setSource("tiktok")}
          >
            <BadgeCheck className="h-4 w-4" />
            TikTok Shop oficial
          </Button>
          <Button
            type="button"
            variant={source === "catalog" ? "gold" : "ghost"}
            className="justify-center"
            onClick={() => setSource("catalog")}
          >
            <PackageSearch className="h-4 w-4" />
            Catálogo RadarShop
          </Button>
        </div>
      </section>

      {source === "tiktok" ? <OfficialTikTokRadar /> : <CatalogRadar />}
    </div>
  );
}

function OfficialTikTokRadar() {
  const {
    data: connection,
    isLoading: loadingConnection,
    isError: connectionError,
    error: connectionErrorDetail,
  } = useTikTokShopConnection();
  const discovery = useSearchTikTokOpportunities();
  const trackedTikTok = useTikTokTrackedOpportunities();
  const trackTikTok = useTrackTikTokOpportunity();
  const untrackTikTok = useUntrackTikTokOpportunity();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"commission" | "sales">("commission");
  const [result, setResult] = useState<TikTokDiscoveryResult | null>(null);
  const [activeSearch, setActiveSearch] = useState("");
  const [activeSort, setActiveSort] = useState<"commission" | "sales">("commission");
  const [loadingMore, setLoadingMore] = useState(false);

  const connected = connection?.connected === true;
  const trackedProducts = trackedTikTok.data?.products ?? [];
  const trackedIds = useMemo(
    () => new Set(trackedProducts.map((product) => product.id)),
    [trackedProducts],
  );

  async function searchOpportunities() {
    const normalizedSearch = search.trim();

    try {
      const next = await discovery.mutateAsync({
        ...(normalizedSearch ? { search: normalizedSearch } : {}),
        sort,
      });

      setActiveSearch(normalizedSearch);
      setActiveSort(sort);
      setResult(next);
    } catch {
      // A mutation já mantém o erro normalizado para a interface.
    }
  }

  async function loadMoreOpportunities() {
    const pageToken = result?.nextPageToken;
    if (!pageToken || loadingMore || discovery.isPending) return;

    setLoadingMore(true);

    try {
      const next = await discovery.mutateAsync({
        ...(activeSearch ? { search: activeSearch } : {}),
        sort: activeSort,
        pageToken,
      });

      setResult((current) => {
        if (!current) return next;

        const products = new Map(current.products.map((product) => [product.id, product]));
        for (const product of next.products) products.set(product.id, product);

        return {
          products: Array.from(products.values()),
          nextPageToken: next.nextPageToken,
          total: next.total || current.total,
        };
      });
    } catch {
      // A mutation já mantém o erro normalizado para a interface.
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleTrack(productId: string) {
    try {
      await trackTikTok.mutateAsync(productId);
      toast.success("Oportunidade adicionada ao acompanhamento.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível acompanhar essa oportunidade.",
      );
    }
  }

  async function handleUntrack(productId: string) {
    try {
      await untrackTikTok.mutateAsync(productId);
      toast.success("Oportunidade removida do acompanhamento.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível remover essa oportunidade.",
      );
    }
  }

  if (loadingConnection) {
    return (
      <section className="surface-card flex min-h-64 items-center justify-center p-6">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verificando conexão com TikTok Shop
        </span>
      </section>
    );
  }

  if (connectionError) {
    return (
      <section className="surface-card p-6">
        <h2 className="text-base font-semibold">TikTok Shop ainda não está disponível</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {connectionErrorDetail instanceof Error
            ? connectionErrorDetail.message
            : "Conclua a configuração segura do conector antes de usar a busca oficial."}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/configuracoes">Abrir Configurações</Link>
        </Button>
      </section>
    );
  }

  if (!connected) {
    const detail = !connection?.enabled
      ? "O conector oficial está preparado, mas permanece desligado até a liberação do aplicativo no TikTok Shop Partner Center."
      : !connection.configured
        ? "O conector foi habilitado, mas as credenciais seguras do servidor ainda não estão completas."
        : "Conecte sua conta Creator para consultar as colaborações abertas disponíveis para ela.";

    return (
      <section className="surface-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" />
              <h2 className="text-base font-semibold">TikTok Shop oficial</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{detail}</p>
          </div>
          <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase">
            não conectado
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="gold" size="sm">
            <Link to="/configuracoes">Conectar TikTok Shop</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="surface-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" />
            <h2 className="text-base font-semibold">Oportunidades oficiais do TikTok Shop</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A busca usa a autorização da sua própria conta Creator. Os resultados são privados e
            não são copiados para o catálogo global.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase">
            creator conectado
          </span>
          {trackedProducts.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/meu-radar">
                {trackedProducts.length.toLocaleString("pt-BR")} acompanhadas
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void searchOpportunities();
          }}
          maxLength={255}
          placeholder="Ex.: vestido, skincare, cozinha..."
          aria-label="Buscar oportunidades no TikTok Shop"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as "commission" | "sales")}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Ordenar oportunidades TikTok"
        >
          <option value="commission">Maior comissão</option>
          <option value="sales">Mais vendidos</option>
        </select>
        <Button
          type="button"
          variant="gold"
          disabled={discovery.isPending && !loadingMore}
          onClick={() => void searchOpportunities()}
        >
          {discovery.isPending && !loadingMore ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Buscar
        </Button>
      </div>

      {discovery.isError && (
        <p className="mt-4 rounded-md border border-border bg-secondary/20 p-3 text-sm text-muted-foreground">
          {discovery.error instanceof Error
            ? discovery.error.message
            : "Não foi possível consultar o TikTok Shop."}
        </p>
      )}

      {!result ? (
        <div className="mt-5 rounded-lg border border-dashed border-border p-6 text-center">
          <Search className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Faça uma busca no TikTok Shop</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Você pode buscar por nome ou deixar o campo vazio para consultar oportunidades
            disponíveis para a sua conta.
          </p>
        </div>
      ) : result.products.length ? (
        <div className="mt-5">
          <p className="mb-3 text-xs text-muted-foreground">
            {result.total.toLocaleString("pt-BR")} oportunidades encontradas pela API · exibindo{" "}
            {result.products.length}
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {result.products.map((product) => {
              const tracked = trackedIds.has(product.id);

              return (
                <TikTokOpportunityCard
                  key={product.id}
                  product={product}
                  tracked={tracked}
                  tracking={trackTikTok.isPending && trackTikTok.variables === product.id}
                  untracking={untrackTikTok.isPending && untrackTikTok.variables === product.id}
                  onTrack={tracked ? undefined : () => void handleTrack(product.id)}
                  onUntrack={tracked ? () => void handleUntrack(product.id) : undefined}
                />
              );
            })}
          </div>

          {result.nextPageToken && (
            <div className="mt-5 flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore || discovery.isPending}
                onClick={() => void loadMoreOpportunities()}
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Carregar mais oportunidades
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-border p-4 text-sm text-muted-foreground">
          Nenhuma oportunidade foi encontrada com esses critérios.
        </p>
      )}
    </section>
  );
}

function CatalogRadar() {
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
    <>
      <section className="surface-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros do catálogo
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Produtos cadastrados, importados ou recebidos por fontes autorizadas pela operação.
            </p>
          </div>
          <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase">
            catálogo global
          </span>
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
            <h2 className="mt-3 text-sm font-semibold">Não foi possível consultar o catálogo</h2>
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
                : "Use a aba TikTok Shop oficial para consultar oportunidades da sua conta Creator enquanto o catálogo global é alimentado por fontes autorizadas."
            }
          />
        )}
      </section>
    </>
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
