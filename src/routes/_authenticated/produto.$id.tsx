import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clapperboard,
  ExternalLink,
  Heart,
  ImageOff,
  Loader2,
  PackageSearch,
  RefreshCw,
  Store,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
import { useProductDetail } from "@/hooks/useProductDetail";
import { brl, dateBR, num, percent, NA } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/produto/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Análise do Produto — RadarShop AI" },
      {
        name: "description",
        content: "Dados e histórico do produto no RadarShop AI.",
      },
    ],
  }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading, isError, error, refetch, isFetching } = useProductDetail(id);
  const { data: favorites = [] } = useFavorites();
  const toggleFavorite = useToggleFavorite();

  const favorite = favorites.includes(id);

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="surface-card flex flex-col items-center justify-center p-10 text-center">
        <RefreshCw className="h-5 w-5 text-muted-foreground" />
        <h1 className="mt-3 text-base font-semibold">Não foi possível carregar o produto</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Tente novamente em alguns instantes."}
        </p>
        <Button className="mt-4" variant="outline" size="sm" onClick={() => void refetch()}>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="surface-card flex flex-col items-center justify-center p-10 text-center">
        <PackageSearch className="h-5 w-5 text-muted-foreground" />
        <h1 className="mt-3 text-base font-semibold">Produto não encontrado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Este produto não existe ou não está disponível para a sua conta.
        </p>
        <Link
          to="/radar"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao Radar
        </Link>
      </div>
    );
  }

  const { product, metrics } = data;
  const originalUrl = safeHttpUrl(product.original_url);

  return (
    <div className="space-y-6">
      <Link
        to="/radar"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao Radar
      </Link>

      <section className="surface-card overflow-hidden">
        <div className="grid lg:grid-cols-[340px_1fr]">
          <div className="flex min-h-72 items-center justify-center border-b border-border bg-muted lg:border-r lg:border-b-0">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full max-h-[420px] w-full object-cover"
              />
            ) : (
              <ImageOff className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          <div className="p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {product.categories?.name && (
                  <span className="gold-chip inline-flex rounded-full px-2.5 py-1 text-xs font-medium">
                    {product.categories.name}
                  </span>
                )}
                <h1 className="mt-3 text-2xl font-bold md:text-3xl">{product.name}</h1>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Store className="h-4 w-4" />
                  {product.store_name || "Loja não informada"}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={toggleFavorite.isPending}
                onClick={() =>
                  toggleFavorite.mutate({
                    productId: product.id,
                    active: favorite,
                  })
                }
              >
                <Heart className={cn("h-4 w-4", favorite && "fill-gold text-gold")} />
                {favorite ? "Favoritado" : "Favoritar"}
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard label="Preço" value={brl(product.price) ?? NA} />
              <InfoCard
                label="Comissão"
                value={brl(product.commission_amount) ?? percent(product.commission_percent) ?? NA}
              />
              <InfoCard label="Vendas informadas" value={num(product.sales_count) ?? NA} />
              <InfoCard
                label="Criadores informados"
                value={num(product.creators_count) ?? NA}
                icon={UsersRound}
              />
            </div>

            {product.description && (
              <div className="mt-6 border-t border-border pt-5">
                <h2 className="text-sm font-semibold">Descrição</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
              <Button asChild variant="gold">
                <Link to="/estudio" search={{ produto: product.id }}>
                  Criar conteúdo <Clapperboard className="h-4 w-4" />
                </Link>
              </Button>
              {originalUrl && (
                <Button asChild variant="outline">
                  <a href={originalUrl} target="_blank" rel="noreferrer noopener">
                    Abrir produto original <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Link
                to="/favoritos"
                className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-secondary"
              >
                Ver meus favoritos
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <section className="surface-card p-5">
          <h2 className="text-base font-semibold">Origem dos dados</h2>
          <div className="mt-4 space-y-3 text-sm">
            <MetadataRow label="Fonte" value={product.source || NA} />
            <MetadataRow label="Identificado em" value={dateBR(product.identified_at) ?? NA} />
            <MetadataRow label="Atualizado em" value={dateBR(product.data_updated_at) ?? NA} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            O RadarShop AI exibe somente informações que existem na fonte cadastrada. Campos sem
            dados permanecem identificados como indisponíveis.
          </p>
        </section>

        <section className="surface-card p-5">
          <div>
            <h2 className="text-base font-semibold">Histórico de métricas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Até 12 registros mais recentes disponíveis para este produto.
            </p>
          </div>

          {metrics.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium">Preço</th>
                    <th className="pb-2 font-medium">Comissão</th>
                    <th className="pb-2 font-medium">Vendas</th>
                    <th className="pb-2 font-medium">Criadores</th>
                    <th className="pb-2 font-medium">Fonte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {metrics.map((metric) => (
                    <tr key={metric.id}>
                      <td className="py-2.5">{dateBR(metric.recorded_at) ?? NA}</td>
                      <td className="py-2.5">{brl(metric.price) ?? NA}</td>
                      <td className="py-2.5">{brl(metric.commission_amount) ?? NA}</td>
                      <td className="py-2.5">{num(metric.sales_count) ?? NA}</td>
                      <td className="py-2.5">{num(metric.creators_count) ?? NA}</td>
                      <td className="py-2.5">{metric.source || NA}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium">Sem histórico disponível</p>
              <p className="mt-1 text-xs text-muted-foreground">
                O histórico aparecerá quando a fonte registrar novas coletas deste produto.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof UsersRound;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2.5 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium">{value}</span>
    </div>
  );
}

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function ProductDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-5 w-28 animate-pulse rounded bg-muted" />
      <div className="surface-card grid overflow-hidden lg:grid-cols-[340px_1fr]">
        <div className="h-80 animate-pulse bg-muted" />
        <div className="space-y-5 p-6">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
