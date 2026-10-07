import { Link } from "@tanstack/react-router";
import { Heart, ImageOff, UsersRound } from "lucide-react";
import { useToggleFavorite } from "@/hooks/useFavorites";
import { brl, percent, NA } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Produto } from "@/types/product";

export type { Produto } from "@/types/product";

const compactNumber = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function ProductCard({ produto, favorito }: { produto: Produto; favorito: boolean }) {
  const toggle = useToggleFavorite();

  return (
    <div className="surface-card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <button
        type="button"
        onClick={() => toggle.mutate({ productId: produto.id, active: favorito })}
        aria-label={favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        disabled={toggle.isPending}
        className="absolute top-2 right-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-surface/90 shadow-sm backdrop-blur disabled:cursor-wait"
      >
        <Heart className={cn("h-4 w-4", favorito && "fill-gold text-gold")} />
      </button>

      <Link to="/produto/$id" params={{ id: produto.id }} className="flex flex-1 flex-col">
        <div className="flex h-40 items-center justify-center overflow-hidden border-b border-border bg-muted">
          {produto.image_url ? (
            <img
              src={produto.image_url}
              alt={produto.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <ImageOff className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="flex min-h-5 items-center gap-2">
            {produto.categories?.name && (
              <span className="gold-chip w-fit rounded-full px-2 py-0.5 text-[11px] font-medium">
                {produto.categories.name}
              </span>
            )}
            {produto.data_provenance === "third_party_market_intelligence" &&
              produto.source.startsWith("fastmoss:") && (
                <span
                  className="w-fit rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  title="Dados de inteligência de mercado de terceiros (FastMoss). Não são métricas oficiais do TikTok."
                >
                  Fonte FastMoss
                </span>
              )}
          </div>

          <h3 className="line-clamp-2 text-sm font-semibold">{produto.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {produto.store_name || "Loja não informada"}
          </p>

          <div className="mt-auto space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="flex justify-between gap-3">
              <span>Preço</span>
              <span className="font-medium text-foreground">{brl(produto.price) ?? NA}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Comissão</span>
              <span className="font-medium text-foreground">
                {brl(produto.commission_amount) ?? percent(produto.commission_percent) ?? NA}
              </span>
            </div>
            {(produto.sales_count !== null || produto.creators_count !== null) && (
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <span>Atividade</span>
                <span className="flex items-center gap-2 text-foreground">
                  {produto.sales_count !== null && (
                    <span>{compactNumber.format(produto.sales_count)} vendas</span>
                  )}
                  {produto.creators_count !== null && (
                    <span className="inline-flex items-center gap-1">
                      <UsersRound className="h-3 w-3" />
                      {compactNumber.format(produto.creators_count)}
                    </span>
                  )}
                </span>
              </div>
            )}
            {produto.gmv_7d != null && (
              <div className="flex justify-between gap-3">
                <span>GMV 7 dias</span>
                <span className="font-medium text-foreground">{brl(produto.gmv_7d) ?? NA}</span>
              </div>
            )}
            {(produto.sales_7d != null || produto.video_count != null) && (
              <div className="flex justify-between gap-3">
                <span>7 dias</span>
                <span className="flex items-center gap-2 text-foreground">
                  {produto.sales_7d != null && (
                    <span>{compactNumber.format(produto.sales_7d)} vendas</span>
                  )}
                  {produto.video_count != null && (
                    <span>{compactNumber.format(produto.video_count)} vídeos</span>
                  )}
                </span>
              </div>
            )}
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
