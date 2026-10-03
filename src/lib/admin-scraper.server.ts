import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ApiAdminError, ApiAuthError, requireApiAdmin } from "@/lib/api-auth.server";
import { ingestProductBatch } from "@/lib/product-ingest.server";
import { productIngestRequestSchema } from "@/lib/product-ingest-schema";
import { readJsonBody, RequestBodyError } from "@/lib/request-body.server";

const MAX_HTML_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 12_000;
const ROBOTS_TIMEOUT_MS = 5_000;
const SCRAPER_USER_AGENT = "RadarShopAI/1.0 (admin-authorized public-page scraper)";

type ScraperPayload = {
  action: "preview" | "import";
  url: string;
  source: string | null;
  categorySlug: string | null;
};

type ProductPreview = {
  name: string;
  description: string | null;
  imageUrl: string | null;
  originalUrl: string;
  price: number | null;
  currency: string | null;
  importPrice: number | null;
  storeName: string | null;
  source: string;
  categorySlug: string | null;
  extraction: "json-ld" | "metadata";
  warnings: string[];
};

export async function handleAdminScraperPost(request: Request) {
  try {
    const adminUserId = await requireApiAdmin(request);
    const payload = parsePayload(await readJsonBody(request, 16_384));
    const preview = await scrapeProductPage(payload);

    if (payload.action === "preview") {
      return Response.json({ ok: true, preview });
    }

    const collectedAt = new Date().toISOString();
    const body = productIngestRequestSchema.parse({
      source: preview.source,
      collected_at: collectedAt,
      products: [
        {
          name: preview.name,
          description: preview.description,
          image_url: preview.imageUrl,
          category_slug: preview.categorySlug,
          price: preview.importPrice,
          commission_amount: null,
          commission_percent: null,
          store_name: preview.storeName,
          original_url: preview.originalUrl,
          sales_count: null,
          creators_count: null,
        },
      ],
    });

    const runId = await startScraperRun({
      source: preview.source,
      collectedAt,
      adminUserId,
    });

    try {
      const result = await ingestProductBatch(body);

      await finishScraperRun(runId, {
        status: "succeeded",
        inserted_count: result.inserted,
        updated_count: result.updated,
        snapshot_count: result.metric_snapshots,
      });

      return Response.json({
        ok: true,
        preview,
        result,
      });
    } catch (error) {
      await finishScraperRun(runId, {
        status: "failed",
        error_code: "SCRAPER_IMPORT_FAILED",
        error_message: "A página foi analisada, mas a gravação no catálogo falhou.",
      });
      throw error;
    }
  } catch (error) {
    return scraperErrorResponse(error);
  }
}

