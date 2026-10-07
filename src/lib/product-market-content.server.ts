import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesInsert } from "@/integrations/supabase/types";
import { requireApiUser } from "@/lib/api-auth.server";
import {
  FastmossError,
  fetchFastmossProductCreators,
  fetchFastmossProductVideos,
} from "@/lib/fastmoss.server";
import {
  isMarketContentCacheFresh,
  nextMarketContentRefreshAt,
} from "@/lib/product-market-content-policy";
import { readJsonBody, RequestBodyError } from "@/lib/request-body.server";

const productIdSchema = z.string().uuid();
const refreshSchema = z.object({
  action: z.literal("refresh-market-content"),
  productId: z.string().uuid(),
});

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Authorization",
};

type MarketProduct = {
  id: string;
  source: string;
  external_id: string | null;
  currency: string | null;
};

type MarketState = {
  product_id: string;
  videos_fetched_at: string | null;
  creators_fetched_at: string | null;
  next_refresh_at: string | null;
  video_total: number | null;
  creator_total: number | null;
  last_error_code: string | null;
  last_error_message: string | null;
  updated_at: string;
};

class MarketContentError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function handleProductMarketContentGet(request: Request) {
  try {
    await requireApiUser(request);

    const url = new URL(request.url);
    if (url.searchParams.get("marketContent") !== "1") {
      throw new MarketContentError(
        400,
        "MARKET_CONTENT_QUERY_REQUIRED",
        "Informe marketContent=1 para consultar o cache de mercado.",
      );
    }

    const productId = productIdSchema.parse(url.searchParams.get("productId"));
    const result = await getMarketContent(productId);

    return Response.json(result, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    return marketErrorResponse(error);
  }
}

export async function handleProductMarketContentRefresh(request: Request) {
  try {
    await requireApiUser(request);

    const body = refreshSchema.parse(await readJsonBody(request, 16_384));
    const product = await getMarketProduct(body.productId);

    if (!isFastmossProduct(product)) {
      throw new MarketContentError(
        400,
        "MARKET_CONTENT_UNAVAILABLE",
        "Este produto não possui uma origem FastMoss compatível com o enriquecimento.",
      );
    }

    const state = await getMarketState(product.id);

    if (isMarketContentCacheFresh(state?.next_refresh_at)) {
      return Response.json(
        {
          ...(await getMarketContent(product.id, product, state)),
          cached: true,
          partial: false,
          warnings: [],
        },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }

    const fetchedAt = new Date().toISOString();
    const [videosResult, creatorsResult] = await Promise.allSettled([
      fetchFastmossProductVideos(product.external_id!, 12),
      fetchFastmossProductCreators(product.external_id!, 12),
    ]);

    let videosSucceeded = false;
    let creatorsSucceeded = false;
    let videoTotal: number | null = null;
    let creatorTotal: number | null = null;
    const warnings: string[] = [];
    const failures: Array<{ code: string; message: string; status: number }> = [];

    if (videosResult.status === "fulfilled") {
      try {
        await persistVideos(product.id, videosResult.value.items, fetchedAt);
        videosSucceeded = true;
        videoTotal = videosResult.value.total;
      } catch (error) {
        const failure = normalizeFailure(error, "VIDEOS_PERSIST_FAILED");
        failures.push(failure);
        warnings.push("Os vídeos não puderam ser atualizados nesta tentativa.");
      }
    } else {
      const failure = normalizeFailure(videosResult.reason, "VIDEOS_FETCH_FAILED");
      failures.push(failure);
      warnings.push("Os vídeos não puderam ser atualizados nesta tentativa.");
    }

    if (creatorsResult.status === "fulfilled") {
      try {
        await persistCreators(product.id, creatorsResult.value.items, fetchedAt);
        creatorsSucceeded = true;
        creatorTotal = creatorsResult.value.total;
      } catch (error) {
        const failure = normalizeFailure(error, "CREATORS_PERSIST_FAILED");
        failures.push(failure);
        warnings.push("Os criadores não puderam ser atualizados nesta tentativa.");
      }
    } else {
      const failure = normalizeFailure(creatorsResult.reason, "CREATORS_FETCH_FAILED");
      failures.push(failure);
      warnings.push("Os criadores não puderam ser atualizados nesta tentativa.");
    }

    const anySucceeded = videosSucceeded || creatorsSucceeded;
    const partial = anySucceeded && !(videosSucceeded && creatorsSucceeded);
    const nextRefreshAt = nextMarketContentRefreshAt(partial || !anySucceeded);
    const stateValues: TablesInsert<"product_market_enrichment_state"> = {
      product_id: product.id,
      next_refresh_at: nextRefreshAt,
      updated_at: fetchedAt,
      last_error_code: failures.length
        ? failures
            .map((failure) => failure.code)
            .join("|")
            .slice(0, 500)
        : null,
      last_error_message: failures.length
        ? failures
            .map((failure) => failure.message)
            .join(" ")
            .slice(0, 1000)
        : null,
    };

    if (videosSucceeded) {
      stateValues.videos_fetched_at = fetchedAt;
      stateValues.video_total = videoTotal;
    }

    if (creatorsSucceeded) {
      stateValues.creators_fetched_at = fetchedAt;
      stateValues.creator_total = creatorTotal;
    }

    const { error: stateError } = await supabaseAdmin
      .from("product_market_enrichment_state")
      .upsert(stateValues, { onConflict: "product_id" });

    if (stateError) throw stateError;

    if (!anySucceeded) {
      const first = failures[0];
      throw new MarketContentError(
        first?.status ?? 502,
        first?.code ?? "MARKET_CONTENT_REFRESH_FAILED",
        "A FastMoss não conseguiu atualizar vídeos nem criadores agora. O cache anterior foi preservado.",
      );
    }

    return Response.json(
      {
        ...(await getMarketContent(product.id)),
        cached: false,
        partial,
        warnings,
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return marketErrorResponse(error);
  }
}

async function getMarketProduct(productId: string): Promise<MarketProduct> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id,source,external_id,currency")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new MarketContentError(404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");
  }

  return data as MarketProduct;
}

function isFastmossProduct(product: MarketProduct) {
  return product.source.startsWith("fastmoss:") && Boolean(product.external_id);
}

async function getMarketState(productId: string) {
  const { data, error } = await supabaseAdmin
    .from("product_market_enrichment_state")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  if (error) throw error;
  return data as MarketState | null;
}

async function getMarketContent(
  productId: string,
  suppliedProduct?: MarketProduct,
  suppliedState?: MarketState | null,
) {
  const product = suppliedProduct ?? (await getMarketProduct(productId));
  const state = suppliedState === undefined ? await getMarketState(productId) : suppliedState;

  const [videosResult, creatorsResult] = await Promise.all([
    supabaseAdmin
      .from("product_related_videos")
      .select("*")
      .eq("product_id", productId)
      .order("units_sold", { ascending: false, nullsFirst: false })
      .order("gmv", { ascending: false, nullsFirst: false })
      .limit(12),
    supabaseAdmin
      .from("product_related_creators")
      .select("*")
      .eq("product_id", productId)
      .order("units_sold", { ascending: false, nullsFirst: false })
      .order("gmv", { ascending: false, nullsFirst: false })
      .limit(12),
  ]);

  if (videosResult.error) throw videosResult.error;
  if (creatorsResult.error) throw creatorsResult.error;

  const videos = (videosResult.data ?? []).map((row) => ({
    id: row.id,
    externalVideoId: row.external_video_id,
    creatorUid: row.creator_uid,
    sellerId: row.seller_id,
    isAd: row.is_ad,
    commentCount: row.comment_count,
    diggCount: row.digg_count,
    playCount: row.play_count,
    shareCount: row.share_count,
    unitsSold: row.units_sold,
    gmv: row.gmv,
    region: row.region,
    description: row.description,
    coverUrl: row.cover_url,
    durationSeconds: row.duration_seconds,
    fastmossUrl: row.fastmoss_url,
    tiktokUrl: row.tiktok_url,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
  }));

  const creators = (creatorsResult.data ?? []).map((row) => ({
    id: row.id,
    creatorUid: row.creator_uid,
    uniqueId: row.unique_id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    unitsSold: row.units_sold,
    gmv: row.gmv,
    categoryId: row.category_id,
    categoryName: row.category_name,
    followerCount: row.follower_count,
    awemeCount: row.aweme_count,
    favoritingCount: row.favoriting_count,
    region: row.region,
    fetchedAt: row.fetched_at,
  }));

  return {
    productId,
    available: isFastmossProduct(product),
    source: product.source,
    currency: product.currency,
    lastUpdatedAt: latestIso(state?.videos_fetched_at ?? null, state?.creators_fetched_at ?? null),
    canRefreshAt: state?.next_refresh_at ?? null,
    videos,
    creators,
    totals: {
      videos: state?.video_total ?? videos.length,
      creators: state?.creator_total ?? creators.length,
    },
  };
}

async function persistVideos(
  productId: string,
  items: Awaited<ReturnType<typeof fetchFastmossProductVideos>>["items"],
  fetchedAt: string,
) {
  if (items.length) {
    const { error } = await supabaseAdmin.from("product_related_videos").upsert(
      items.map((item) => ({
        product_id: productId,
        external_video_id: item.externalVideoId,
        creator_uid: item.creatorUid,
        seller_id: item.sellerId,
        is_ad: item.isAd,
        comment_count: item.commentCount,
        digg_count: item.diggCount,
        play_count: item.playCount,
        share_count: item.shareCount,
        units_sold: item.unitsSold,
        gmv: item.gmv,
        region: item.region,
        description: item.description,
        cover_url: item.coverUrl,
        duration_seconds: item.durationSeconds,
        fastmoss_url: item.fastmossUrl,
        tiktok_url: item.tiktokUrl,
        published_at: item.publishedAt,
        source: "fastmoss",
        fetched_at: fetchedAt,
      })),
      { onConflict: "product_id,external_video_id" },
    );

    if (error) throw error;

    const { error: cleanupError } = await supabaseAdmin
      .from("product_related_videos")
      .delete()
      .eq("product_id", productId)
      .lt("fetched_at", fetchedAt);

    if (cleanupError) throw cleanupError;
  } else {
    const { error } = await supabaseAdmin
      .from("product_related_videos")
      .delete()
      .eq("product_id", productId);

    if (error) throw error;
  }
}

async function persistCreators(
  productId: string,
  items: Awaited<ReturnType<typeof fetchFastmossProductCreators>>["items"],
  fetchedAt: string,
) {
  if (items.length) {
    const { error } = await supabaseAdmin.from("product_related_creators").upsert(
      items.map((item) => ({
        product_id: productId,
        creator_uid: item.creatorUid,
        unique_id: item.uniqueId,
        nickname: item.nickname,
        avatar_url: item.avatarUrl,
        units_sold: item.unitsSold,
        gmv: item.gmv,
        category_id: item.categoryId,
        category_name: item.categoryName,
        follower_count: item.followerCount,
        aweme_count: item.awemeCount,
        favoriting_count: item.favoritingCount,
        region: item.region,
        source: "fastmoss",
        fetched_at: fetchedAt,
      })),
      { onConflict: "product_id,creator_uid" },
    );

    if (error) throw error;

    const { error: cleanupError } = await supabaseAdmin
      .from("product_related_creators")
      .delete()
      .eq("product_id", productId)
      .lt("fetched_at", fetchedAt);

    if (cleanupError) throw cleanupError;
  } else {
    const { error } = await supabaseAdmin
      .from("product_related_creators")
      .delete()
      .eq("product_id", productId);

    if (error) throw error;
  }
}

function latestIso(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

function normalizeFailure(
  error: unknown,
  fallbackCode: string,
): { code: string; message: string; status: number } {
  if (error instanceof FastmossError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
    };
  }

  return {
    code: fallbackCode,
    message: "Uma parte da atualização não pôde ser concluída.",
    status: 502,
  };
}

function marketErrorResponse(error: unknown) {
  if (error instanceof MarketContentError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: NO_STORE_HEADERS },
    );
  }

  if (error instanceof RequestBodyError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: NO_STORE_HEADERS },
    );
  }

  if (error instanceof Error && error.name === "ZodError") {
    return Response.json(
      {
        error: "Os parâmetros enviados para a inteligência de mercado são inválidos.",
        code: "INVALID_MARKET_CONTENT_REQUEST",
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (error instanceof Error && "status" in error && "code" in error) {
    const typed = error as Error & { status: number; code: string };
    return Response.json(
      { error: typed.message, code: typed.code },
      { status: typed.status, headers: NO_STORE_HEADERS },
    );
  }

  console.error("[RadarShop AI] product market content error", error);

  return Response.json(
    {
      error: "Não foi possível carregar a inteligência de mercado agora.",
      code: "MARKET_CONTENT_INTERNAL_ERROR",
    },
    { status: 500, headers: NO_STORE_HEADERS },
  );
}
