import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BookmarkCheck,
  BookmarkPlus,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { EmptyState, ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFavorites } from "@/hooks/useFavorites";
import { usePersonalRadar } from "@/hooks/usePersonalRadar";
import {
  type TikTokCreatorOpportunity,
  type TikTokDiscoveryResult,
  type TikTokOpportunityHistory,
  type TikTokTrackedOpportunity,
  useRefreshTikTokTrackedOpportunities,
  useTikTokOpportunityHistory,
  useSearchTikTokOpportunities,
  useTikTokShopConnection,
  useTikTokTrackedOpportunities,
  useTrackTikTokOpportunity,
  useUntrackTikTokOpportunity,
} from "@/hooks/useTikTokShop";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/meu-radar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu Radar — RadarShop AI" },
      {
        name: "description",
        content: "Produtos filtrados pelas suas preferências no RadarShop AI.",
      },
    ],
  }),
  component: PersonalRadarPage,
});

const goalLabels: Record<string, string> = {
  primeira_venda: "Fazer a primeira venda",
  aumentar_vendas: "Aumentar vendas",
  novos_produtos: "Encontrar produtos novos",
  maior_comissao: "Buscar comissões melhores",
};

const videoStyleLabels: Record<string, string> = {
  aparecer: "Aparecendo nos vídeos",
  sem_aparecer: "Sem aparecer",
  ia: "Conteúdo com IA",
  ainda_nao_sei: "Ainda não definido",
};

