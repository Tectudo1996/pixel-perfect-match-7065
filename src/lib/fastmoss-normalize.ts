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
  const raw =
    typeof value === "number"
      ? value
      : Number(String(value).replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return null;
  return Math.round(raw * 100) / 100;
}

/** Número finito e não negativo, ou null. */
export function nonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^\d.-]/g, ""));
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

export function binaryFlag(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
}

export function timestampToIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())
        ? Number(value.trim())
        : NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  const milliseconds = parsed >= 1_000_000_000_000 ? parsed : parsed * 1000;

  try {
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  } catch {
    return null;
  }
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

export type FastmossRawVideo = {
  product_id?: unknown;
  video_id?: unknown;
  uid?: unknown;
  seller_id?: unknown;
  is_ad?: unknown;
  comment_count?: unknown;
  digg_count?: unknown;
  play_count?: unknown;
  share_count?: unknown;
  create_time?: unknown;
  units_sold?: unknown;
  gmv?: unknown;
  region?: unknown;
  video?: {
    video_desc?: unknown;
    cover?: unknown;
    duration?: unknown;
    fastmoss_url?: unknown;
    tiktok_url?: unknown;
    uid?: unknown;
    create_time?: unknown;
  } | null;
};

export type FastmossRawCreator = {
  uid?: unknown;
  unique_id?: unknown;
  nickname?: unknown;
  avatar?: unknown;
  units_sold?: unknown;
  gmv?: unknown;
  category_id?: unknown;
  category_name?: unknown;
  follower_count?: unknown;
  aweme_count?: unknown;
  favoriting_count?: unknown;
  region?: unknown;
};

export type NormalizedFastmossVideo = {
  externalVideoId: string;
  creatorUid: string | null;
  sellerId: string | null;
  isAd: boolean | null;
  commentCount: number | null;
  diggCount: number | null;
  playCount: number | null;
  shareCount: number | null;
  unitsSold: number | null;
  gmv: number | null;
  region: string | null;
  description: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
  fastmossUrl: string | null;
  tiktokUrl: string | null;
  publishedAt: string | null;
};

export type NormalizedFastmossCreator = {
  creatorUid: string;
  uniqueId: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  unitsSold: number | null;
  gmv: number | null;
  categoryId: number | null;
  categoryName: string | null;
  followerCount: number | null;
  awemeCount: number | null;
  favoritingCount: number | null;
  region: string | null;
};

/** Converte um item FastMoss em item de ingestão. Retorna null se faltar id/título. */
export function normalizeFastmossProduct(
  raw: FastmossRawProduct,
  defaultRegion: string,
): ProductIngestItem | null {
  const productId =
    raw.product_id === null || raw.product_id === undefined
      ? ""
      : String(raw.product_id).trim();
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!productId || !title) return null;

  const region = (
    typeof raw.region === "string" && raw.region.trim() ? raw.region : defaultRegion
  )
    .trim()
    .toUpperCase();
  const shopName = raw.shop && typeof raw.shop.name === "string" ? raw.shop.name.trim() : "";

  return {
    name: title.slice(0, 500),
    original_url: tiktokProductUrl(productId, region, raw.tiktok_url),
    image_url: httpUrl(raw.cover),
    price: nonNegativeNumber(raw.floor_price),
    commission_percent: parsePercent(raw.commission_rate),
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

export function normalizeFastmossVideo(
  raw: FastmossRawVideo,
): NormalizedFastmossVideo | null {
  const externalVideoId =
    raw.video_id === null || raw.video_id === undefined ? "" : String(raw.video_id).trim();

  if (!externalVideoId) return null;

  const creatorUid =
    raw.uid === null || raw.uid === undefined
      ? raw.video?.uid === null || raw.video?.uid === undefined
        ? null
        : String(raw.video.uid).trim() || null
      : String(raw.uid).trim() || null;

  const description =
    typeof raw.video?.video_desc === "string" ? raw.video.video_desc.trim() : "";

  return {
    externalVideoId: externalVideoId.slice(0, 255),
    creatorUid,
    sellerId:
      raw.seller_id === null || raw.seller_id === undefined
        ? null
        : String(raw.seller_id).trim() || null,
    isAd: binaryFlag(raw.is_ad),
    commentCount: nonNegativeInt(raw.comment_count),
    diggCount: nonNegativeInt(raw.digg_count),
    playCount: nonNegativeInt(raw.play_count),
    shareCount: nonNegativeInt(raw.share_count),
    unitsSold: nonNegativeInt(raw.units_sold),
    gmv: nonNegativeNumber(raw.gmv),
    region: typeof raw.region === "string" && raw.region.trim()
      ? raw.region.trim().toUpperCase()
      : null,
    description: description ? description.slice(0, 5000) : null,
    coverUrl: httpUrl(raw.video?.cover),
    durationSeconds: nonNegativeInt(raw.video?.duration),
    fastmossUrl: httpUrl(raw.video?.fastmoss_url),
    tiktokUrl: httpUrl(raw.video?.tiktok_url),
    publishedAt: timestampToIso(raw.video?.create_time ?? raw.create_time),
  };
}

export function normalizeFastmossCreator(
  raw: FastmossRawCreator,
): NormalizedFastmossCreator | null {
  const creatorUid = raw.uid === null || raw.uid === undefined ? "" : String(raw.uid).trim();
  if (!creatorUid) return null;

  const uniqueId = typeof raw.unique_id === "string" ? raw.unique_id.trim() : "";
  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : "";
  const categoryName =
    typeof raw.category_name === "string" ? raw.category_name.trim() : "";

  return {
    creatorUid: creatorUid.slice(0, 255),
    uniqueId: uniqueId ? uniqueId.slice(0, 255) : null,
    nickname: nickname ? nickname.slice(0, 500) : null,
    avatarUrl: httpUrl(raw.avatar),
    unitsSold: nonNegativeInt(raw.units_sold),
    gmv: nonNegativeNumber(raw.gmv),
    categoryId: nonNegativeInt(raw.category_id),
    categoryName: categoryName ? categoryName.slice(0, 500) : null,
    followerCount: nonNegativeInt(raw.follower_count),
    awemeCount: nonNegativeInt(raw.aweme_count),
    favoritingCount: nonNegativeInt(raw.favoriting_count),
    region: typeof raw.region === "string" && raw.region.trim()
      ? raw.region.trim().toUpperCase()
      : null,
  };
}
