import { useState } from "react";
import {
  BadgeDollarSign,
  ExternalLink,
  Eye,
  Heart,
  ImageOff,
  Loader2,
  RefreshCw,
  ShoppingCart,
  UserRound,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useProductMarketContent,
  useRefreshProductMarketContent,
  type MarketCreator,
  type MarketVideo,
} from "@/hooks/useProductMarketContent";
import { money, num, NA } from "@/lib/format";

export function ProductMarketContent({
  productId,
  source,
  externalId,
  currency,
}: {
  productId: string;
  source: string;
  externalId: string | null | undefined;
  currency: string | null | undefined;
}) {
  const eligible = source.startsWith("fastmoss:") && Boolean(externalId);
  const query = useProductMarketContent(productId, eligible);
  const refresh = useRefreshProductMarketContent(productId);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [showAllCreators, setShowAllCreators] = useState(false);

  async function handleRefresh() {
    try {
      const result = await refresh.mutateAsync();
      if (result.cached) {
        toast.success("Os dados ainda estão dentro da janela de cache de 24 horas.");
      } else if (result.partial) {
        toast.warning("Atualização parcial. O cache válido da parte que falhou foi preservado.");
      } else {
        toast.success("Vídeos e criadores atualizados.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a inteligência de mercado.",
      );
    }
  }

  if (!eligible) {
    return (
      <section className="surface-card p-5">
        <Header />
        <p className="mt-3 text-sm text-muted-foreground">
          Vídeos e criadores associados ficam disponíveis para produtos importados pela FastMoss que
          possuam um ID externo válido.
        </p>
      </section>
    );
  }

  if (query.isLoading) {
    return (
      <section className="surface-card p-5">
        <Header />
        <div className="mt-4 h-32 animate-pulse rounded-lg bg-muted" />
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="surface-card p-5">
        <Header />
        <p className="mt-3 text-sm text-muted-foreground">
          {query.error instanceof Error
            ? query.error.message
            : "Não foi possível carregar o cache deste produto."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            <RefreshCw className="h-4 w-4" />
            Tentar carregar novamente
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            disabled={refresh.isPending}
            onClick={() => void handleRefresh()}
          >
            {refresh.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Buscar vídeos e criadores
          </Button>
        </div>
      </section>
    );
  }

  const data = query.data;
  const hasVideos = Boolean(data?.videos.length);
  const hasCreators = Boolean(data?.creators.length);
  const hasContent = hasVideos || hasCreators;
  const videos = showAllVideos ? (data?.videos ?? []) : (data?.videos ?? []).slice(0, 6);
  const creators = showAllCreators ? (data?.creators ?? []) : (data?.creators ?? []).slice(0, 6);
  const marketCurrency = data?.currency || currency || "BRL";

  return (
    <section className="surface-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Header />
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Inteligência de mercado FastMoss — não é métrica oficial do TikTok. O cache é global por
            produto e evita novas chamadas por 24 horas quando a atualização está completa.
          </p>
          {data?.lastUpdatedAt && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Atualizado em {dateTimeBR(data.lastUpdatedAt)}
              {data.canRefreshAt
                ? " · próxima coleta externa após " + dateTimeBR(data.canRefreshAt)
                : ""}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant={hasContent ? "outline" : "gold"}
          size="sm"
          disabled={refresh.isPending}
          onClick={() => void handleRefresh()}
        >
          {refresh.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {hasContent ? "Atualizar inteligência" : "Buscar vídeos e criadores"}
        </Button>
      </div>

      {!hasContent ? (
        <div className="mt-5 rounded-lg border border-dashed border-border p-7 text-center">
          <p className="text-sm font-medium">Nenhum conteúdo relacionado em cache ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A busca só acontece quando você usa o botão acima; abrir esta página não consome a API.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-7">
          <div>
            <SectionTitle
              title="Vídeos associados ao produto"
              total={data?.totals.videos ?? 0}
              stored={data?.videos.length ?? 0}
              expanded={showAllVideos}
              onToggle={() => setShowAllVideos((current) => !current)}
            />
            {hasVideos ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {videos.map((video) => (
                  <VideoCard key={video.id} video={video} currency={marketCurrency} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                A última coleta válida não retornou vídeos para este produto.
              </p>
            )}
          </div>

          <div className="border-t border-border pt-6">
            <SectionTitle
              title="Criadores associados ao produto"
              total={data?.totals.creators ?? 0}
              stored={data?.creators.length ?? 0}
              expanded={showAllCreators}
              onToggle={() => setShowAllCreators((current) => !current)}
            />
            {hasCreators ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {creators.map((creator) => (
                  <CreatorCard key={creator.id} creator={creator} currency={marketCurrency} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                A última coleta válida não retornou criadores para este produto.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Video className="h-4 w-4" />
      <h2 className="text-base font-semibold">Conteúdo que está vendendo</h2>
    </div>
  );
}

function SectionTitle({
  title,
  total,
  stored,
  expanded,
  onToggle,
}: {
  title: string;
  total: number;
  stored: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Ordenados por vendas atribuídas. Total informado pela fonte: {num(total) ?? "0"}.
        </p>
      </div>
      {stored > 6 && (
        <Button type="button" variant="ghost" size="sm" onClick={onToggle}>
          {expanded ? "Mostrar 6" : "Ver todos (" + stored + ")"}
        </Button>
      )}
    </div>
  );
}

function VideoCard({ video, currency }: { video: MarketVideo; currency: string }) {
  const url = safeHttpUrl(video.tiktokUrl);

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex h-36 items-center justify-center overflow-hidden bg-muted">
        {video.coverUrl ? (
          <img src={video.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <ImageOff className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {video.isAd === true && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">
              Anúncio
            </span>
          )}
          {video.region && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              {video.region}
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-relaxed">
          {video.description || "Descrição não disponível"}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <Metric icon={ShoppingCart} value={(num(video.unitsSold) ?? NA) + " vendas"} />
          <Metric icon={BadgeDollarSign} value={money(video.gmv, currency) ?? NA} />
          <Metric icon={Eye} value={(num(video.playCount) ?? NA) + " views"} />
          <Metric icon={Heart} value={(num(video.diggCount) ?? NA) + " likes"} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>{formatDuration(video.durationSeconds)}</span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              Abrir TikTok <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function CreatorCard({ creator, currency }: { creator: MarketCreator; currency: string }) {
  const profileUrl = creatorTikTokUrl(creator.uniqueId);

  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {creator.avatarUrl ? (
            <img
              src={creator.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <UserRound className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {creator.nickname || creator.uniqueId || "Criador"}
          </p>
          {creator.uniqueId && (
            <p className="truncate text-xs text-muted-foreground">
              @{cleanUniqueId(creator.uniqueId)}
            </p>
          )}
        </div>
        {creator.region && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            {creator.region}
          </span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <Metric icon={ShoppingCart} value={(num(creator.unitsSold) ?? NA) + " vendas"} />
        <Metric icon={BadgeDollarSign} value={money(creator.gmv, currency) ?? NA} />
        <Metric icon={UserRound} value={(num(creator.followerCount) ?? NA) + " seguidores"} />
        <Metric icon={Video} value={(num(creator.awemeCount) ?? NA) + " vídeos"} />
      </div>
      {profileUrl && (
        <a
          href={profileUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          Abrir perfil <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </article>
  );
}

function Metric({ icon: Icon, value }: { icon: typeof ShoppingCart; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{value}</span>
    </span>
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

function cleanUniqueId(value: string) {
  return value.trim().replace(/^@+/, "");
}

function creatorTikTokUrl(uniqueId: string | null) {
  if (!uniqueId) return null;
  const cleaned = cleanUniqueId(uniqueId);
  return cleaned ? "https://www.tiktok.com/@" + encodeURIComponent(cleaned) : null;
}

function formatDuration(value: number | null) {
  if (value === null) return "Duração não disponível";
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return minutes > 0 ? minutes + ":" + seconds.toString().padStart(2, "0") : seconds + "s";
}

function dateTimeBR(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
