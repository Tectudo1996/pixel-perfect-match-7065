import {
  fastmossSource,
  nonNegativeInt,
  normalizeFastmossCreator,
  normalizeFastmossProduct,
  normalizeFastmossVideo,
  type FastmossRawCreator,
  type FastmossRawProduct,
  type FastmossRawVideo,
  type NormalizedFastmossCreator,
  type NormalizedFastmossVideo,
} from "@/lib/fastmoss-normalize";
import type { ProductIngestItem } from "@/lib/product-ingest-schema";

const FASTMOSS_BASE_URL = "https://openapi.fastmoss.com";
const TIMEOUT_MS = 20_000;

export class FastmossError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type FastmossEnvelope<T> = {
  code?: unknown;
  msg?: unknown;
  message?: unknown;
  data?: T | null;
};

export type FastmossSearchOptions = {
  region: string;
  pageSize: number;
};

export type FastmossRelatedResult<T> = {
  items: T[];
  total: number;
};

async function postFastmoss<T>(path: string, body: unknown): Promise<T> {
  const apiKey = process.env["FASTMOSS_API_KEY"]?.trim();

  if (!apiKey) {
    throw new FastmossError(
      503,
      "FASTMOSS_NOT_CONFIGURED",
      "A integração FastMoss ainda não está configurada no servidor.",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${FASTMOSS_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";

    throw new FastmossError(
      aborted ? 504 : 502,
      aborted ? "FASTMOSS_TIMEOUT" : "FASTMOSS_UNREACHABLE",
      aborted ? "A FastMoss não respondeu a tempo." : "Não foi possível contatar a FastMoss.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new FastmossError(
      response.status === 429 ? 429 : 502,
      response.status === 401 || response.status === 403
        ? "FASTMOSS_UNAUTHORIZED"
        : response.status === 429
          ? "FASTMOSS_RATE_LIMITED"
          : "FASTMOSS_HTTP_ERROR",
      response.status === 429
        ? "A FastMoss limitou temporariamente as consultas. Tente novamente mais tarde."
        : `A FastMoss recusou a consulta (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json().catch(() => null)) as FastmossEnvelope<T> | null;

  if (!payload || payload.data === undefined || payload.data === null) {
    throw new FastmossError(
      502,
      "FASTMOSS_INVALID_RESPONSE",
      "Resposta da FastMoss em formato inesperado.",
    );
  }

  if (payload.code !== undefined && String(payload.code) !== "0") {
    throw new FastmossError(
      502,
      "FASTMOSS_API_ERROR",
      "A FastMoss não concluiu a consulta solicitada.",
    );
  }

  return payload.data;
}

function extractList(data: unknown) {
  if (Array.isArray(data)) {
    return { list: data, total: data.length };
  }

  if (!data || typeof data !== "object") {
    throw new FastmossError(
      502,
      "FASTMOSS_INVALID_RESPONSE",
      "Resposta da FastMoss em formato inesperado.",
    );
  }

  const value = data as { list?: unknown; total?: unknown };

  if (!Array.isArray(value.list)) {
    throw new FastmossError(
      502,
      "FASTMOSS_INVALID_RESPONSE",
      "Resposta da FastMoss em formato inesperado.",
    );
  }

  return {
    list: value.list,
    total: nonNegativeInt(value.total) ?? value.list.length,
  };
}

export async function searchFastmossTopProducts(
  options: FastmossSearchOptions,
): Promise<{ source: string; products: ProductIngestItem[]; received: number }> {
  const data = await postFastmoss<unknown>("/product/v1/search", {
    filter: { region: options.region, off_shelves: 0 },
    orderby: [{ field: "day7_gmv", order: "desc" }],
    page: 1,
    pagesize: Math.min(Math.max(options.pageSize, 1), 100),
  });

  const { list } = extractList(data);
  const seen = new Set<string>();
  const products: ProductIngestItem[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;

    const normalized = normalizeFastmossProduct(item as FastmossRawProduct, options.region);
    if (!normalized || seen.has(normalized.original_url)) continue;

    seen.add(normalized.original_url);
    products.push(normalized);
  }

  return {
    source: fastmossSource(options.region),
    products,
    received: list.length,
  };
}

export async function fetchFastmossProductVideos(
  externalProductId: string,
  pageSize = 12,
): Promise<FastmossRelatedResult<NormalizedFastmossVideo>> {
  const data = await postFastmoss<unknown>("/product/v1/videoList", {
    filter: { product_id: externalProductId },
    orderby: { field: "units_sold", order: "desc" },
    page: 1,
    pagesize: Math.min(Math.max(pageSize, 1), 12),
  });

  const { list, total } = extractList(data);
  const seen = new Set<string>();
  const items: NormalizedFastmossVideo[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;

    const normalized = normalizeFastmossVideo(item as FastmossRawVideo);
    if (!normalized || seen.has(normalized.externalVideoId)) continue;

    seen.add(normalized.externalVideoId);
    items.push(normalized);
  }

  return { items, total };
}

export async function fetchFastmossProductCreators(
  externalProductId: string,
  pageSize = 12,
): Promise<FastmossRelatedResult<NormalizedFastmossCreator>> {
  const data = await postFastmoss<unknown>("/product/v1/creatorList", {
    filter: { product_id: externalProductId },
    orderby: { field: "units_sold", order: "desc" },
    page: 1,
    pagesize: Math.min(Math.max(pageSize, 1), 12),
  });

  const { list, total } = extractList(data);
  const seen = new Set<string>();
  const items: NormalizedFastmossCreator[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;

    const normalized = normalizeFastmossCreator(item as FastmossRawCreator);
    if (!normalized || seen.has(normalized.creatorUid)) continue;

    seen.add(normalized.creatorUid);
    items.push(normalized);
  }

  return { items, total };
}