async function startScraperRun({
  source,
  collectedAt,
  adminUserId,
}: {
  source: string;
  collectedAt: string;
  adminUserId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("ingestion_runs")
    .insert({
      source,
      channel: "api",
      accepted_count: 1,
      collected_at: collectedAt,
      created_by: adminUserId,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[RadarShop AI] histórico do scraper indisponível", error.message);
    return null;
  }

  return data.id;
}

async function finishScraperRun(
  id: string | null,
  values: {
    status: "succeeded" | "failed";
    inserted_count?: number;
    updated_count?: number;
    snapshot_count?: number;
    error_code?: string;
    error_message?: string;
  },
) {
  if (!id) return;

  const { error } = await supabaseAdmin
    .from("ingestion_runs")
    .update({
      ...values,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.warn("[RadarShop AI] histórico do scraper não pôde ser atualizado", error.message);
  }
}

async function scrapeProductPage(payload: ScraperPayload): Promise<ProductPreview> {
  const initialUrl = await validatePublicUrl(payload.url);
  await assertRobotsAllowed(initialUrl);

  const { response, finalUrl } = await fetchWithSafeRedirects(initialUrl);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new ScraperError(
      415,
      "SCRAPER_UNSUPPORTED_CONTENT",
      "A URL não retornou uma página HTML pública.",
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    throw new ScraperError(
      413,
      "SCRAPER_PAGE_TOO_LARGE",
      "A página é grande demais para a raspagem administrativa.",
    );
  }

  const html = await response.text();

  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    throw new ScraperError(
      413,
      "SCRAPER_PAGE_TOO_LARGE",
      "A página é grande demais para a raspagem administrativa.",
    );
  }

  const structuredProduct = findStructuredProduct(html);
  const meta = readMetadata(html);
  const warnings: string[] = [];

  const name =
    readString(structuredProduct?.["name"]) ??
    meta["og:title"] ??
    meta["twitter:title"] ??
    readHtmlTitle(html);

  if (!name) {
    throw new ScraperError(
      422,
      "SCRAPER_PRODUCT_NOT_FOUND",
      "Não foi possível identificar um produto nessa página.",
    );
  }

  const offers = firstObject(structuredProduct?.["offers"]);
  const price =
    readMoney(offers?.["price"]) ??
    readMoney(offers?.["lowPrice"]) ??
    readMoney(firstObject(offers?.["priceSpecification"])?.["price"]) ??
    readMoney(meta["product:price:amount"]);

  const currency = normalizeCurrency(
    readString(offers?.["priceCurrency"]) ?? meta["product:price:currency"] ?? null,
  );

  const importPrice = currency === "BRL" ? price : null;

  if (price !== null && currency === null) {
    warnings.push("Preço encontrado, mas a moeda não foi identificada; ele não será importado.");
  } else if (price !== null && currency !== "BRL") {
    warnings.push(
      `Preço em ${currency} detectado; o catálogo atual trabalha em BRL e esse preço não será importado.`,
    );
  }

  const description =
    readString(structuredProduct?.["description"]) ??
    meta["og:description"] ??
    meta["description"] ??
    null;

  const imageUrl =
    normalizeHttpUrl(readImage(structuredProduct?.["image"]) ?? meta["og:image"] ?? null) ?? null;

  const storeName =
    readPartyName(firstObject(offers?.["seller"])) ??
    readPartyName(firstObject(structuredProduct?.["seller"])) ??
    readPartyName(firstObject(structuredProduct?.["brand"])) ??
    readString(structuredProduct?.["brand"]) ??
    null;

  if (!structuredProduct) {
    warnings.push(
      "A página não expôs JSON-LD de Product; a prévia foi montada somente com metadados públicos.",
    );
  }

  warnings.push(
    "Comissão, vendas e quantidade de criadores não são inferidas pelo scraper quando a página não fornece esses dados de forma estruturada.",
  );

  return {
    name: cleanText(name).slice(0, 500),
    description: description ? cleanText(description).slice(0, 5000) : null,
    imageUrl,
    originalUrl: finalUrl.toString(),
    price,
    currency,
    importPrice,
    storeName: storeName ? cleanText(storeName).slice(0, 500) : null,
    source: normalizeSource(payload.source, finalUrl.hostname),
    categorySlug: payload.categorySlug,
    extraction: structuredProduct ? "json-ld" : "metadata",
    warnings,
  };
}

async function fetchWithSafeRedirects(initialUrl: URL) {
  let current = initialUrl;

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": SCRAPER_USER_AGENT,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new ScraperError(
            502,
            "SCRAPER_INVALID_REDIRECT",
            "A página retornou um redirecionamento inválido.",
          );
        }
        if (attempt === MAX_REDIRECTS) {
          throw new ScraperError(
            508,
            "SCRAPER_TOO_MANY_REDIRECTS",
            "A página redirecionou vezes demais.",
          );
        }

        current = await validatePublicUrl(new URL(location, current).toString());
        await assertRobotsAllowed(current);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        throw new ScraperError(
          409,
          "SCRAPER_ACCESS_RESTRICTED",
          "A página exige acesso ou bloqueou a coleta. O scraper não tenta contornar essa proteção.",
        );
      }

      if (response.status === 429) {
        throw new ScraperError(
          429,
          "SCRAPER_RATE_LIMITED",
          "O site limitou as requisições. Aguarde antes de tentar novamente.",
        );
      }

      if (!response.ok) {
        throw new ScraperError(
          502,
          "SCRAPER_UPSTREAM_ERROR",
          `A página respondeu com HTTP ${response.status}.`,
        );
      }

      return { response, finalUrl: current };
    } catch (error) {
      if (error instanceof ScraperError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ScraperError(504, "SCRAPER_TIMEOUT", "A página demorou demais para responder.");
      }
      throw new ScraperError(
        502,
        "SCRAPER_FETCH_FAILED",
        "Não foi possível acessar a página pública informada.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ScraperError(508, "SCRAPER_TOO_MANY_REDIRECTS", "A página redirecionou vezes demais.");
}

async function assertRobotsAllowed(url: URL) {
  const robotsUrl = new URL("/robots.txt", url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROBOTS_TIMEOUT_MS);

  try {
    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      redirect: "manual",
      headers: { "User-Agent": SCRAPER_USER_AGENT, Accept: "text/plain" },
    });

    if (!response.ok) return;

    const text = (await response.text()).slice(0, 200_000);
    if (!robotsAllowsPath(text, url.pathname || "/")) {
      throw new ScraperError(
        409,
        "SCRAPER_ROBOTS_DISALLOWED",
        "O robots.txt desse site não permite coletar essa página.",
      );
    }
  } catch (error) {
    if (error instanceof ScraperError) throw error;
    // Falha ao consultar robots não é tratada como permissão para burlar bloqueios da página.
    // A própria requisição do conteúdo ainda respeita 401/403/429 e não usa cookies ou credenciais.
  } finally {
    clearTimeout(timeout);
  }
}

