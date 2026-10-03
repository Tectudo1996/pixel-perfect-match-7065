import { BookmarkPlus, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TikTokCreatorOpportunity } from "@/hooks/useTikTokShop";

export function TikTokOpportunityCard({
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
          ) : !tracked && onTrack ? (
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

function formatOpportunityPrice(product: TikTokCreatorOpportunity) {
  if (product.minimumPrice === null) return "—";

  const minimum = formatMoney(product.minimumPrice, product.currency);
  if (product.maximumPrice === null || product.maximumPrice === product.minimumPrice) {
    return minimum;
  }

  return `${minimum} – ${formatMoney(product.maximumPrice, product.currency)}`;
}

function formatMoney(value: number, currency: string | null) {
  if (!currency) {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  }

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  }
}