function PersonalRadarPage() {
  const { data: favorites = [] } = useFavorites();
  const { data, isLoading, isError, error, refetch, isFetching } = usePersonalRadar();
  const { data: tiktokShop, isLoading: loadingTikTokShop } = useTikTokShopConnection();
  const tiktokDiscovery = useSearchTikTokOpportunities();
  const trackedTikTok = useTikTokTrackedOpportunities();
  const trackTikTok = useTrackTikTokOpportunity();
  const untrackTikTok = useUntrackTikTokOpportunity();
  const refreshTrackedTikTok = useRefreshTikTokTrackedOpportunities();
  const [selectedHistoryProduct, setSelectedHistoryProduct] =
    useState<TikTokTrackedOpportunity | null>(null);
  const tiktokHistory = useTikTokOpportunityHistory(selectedHistoryProduct?.id ?? null);
  const [tiktokSearch, setTikTokSearch] = useState("");
  const [tiktokSort, setTikTokSort] = useState<"commission" | "sales">("commission");
  const [tiktokResult, setTikTokResult] = useState<TikTokDiscoveryResult | null>(null);
  const [tiktokActiveSearch, setTikTokActiveSearch] = useState("");
  const [tiktokActiveSort, setTikTokActiveSort] = useState<"commission" | "sales">("commission");
  const [loadingMoreTikTok, setLoadingMoreTikTok] = useState(false);

  async function searchTikTokOpportunities() {
    const search = tiktokSearch.trim();

    try {
      const result = await tiktokDiscovery.mutateAsync({
        ...(search ? { search } : {}),
        sort: tiktokSort,
      });

      setTikTokActiveSearch(search);
      setTikTokActiveSort(tiktokSort);
      setTikTokResult(result);
    } catch {
      // The mutation already exposes the normalized error to the UI.
    }
  }

  async function handleTrackTikTokOpportunity(productId: string) {
    try {
      await trackTikTok.mutateAsync(productId);
      toast.success("Oportunidade adicionada ao acompanhamento.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível acompanhar essa oportunidade.",
      );
    }
  }

  async function handleUntrackTikTokOpportunity(productId: string) {
    try {
      await untrackTikTok.mutateAsync(productId);
      toast.success("Oportunidade removida do acompanhamento.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível remover essa oportunidade.",
      );
    }
  }

  async function handleRefreshTrackedTikTok() {
    try {
      const result = await refreshTrackedTikTok.mutateAsync();
      const skipped = result.skipped ? ` · ${result.skipped} indisponíveis` : "";
      toast.success(`Acompanhamento atualizado: ${result.updated} produtos${skipped}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível atualizar o acompanhamento.",
      );
    }
  }

  async function loadMoreTikTokOpportunities() {
    const pageToken = tiktokResult?.nextPageToken;
    if (!pageToken || loadingMoreTikTok || tiktokDiscovery.isPending) return;

    setLoadingMoreTikTok(true);

    try {
      const next = await tiktokDiscovery.mutateAsync({
        ...(tiktokActiveSearch ? { search: tiktokActiveSearch } : {}),
        sort: tiktokActiveSort,
        pageToken,
      });

      setTikTokResult((current) => {
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
      // The mutation already exposes the normalized error to the UI.
    } finally {
      setLoadingMoreTikTok(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" /> Personalizado pelas suas preferências
        </span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Meu Radar</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Esta seleção usa regras objetivas do seu onboarding. O sistema mostra os critérios
          aplicados para você saber por que cada produto entrou no resultado.
        </p>
      </section>

      {isError ? (
        <section className="surface-card flex flex-col items-center justify-center p-10 text-center">
          <RefreshCw className="h-5 w-5 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold">Não foi possível montar o seu Radar</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Tente novamente em alguns instantes."}
          </p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => void refetch()}>
            {isFetching && <RefreshCw className="h-4 w-4 animate-spin" />}
            Tentar novamente
          </Button>
        </section>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="surface-card p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <h2 className="text-base font-semibold">Critérios aplicados</h2>
              </div>

              {isLoading ? (
                <div className="mt-4 space-y-2">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-9 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(data?.rules ?? []).map((rule) => (
                    <span
                      key={rule}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs"
                    >
                      {rule}
                    </span>
                  ))}
                </div>
              )}

              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Nenhum “score de venda” é criado artificialmente. O Meu Radar filtra e ordena apenas
                por campos existentes no banco.
              </p>
            </div>

            <div className="surface-card p-5">
              <div className="flex items-center gap-2">
                <WandSparkles className="h-4 w-4" />
                <h2 className="text-base font-semibold">Preferência de conteúdo</h2>
              </div>
              <p className="mt-3 text-sm font-medium">
                {data?.videoStyle
                  ? videoStyleLabels[data.videoStyle] || "Preferência configurada"
                  : "Não informada"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Esta preferência não altera a seleção de produtos porque o catálogo ainda não possui
                um dado confiável de compatibilidade criativa. Ela será usada no Estúdio de
                Conteúdo.
              </p>
              <Link
                to="/configuracoes"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Ajustar preferências
              </Link>
            </div>
          </section>

          <TikTokOpportunitiesSection
            connection={tiktokShop}
            loadingConnection={loadingTikTokShop}
            search={tiktokSearch}
            sort={tiktokSort}
            result={tiktokResult}
            searching={tiktokDiscovery.isPending && !loadingMoreTikTok}
            loadingMore={loadingMoreTikTok}
            error={tiktokDiscovery.isError ? tiktokDiscovery.error : null}
            trackedProducts={trackedTikTok.data?.products ?? []}
            trackedLoading={trackedTikTok.isLoading}
            trackedError={trackedTikTok.isError ? trackedTikTok.error : null}
            trackingProductId={trackTikTok.isPending ? (trackTikTok.variables ?? null) : null}
            untrackingProductId={untrackTikTok.isPending ? (untrackTikTok.variables ?? null) : null}
            refreshingTracked={refreshTrackedTikTok.isPending}
            onSearchChange={setTikTokSearch}
            onSortChange={setTikTokSort}
            onSearch={() => void searchTikTokOpportunities()}
            onLoadMore={() => void loadMoreTikTokOpportunities()}
            onTrack={(productId) => void handleTrackTikTokOpportunity(productId)}
            onUntrack={(productId) => void handleUntrackTikTokOpportunity(productId)}
            onRefreshTracked={() => void handleRefreshTrackedTikTok()}
            onOpenHistory={setSelectedHistoryProduct}
          />

          <TikTokHistoryDialog
            product={selectedHistoryProduct}
            history={tiktokHistory.data ?? null}
            loading={tiktokHistory.isLoading || tiktokHistory.isFetching}
            error={tiktokHistory.isError ? tiktokHistory.error : null}
            onOpenChange={(open) => {
              if (!open) setSelectedHistoryProduct(null);
            }}
          />

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Produtos compatíveis com seus filtros</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isLoading ? "Consultando o catálogo..." : formatResultCount(data?.total ?? 0)}
                </p>
              </div>
              {!isLoading && data?.goal && (
                <span className="text-xs text-muted-foreground">
                  Objetivo: {goalLabels[data.goal] || "Personalizado"}
                </span>
              )}
            </div>

            {isLoading ? (
              <PersonalRadarSkeleton />
            ) : data?.products.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {data.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    produto={product}
                    favorito={favorites.includes(product.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                titulo="Nenhum produto atende às suas preferências atuais"
                texto="Isso não significa que o catálogo está vazio. Abra o Radar completo ou ajuste suas preferências para ampliar a seleção."
              />
            )}

            {!isLoading && !data?.products.length && (
              <div className="mt-4 flex justify-center gap-2">
                <Button asChild variant="outline">
                  <Link to="/radar">Abrir Radar completo</Link>
                </Button>
                <Button asChild variant="gold">
                  <Link to="/configuracoes">Ajustar preferências</Link>
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function TikTokOpportunitiesSection({
  connection,
  loadingConnection,
  search,
  sort,
  result,
  searching,
  loadingMore,
  error,
  trackedProducts,
  trackedLoading,
  trackedError,
  trackingProductId,
  untrackingProductId,
  refreshingTracked,
  onSearchChange,
  onSortChange,
  onSearch,
  onLoadMore,
  onTrack,
  onUntrack,
  onRefreshTracked,
  onOpenHistory,
}: {
  connection: ReturnType<typeof useTikTokShopConnection>["data"];
  loadingConnection: boolean;
  search: string;
  sort: "commission" | "sales";
  result: TikTokDiscoveryResult | null;
  searching: boolean;
  loadingMore: boolean;
  error: unknown;
  trackedProducts: TikTokTrackedOpportunity[];
  trackedLoading: boolean;
  trackedError: unknown;
  trackingProductId: string | null;
  untrackingProductId: string | null;
  refreshingTracked: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: "commission" | "sales") => void;
  onSearch: () => void;
  onLoadMore: () => void;
  onTrack: (productId: string) => void;
  onUntrack: (productId: string) => void;
  onRefreshTracked: () => void;
  onOpenHistory: (product: TikTokTrackedOpportunity) => void;
}) {
  const connected = connection?.connected === true;

  return (
    <section className="surface-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <h2 className="text-base font-semibold">Oportunidades oficiais do TikTok Shop</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Consulte colaborações abertas disponíveis para a sua conta Creator. Esses resultados são
            pessoais e não entram no catálogo global do RadarShop.
          </p>
        </div>
        <span className="rounded-full border border-border px-2 py-1 text-[10px] uppercase">
          {loadingConnection ? "verificando" : connected ? "creator conectado" : "não conectado"}
        </span>
      </div>

      {!loadingConnection && !connected ? (
        <div className="mt-4 rounded-lg border border-border bg-secondary/20 p-4">
          <p className="text-sm text-muted-foreground">
            Conecte o TikTok Shop em Configurações para buscar oportunidades oficiais.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/configuracoes">Abrir Configurações</Link>
          </Button>
        </div>
      ) : connected ? (
        <>
          <TikTokTrackedSection
            products={trackedProducts}
            loading={trackedLoading}
            error={trackedError}
            refreshing={refreshingTracked}
            untrackingProductId={untrackingProductId}
            onRefresh={onRefreshTracked}
            onUntrack={onUntrack}
            onOpenHistory={onOpenHistory}
          />

          <div className="mt-5 border-t border-border pt-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Buscar novas oportunidades
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearch();
              }}
              maxLength={255}
              placeholder="Ex.: vestido, skincare, cozinha..."
              aria-label="Buscar oportunidades no TikTok Shop"
            />
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as "commission" | "sales")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Ordenar oportunidades TikTok"
            >
              <option value="commission">Maior comissão</option>
              <option value="sales">Mais vendidos</option>
            </select>
            <Button type="button" variant="gold" disabled={searching} onClick={onSearch}>
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Buscar
            </Button>
          </div>

          {error && (
            <p className="mt-4 rounded-md border border-border bg-secondary/20 p-3 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Não foi possível consultar o TikTok Shop."}
            </p>
          )}

          {result && (
            <div className="mt-5">
              <p className="mb-3 text-xs text-muted-foreground">
                {result.total.toLocaleString("pt-BR")} oportunidades encontradas pela API · exibindo{" "}
                {result.products.length}
              </p>

              {result.products.length ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    {result.products.map((product) => {
                      const tracked = trackedProducts.some((item) => item.id === product.id);

                      return (
                        <TikTokOpportunityCard
                          key={product.id}
                          product={product}
                          tracked={tracked}
                          tracking={trackingProductId === product.id}
                          untracking={untrackingProductId === product.id}
                          onTrack={() => onTrack(product.id)}
                          onUntrack={() => onUntrack(product.id)}
                        />
                      );
                    })}
                  </div>

                  {result.nextPageToken && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={loadingMore || searching}
                        onClick={onLoadMore}
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
                </>
              ) : (
                <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  Nenhuma oportunidade encontrada com esses critérios.
                </p>
              )}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function TikTokTrackedSection({
  products,
  loading,
  error,
  refreshing,
  untrackingProductId,
  onRefresh,
  onUntrack,
  onOpenHistory,
}: {
  products: TikTokTrackedOpportunity[];
  loading: boolean;
  error: unknown;
  refreshing: boolean;
  untrackingProductId: string | null;
  onRefresh: () => void;
  onUntrack: (productId: string) => void;
  onOpenHistory: (product: TikTokTrackedOpportunity) => void;
}) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-secondary/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Oportunidades acompanhadas</h3>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            O RadarShop guarda leituras privadas da sua conta para comparar vendas, comissão e preço
            entre atualizações. Não é uma previsão de venda.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing || loading || products.length === 0}
          onClick={onRefresh}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar acompanhamento
        </Button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando acompanhamento...</p>
      ) : error ? (
        <p className="mt-4 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Não foi possível carregar o acompanhamento."}
        </p>
      ) : products.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {products.map((product) => (
            <div key={product.id}>
              <TikTokOpportunityCard
                product={product}
                tracked
                untracking={untrackingProductId === product.id}
                onUntrack={() => onUntrack(product.id)}
              />
              <div className="flex flex-wrap items-center gap-2 rounded-b-lg border border-t-0 border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
                <span className="min-w-0 flex-1">
                  {formatTrackedChanges(product)} · última leitura{" "}
                  {formatTrackedDate(product.lastCheckedAt)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onOpenHistory(product)}
                >
                  <History className="h-3.5 w-3.5" />
                  Ver trajetória
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Você ainda não acompanha nenhuma oportunidade. Faça uma busca abaixo e toque em
          <strong> Acompanhar</strong>.
        </p>
      )}
    </div>
  );
}

function TikTokHistoryDialog({
  product,
  history,
  loading,
  error,
  onOpenChange,
}: {
  product: TikTokTrackedOpportunity | null;
  history: TikTokOpportunityHistory | null;
  loading: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
}) {
  const readings = history?.readings ?? [];
  const first = readings[0] ?? null;
  const latest = readings[readings.length - 1] ?? null;

  return (
    <Dialog open={Boolean(product)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trajetória da oportunidade</DialogTitle>
          <DialogDescription>
            {product?.title ??
              "Histórico privado das leituras feitas pelo RadarShop na sua conta Creator."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando leituras...
          </div>
        ) : error ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Não foi possível carregar o histórico."}
          </p>
        ) : history && readings.length ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HistorySummary
                label="Leituras registradas"
                value={history.totalReadings.toLocaleString("pt-BR")}
              />
              <HistorySummary
                label="Vendas na janela"
                value={formatHistoryNumberDelta(first?.unitsSold ?? null, latest?.unitsSold ?? null)}
              />
              <HistorySummary
                label="Comissão na janela"
                value={formatHistoryPercentDelta(
                  first?.commissionPercent ?? null,
                  latest?.commissionPercent ?? null,
                )}
              />
              <HistorySummary
                label="Preço mínimo na janela"
                value={formatHistoryMoneyDelta(
                  first?.minimumPrice ?? null,
                  latest?.minimumPrice ?? null,
                  latest?.currency ?? first?.currency ?? null,
                )}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Leituras observadas</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Comparações são feitas apenas com dados realmente retornados pela API oficial.
                  </p>
                </div>
                {history.totalReadings > readings.length && (
                  <span className="text-xs text-muted-foreground">
                    Exibindo as {readings.length} leituras mais recentes
                  </span>
                )}
              </div>

              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                {[...readings].reverse().map((reading) => (
                  <div
                    key={reading.recordedAt}
                    className="grid gap-2 border-b border-border px-3 py-3 text-xs last:border-b-0 sm:grid-cols-[150px_1fr_1fr_1fr]"
                  >
                    <div>
                      <p className="font-medium">{formatTrackedDate(reading.recordedAt)}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {reading.hasInventory === null
                          ? "estoque não informado"
                          : reading.hasInventory
                            ? "com estoque"
                            : "sem estoque"}
                      </p>
                    </div>
                    <Metric
                      label="Vendas"
                      value={
                        reading.unitsSold === null
                          ? "—"
                          : reading.unitsSold.toLocaleString("pt-BR")
                      }
                    />
                    <Metric
                      label="Comissão"
                      value={formatHistoryCommission(reading)}
                    />
                    <Metric
                      label="Preço"
                      value={formatHistoryPrice(reading)}
                    />
                  </div>
                ))}
              </div>

              {readings.length === 1 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Há apenas uma leitura. Atualize o acompanhamento em outro momento para começar a
                  formar a trajetória.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            Ainda não há leituras históricas para esta oportunidade.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistorySummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/10 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function TikTokOpportunityCard({
  product,
  tracked = false,
  tracking = false,
  untracking = false,
  onTrack,
  onUntrack,
}: {
  product: TikTokCreatorOpportunity;
  tracked?: boolean;
  tracking?: boolean;
  untracking?: boolean;
  onTrack?: () => void;
  onUntrack?: () => void;
}) {
  const price = formatOpportunityPrice(product);
  const commission =
    product.commissionAmount !== null
      ? formatMoney(product.commissionAmount, product.commissionCurrency)
      : product.commissionPercent !== null
        ? `${product.commissionPercent.toFixed(2)}%`
        : "não informada";

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex gap-3 p-3">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold">{product.title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {product.shopName || "Loja não informada"}
            {product.saleRegion ? ` · ${product.saleRegion}` : ""}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Metric label="Preço" value={price} />
            <Metric label="Comissão" value={commission} />
            <Metric
              label="Vendas"
              value={product.unitsSold === null ? "—" : product.unitsSold.toLocaleString("pt-BR")}
            />
          </div>
        </div>
      </div>

      {(product.detailLink || onTrack || onUntrack) && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-2">
          {product.detailLink && (
            <a
              href={product.detailLink}
              target="_blank"
              rel="noreferrer"
              className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium hover:text-foreground"
            >
              Abrir no TikTok Shop
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {tracked && onUntrack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={untracking}
              onClick={onUntrack}
            >
              {untracking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Parar
            </Button>
          ) : onTrack ? (
            <Button type="button" variant="outline" size="sm" disabled={tracking} onClick={onTrack}>
              {tracking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookmarkPlus className="h-4 w-4" />
              )}
              Acompanhar
            </Button>
          ) : null}
        </div>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-medium">{value}</p>
    </div>
  );
}

function formatHistoryNumberDelta(first: number | null, latest: number | null) {
  if (first === null || latest === null) return "—";
  const delta = latest - first;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toLocaleString("pt-BR")}`;
}

function formatHistoryPercentDelta(first: number | null, latest: number | null) {
  if (first === null || latest === null) return "—";
  const delta = latest - first;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)} p.p.`;
}

function formatHistoryMoneyDelta(
  first: number | null,
  latest: number | null,
  currency: string | null,
) {
  if (first === null || latest === null) return "—";
  const delta = latest - first;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatMoney(delta, currency)}`;
}

function formatHistoryCommission(
  reading: TikTokOpportunityHistory["readings"][number],
) {
  if (reading.commissionAmount !== null) {
    return formatMoney(reading.commissionAmount, reading.commissionCurrency);
  }

  if (reading.commissionPercent !== null) {
    return `${reading.commissionPercent.toFixed(2)}%`;
  }

  return "—";
}

function formatHistoryPrice(reading: TikTokOpportunityHistory["readings"][number]) {
  if (reading.minimumPrice === null) return "—";
  const minimum = formatMoney(reading.minimumPrice, reading.currency);

  if (reading.maximumPrice === null || reading.maximumPrice === reading.minimumPrice) {
    return minimum;
  }

  return `${minimum} – ${formatMoney(reading.maximumPrice, reading.currency)}`;
}

function formatTrackedChanges(product: TikTokTrackedOpportunity) {
  const changes: string[] = [];

  if (product.unitsSoldDelta !== null) {
    const sign = product.unitsSoldDelta > 0 ? "+" : "";
    changes.push(`vendas ${sign}${product.unitsSoldDelta.toLocaleString("pt-BR")}`);
  }

  if (product.commissionPercentDelta !== null) {
    const sign = product.commissionPercentDelta > 0 ? "+" : "";
    changes.push(`comissão ${sign}${product.commissionPercentDelta.toFixed(2)} p.p.`);
  }

  if (product.minimumPriceDelta !== null) {
    const sign = product.minimumPriceDelta > 0 ? "+" : "";
    changes.push(`preço ${sign}${formatMoney(product.minimumPriceDelta, product.currency)}`);
  }

  return changes.length ? changes.join(" · ") : "aguardando uma segunda leitura para comparar";
}

function formatTrackedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOpportunityPrice(product: TikTokCreatorOpportunity) {
  if (product.minimumPrice === null) return "—";

  const minimum = formatMoney(product.minimumPrice, product.currency);
  if (product.maximumPrice === null || product.maximumPrice === product.minimumPrice)
    return minimum;

  return `${minimum} – ${formatMoney(product.maximumPrice, product.currency)}`;
}

function formatMoney(value: number, currency: string | null) {
  if (!currency) return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  }
}

function formatResultCount(total: number) {
  if (total === 1) return "1 produto atende aos critérios atuais";
  return `${total.toLocaleString("pt-BR")} produtos atendem aos critérios atuais`;
}

function PersonalRadarSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="surface-card overflow-hidden">
          <div className="h-40 animate-pulse bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-16 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