function robotsAllowsPath(text: string, pathname: string) {
  const lines = text.split(/\r?\n/);
  let groupApplies = false;
  let groupHasRules = false;
  let bestRule: { allow: boolean; length: number } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (groupHasRules) {
        groupApplies = false;
        groupHasRules = false;
      }

      if (value === "*" || value.toLowerCase().includes("radarshopai")) {
        groupApplies = true;
      }
      continue;
    }

    if (field !== "allow" && field !== "disallow") continue;
    groupHasRules = true;

    if (!groupApplies || !value) continue;

    if (pathname.startsWith(value) && (!bestRule || value.length > bestRule.length)) {
      bestRule = { allow: field === "allow", length: value.length };
    }
  }

  return bestRule?.allow ?? true;
}

async function validatePublicUrl(value: string) {
  if (!value || value.length > 2_000) {
    throw new ScraperError(400, "SCRAPER_INVALID_URL", "Informe uma URL pública válida.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ScraperError(400, "SCRAPER_INVALID_URL", "Informe uma URL pública válida.");
  }

  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    throw new ScraperError(
      400,
      "SCRAPER_INVALID_URL",
      "O scraper aceita somente URLs públicas HTTP/HTTPS sem credenciais.",
    );
  }

  if (
    (url.protocol === "https:" && url.port && url.port !== "443") ||
    (url.protocol === "http:" && url.port && url.port !== "80")
  ) {
    throw new ScraperError(
      400,
      "SCRAPER_UNSAFE_PORT",
      "Portas personalizadas não são aceitas pelo scraper administrativo.",
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new ScraperError(400, "SCRAPER_PRIVATE_HOST", "Endereços locais não são permitidos.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new ScraperError(400, "SCRAPER_PRIVATE_HOST", "Endereços privados não são permitidos.");
    }
    return url;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ScraperError(
      400,
      "SCRAPER_HOST_NOT_FOUND",
      "O domínio informado não pôde ser resolvido.",
    );
  }

  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new ScraperError(
      400,
      "SCRAPER_PRIVATE_HOST",
      "O domínio resolve para uma rede não pública.",
    );
  }

  return url;
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(":")) {
    const normalized = address.toLowerCase();
    if (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized)
    ) {
      return true;
    }

    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped?.[1] ? isPrivateAddress(mapped[1]) : false;
  }

  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return true;

  const a = octets[0]!;
  const b = octets[1]!;
  const c = octets[2]!;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function parsePayload(value: unknown): ScraperPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ScraperError(400, "SCRAPER_INVALID_PAYLOAD", "Os dados enviados são inválidos.");
  }

  const body = value as Record<string, unknown>;
  const action = body["action"];
  const url = typeof body["url"] === "string" ? body["url"].trim() : "";
  const source = typeof body["source"] === "string" ? body["source"].trim() || null : null;
  const categorySlug =
    typeof body["categorySlug"] === "string" ? body["categorySlug"].trim() || null : null;

  if (action !== "preview" && action !== "import") {
    throw new ScraperError(400, "SCRAPER_INVALID_ACTION", "A ação de raspagem é inválida.");
  }

  if (source && source.length > 120) {
    throw new ScraperError(
      400,
      "SCRAPER_INVALID_SOURCE",
      "A fonte deve ter no máximo 120 caracteres.",
    );
  }

  if (categorySlug && categorySlug.length > 120) {
    throw new ScraperError(400, "SCRAPER_INVALID_CATEGORY", "A categoria é inválida.");
  }

  return { action, url, source, categorySlug };
}

