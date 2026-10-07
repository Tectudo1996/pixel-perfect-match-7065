import { normalizeFastmossProduct, fastmossSource, type FastmossRawProduct } from "@/lib/fastmoss-normalize";
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

export type FastmossSearchOptions = {
  region: string;
  pageSize: number;
};

export async function searchFastmossTopProducts(
  options: FastmossSearchOptions,
): Promise<{ source: string; products: ProductIngestItem[]; received: number }> {
  const apiKey = process.env["FASTMOSS_API_KEY"];
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
    response = await fetch(`${FASTMOSS_BASE_URL}/product/v1/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filter: { region: options.region, off_shelves: 0 },
        orderby: [{ field: "day7_gmv", order: "desc" }],
        page: 1,
        pagesize: options.pageSize,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new FastmossError(
      504,
      aborted ? "FASTMOSS_TIMEOUT" : "FASTMOSS_UNREACHABLE",
      aborted ? "A FastMoss não respondeu a tempo." : "Não foi possível contatar a FastMoss.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new FastmossError(
      502,
      response.status === 401 || response.status === 403 ? "FASTMOSS_UNAUTHORIZED" : "FASTMOSS_HTTP_ERROR",
      `A FastMoss recusou a consulta (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json().catch(() => null)) as {
    code?: unknown;
    msg?: unknown;
    data?: { list?: unknown } | unknown[] | null;
  } | null;

  const list = Array.isArray(payload?.data)
    ? payload.data
    : payload?.data && typeof payload.data === "object" && Array.isArray((payload.data as { list?: unknown }).list)
      ? ((payload.data as { list: unknown[] }).list)
      : null;

  if (!list) {
    throw new FastmossError(502, "FASTMOSS_INVALID_RESPONSE", "Resposta da FastMoss em formato inesperado.");
  }

  const seen = new Set<string>();
  const products: ProductIngestItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const normalized = normalizeFastmossProduct(item as FastmossRawProduct, options.region);
    if (!normalized || seen.has(normalized.original_url)) continue;
    seen.add(normalized.original_url);
    products.push(normalized);
  }

  return { source: fastmossSource(options.region), products, received: list.length };
}
