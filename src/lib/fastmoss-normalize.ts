import type { ProductIngestItem } from "./product-ingest-schema.ts";

export const FASTMOSS_PROVENANCE = "third_party_market_intelligence";

export function fastmossSource(region: string) {
  return `fastmoss:product-search:${region.toUpperCase()}`;
}

const REGION_CURRENCY: Record<string, string> = { BR: "BRL" };

export function currencyForRegion(region: string | null | undefined): string | null {
  if (!region) return null;
  return REGION_CURRENCY[region.trim().toUpperCase()] ?? null;
}

/** "12.5%" => 12.5; "12,5" => 12.5; inválido/fora de 0..100 => null. */
export function parsePercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "number" ? value : Number(String(value).replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return null;
  return Math.round(raw * 100) / 100;
}

/** Número finito e não negativo, ou null. */
export function nonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

export function nonNegativeInt(value: unknown): number | null {
  const n = nonNegativeNumber(value);
  return n === null ? null : Math.trunc(n);
}

/** Aceita apenas URLs http/https. */
export function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function tiktokProductUrl(productId: string, region: string, tiktokUrl?: unknown) {
  return (
    httpUrl(tiktokUrl) ??
    `https://shop.tiktok.com/view/product/${encodeURIComponent(productId)}?region=${encodeURIComponent(region.toUpperCase())}`
  );
}

export type FastmossRawProduct = {
  product_id?: unknown;
  title?: unknown;
  region?: unknown;
  cover?: unknown;
  commission_rate?: unknown;
  floor_price?: unknown;
  day7_units_sold?: unknown;
  day7_gmv?: unknown;
  total_units_sold?: unknown;
  total_gmv?: unknown;
  creator_count?: unknown;
  video_count?: unknown;
  tiktok_url?: unknown;
  shop?: { name?: unknown } | null;
};

/** Converte um item FastMoss em item de ingestão. Retorna null se faltar id/título. */
export function normalizeFastmossProduct(
  raw: FastmossRawProduct,
  defaultRegion: string,
): ProductIngestItem | null {
  const productId = raw.product_id === null || raw.product_id === undefined ? "" : String(raw.product_id).trim();
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!productId || !title) return null;

  const region = (typeof raw.region === "string" && raw.region.trim() ? raw.region : defaultRegion)
    .trim()
    .toUpperCase();
  const shopName = raw.shop && typeof raw.shop.name === "string" ? raw.shop.name.trim() : "";
  const price = nonNegativeNumber(raw.floor_price);
  const commissionPercent = parsePercent(raw.commission_rate);

  return {
    name: title.slice(0, 500),
    original_url: tiktokProductUrl(productId, region, raw.tiktok_url),
    image_url: httpUrl(raw.cover),
    price,
    commission_percent: commissionPercent,
    store_name: shopName ? shopName.slice(0, 500) : null,
    sales_count: nonNegativeInt(raw.total_units_sold),
    creators_count: nonNegativeInt(raw.creator_count),
    external_id: productId.slice(0, 200),
    region,
    currency: currencyForRegion(region),
    sales_7d: nonNegativeInt(raw.day7_units_sold),
    gmv_7d: nonNegativeNumber(raw.day7_gmv),
    gmv_total: nonNegativeNumber(raw.total_gmv),
    video_count: nonNegativeInt(raw.video_count),
    data_provenance: FASTMOSS_PROVENANCE,
  };
}