function findStructuredProduct(html: string): Record<string, unknown> | null {
  const scriptPattern =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const product = findProductNode(parsed);
      if (product) return product;
    } catch {
      continue;
    }
  }

  return null;
}

function findProductNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findProductNode(item);
      if (result) return result;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  const object = value as Record<string, unknown>;
  const type = object["@type"];
  const types = Array.isArray(type) ? type : [type];

  if (types.some((item) => typeof item === "string" && item.toLowerCase() === "product")) {
    return object;
  }

  if ("@graph" in object) {
    const graphResult = findProductNode(object["@graph"]);
    if (graphResult) return graphResult;
  }

  for (const child of Object.values(object)) {
    if (child && typeof child === "object") {
      const result = findProductNode(child);
      if (result) return result;
    }
  }

  return null;
}

function readMetadata(html: string) {
  const values: Record<string, string> = {};
  const metaPattern = /<meta\b[^>]*>/gi;

  for (const match of html.matchAll(metaPattern)) {
    const tag = match[0];
    const key = extractAttribute(tag, "property") ?? extractAttribute(tag, "name");
    const content = extractAttribute(tag, "content");
    if (key && content && !(key.toLowerCase() in values)) {
      values[key.toLowerCase()] = cleanText(content);
    }
  }

  return values;
}

function extractAttribute(tag: string, name: string) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(pattern);
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function readHtmlTitle(html: string) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? cleanText(match[1]) : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const item = value.find((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
    return item ? (item as Record<string, unknown>) : null;
  }

  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readImage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = readImage(item);
      if (image) return image;
    }
    return null;
  }
  const object = firstObject(value);
  return object ? (readString(object["url"]) ?? readString(object["contentUrl"])) : null;
}

function readPartyName(value: Record<string, unknown> | null) {
  return value ? readString(value["name"]) : null;
}

function readMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return null;

  const parsed = Number(
    normalized.includes(",") && !normalized.includes(".")
      ? normalized.replace(",", ".")
      : normalized.replace(/,/g, ""),
  );

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeCurrency(value: string | null) {
  if (!value) return null;
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function normalizeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeSource(value: string | null, hostname: string) {
  const raw = (value || hostname.replace(/^www\./, "")).trim();
  const source = raw.toLowerCase().startsWith("scraper:") ? raw : `scraper:${raw}`;
  return source.slice(0, 120);
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

class ScraperError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function scraperErrorResponse(error: unknown) {
  if (
    error instanceof ApiAuthError ||
    error instanceof ApiAdminError ||
    error instanceof RequestBodyError ||
    error instanceof ScraperError
  ) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }

  console.error("[RadarShop AI] admin scraper error", error);

  return Response.json(
    {
      error: "Não foi possível analisar essa página agora.",
      code: "SCRAPER_INTERNAL_ERROR",
    },
    { status: 500 },
  );
}
