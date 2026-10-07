import { timingSafeEqual } from "node:crypto";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { readJsonBody, RequestBodyError } from "@/lib/request-body.server";
import {
  productIngestRequestSchema,
  type ProductIngestItem,
  type ProductIngestRequest,
} from "@/lib/product-ingest-schema";

type ProductSnapshot = {
  id: string;
  price: number | null;
  commission_amount: number | null;
  sales_count: number | null;
  creators_count: number | null;
  commission_percent: number | null;
  currency: string | null;
  sales_7d: number | null;
  gmv_7d: number | null;
  gmv_total: number | null;
  video_count: number | null;
  source: string;
  data_updated_at: string;
};

const SNAPSHOT_COLUMNS =
  "id,price,commission_amount,commission_percent,currency,sales_7d,gmv_7d,gmv_total,video_count,sales_count,creators_count,source,data_updated_at";

export async function handleProductIngestRequest(request: Request) {
  let ingestionRunId: string | null = null;

  try {
    authorizeIngestion(request);

    const body = productIngestRequestSchema.parse(await readJsonBody(request, 1_048_576));
    assertUniqueUrls(body);

    ingestionRunId = await startIngestionRun({
      source: body.source,
      channel: "api",
      accepted_count: body.products.length,
      collected_at: body.collected_at ?? null,
    });

    const result = await ingestProductBatch(body);

    await finishIngestionRun(ingestionRunId, {
      status: "succeeded",
      accepted_count: result.accepted,
      inserted_count: result.inserted,
      updated_count: result.updated,
      snapshot_count: result.metric_snapshots,
      collected_at: result.collected_at,
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    const normalized = normalizeError(error);

    await finishIngestionRun(ingestionRunId, {
      status: "failed",
      error_code: normalized.code,
      error_message: normalized.message,
    });

    return Response.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}

function authorizeIngestion(request: Request) {
  const expected = process.env["PRODUCT_INGEST_SECRET"];

  if (!expected) {
    throw new ApiError(
      503,
      "INGEST_NOT_CONFIGURED",
      "A ingestão externa ainda não está configurada neste ambiente.",
    );
  }

  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!supplied || !safeSecretEquals(expected, supplied)) {
    throw new ApiError(401, "INGEST_UNAUTHORIZED", "Credencial de ingestão inválida.");
  }
}

function safeSecretEquals(expected: string, supplied: string) {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  if (expectedBuffer.length !== suppliedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function assertUniqueUrls(body: ProductIngestRequest) {
  const seen = new Set<string>();

  for (const product of body.products) {
    if (seen.has(product.original_url)) {
      throw new ApiError(
        400,
        "DUPLICATE_PRODUCT",
        `O lote contém a URL duplicada: ${product.original_url}`,
      );
    }

    seen.add(product.original_url);
  }
}

export async function ingestProductBatch(body: ProductIngestRequest) {
  const collectedAt = body.collected_at ?? new Date().toISOString();
  const categorySlugs = Array.from(
    new Set(
      body.products
        .map((product) => product.category_slug)
        .filter((slug): slug is string => Boolean(slug)),
    ),
  );

  const categoryBySlug = new Map<string, string>();

  if (categorySlugs.length) {
    const { data, error } = await supabaseAdmin
      .from("categories")
      .select("id,slug")
      .in("slug", categorySlugs);

    if (error) throw error;

    for (const category of data ?? []) {
      categoryBySlug.set(category.slug, category.id);
    }

    const unknown = categorySlugs.filter((slug) => !categoryBySlug.has(slug));

    if (unknown.length) {
      throw new ApiError(
        400,
        "UNKNOWN_CATEGORY",
        `Categorias não cadastradas: ${unknown.join(", ")}`,
      );
    }
  }

  const urls = body.products.map((product) => product.original_url);
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("products")
    .select("id,original_url")
    .eq("source", body.source)
    .in("original_url", urls);

  if (existingError) throw existingError;

  const externalIds = body.products
    .map((product) => product.external_id)
    .filter((id): id is string => Boolean(id));
  const existingByExternalId = new Map<string, string>();

  if (externalIds.length) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id,external_id")
      .eq("source", body.source)
      .in("external_id", externalIds);

    if (error) throw error;
    for (const row of data ?? []) {
      if (row.external_id) existingByExternalId.set(row.external_id, row.id);
    }
  }

  const existingByUrl = new Map(
    (existingRows ?? [])
      .filter((row): row is typeof row & { original_url: string } => Boolean(row.original_url))
      .map((row) => [row.original_url, row.id]),
  );

  const inserts: TablesInsert<"products">[] = [];
  const updates: Array<{ id: string; values: TablesUpdate<"products"> }> = [];

  for (const product of body.products) {
    const existingId =
      (product.external_id ? existingByExternalId.get(product.external_id) : undefined) ??
      existingByUrl.get(product.original_url);

    if (existingId) {
      updates.push({
        id: existingId,
        values: buildUpdate(product, body.source, collectedAt, categoryBySlug),
      });
    } else {
      inserts.push(buildInsert(product, body.source, collectedAt, categoryBySlug));
    }
  }

  const snapshots: ProductSnapshot[] = [];

  if (inserts.length) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .insert(inserts)
      .select(SNAPSHOT_COLUMNS);

    if (error) throw error;
    snapshots.push(...((data ?? []) as ProductSnapshot[]));
  }

  for (const update of updates) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .update(update.values)
      .eq("id", update.id)
      .select(SNAPSHOT_COLUMNS)
      .single();

    if (error) throw error;
    snapshots.push(data as ProductSnapshot);
  }

  if (snapshots.length) {
    const { error } = await supabaseAdmin.from("product_metrics_history").insert(
      snapshots.map((product) => ({
        product_id: product.id,
        price: product.price,
        commission_amount: product.commission_amount,
        sales_count: product.sales_count,
        creators_count: product.creators_count,
        commission_percent: product.commission_percent,
        currency: product.currency,
        sales_7d: product.sales_7d,
        gmv_7d: product.gmv_7d,
        gmv_total: product.gmv_total,
        video_count: product.video_count,
        source: product.source,
        recorded_at: product.data_updated_at,
      })),
    );

    if (error) throw error;
  }

  return {
    ok: true,
    source: body.source,
    collected_at: collectedAt,
    accepted: body.products.length,
    inserted: inserts.length,
    updated: updates.length,
    metric_snapshots: snapshots.length,
  };
}

export async function startIngestionRun(
  values: Pick<
    TablesInsert<"ingestion_runs">,
    "source" | "channel" | "accepted_count" | "collected_at"
  >,
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("ingestion_runs")
      .insert(values)
      .select("id")
      .single();

    if (error) {
      console.warn("[RadarShop AI] ingestion history unavailable", error.message);
      return null;
    }

    return data.id;
  } catch (error) {
    console.warn("[RadarShop AI] ingestion history unavailable", error);
    return null;
  }
}

export async function finishIngestionRun(
  id: string | null,
  values: TablesUpdate<"ingestion_runs">,
) {
  if (!id) return;

  try {
    const { error } = await supabaseAdmin
      .from("ingestion_runs")
      .update({
        ...values,
        finished_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.warn("[RadarShop AI] ingestion history update failed", error.message);
    }
  } catch (error) {
    console.warn("[RadarShop AI] ingestion history update failed", error);
  }
}

function buildInsert(
  product: ProductIngestItem,
  source: string,
  collectedAt: string,
  categoryBySlug: Map<string, string>,
): TablesInsert<"products"> {
  return {
    name: product.name,
    description: product.description ?? null,
    image_url: product.image_url ?? null,
    category_id: product.category_slug ? (categoryBySlug.get(product.category_slug) ?? null) : null,
    price: product.price ?? null,
    commission_amount: product.commission_amount ?? null,
    commission_percent: product.commission_percent ?? null,
    store_name: product.store_name ?? null,
    original_url: product.original_url,
    sales_count: product.sales_count ?? null,
    creators_count: product.creators_count ?? null,
    external_id: product.external_id ?? null,
    region: product.region ?? null,
    currency: product.currency ?? null,
    sales_7d: product.sales_7d ?? null,
    gmv_7d: product.gmv_7d ?? null,
    gmv_total: product.gmv_total ?? null,
    video_count: product.video_count ?? null,
    data_provenance: product.data_provenance ?? null,
    source,
    is_demo: false,
    identified_at: collectedAt,
    data_updated_at: collectedAt,
  };
}

function buildUpdate(
  product: ProductIngestItem,
  source: string,
  collectedAt: string,
  categoryBySlug: Map<string, string>,
): TablesUpdate<"products"> {
  const values: TablesUpdate<"products"> = {
    name: product.name,
    original_url: product.original_url,
    source,
    data_updated_at: collectedAt,
    is_demo: false,
  };

  assignIfPresent(values, "description", product, "description", (value) => value ?? null);
  assignIfPresent(values, "image_url", product, "image_url", (value) => value ?? null);
  assignIfPresent(values, "price", product, "price", (value) => value ?? null);
  assignIfPresent(
    values,
    "commission_amount",
    product,
    "commission_amount",
    (value) => value ?? null,
  );
  assignIfPresent(
    values,
    "commission_percent",
    product,
    "commission_percent",
    (value) => value ?? null,
  );
  assignIfPresent(values, "store_name", product, "store_name", (value) => value ?? null);
  assignIfPresent(values, "sales_count", product, "sales_count", (value) => value ?? null);
  assignIfPresent(values, "creators_count", product, "creators_count", (value) => value ?? null);
  for (const key of [
    "external_id",
    "region",
    "currency",
    "sales_7d",
    "gmv_7d",
    "gmv_total",
    "video_count",
    "data_provenance",
  ] as const) {
    assignIfPresent(values, key, product, key, (value) => (value ?? null) as never);
  }

  if ("category_slug" in product) {
    values.category_id = product.category_slug
      ? (categoryBySlug.get(product.category_slug) ?? null)
      : null;
  }

  return values;
}

function assignIfPresent<
  K extends keyof TablesUpdate<"products">,
  S extends keyof ProductIngestItem,
>(
  target: TablesUpdate<"products">,
  targetKey: K,
  source: ProductIngestItem,
  sourceKey: S,
  transform: (value: ProductIngestItem[S]) => TablesUpdate<"products">[K],
) {
  if (sourceKey in source) {
    target[targetKey] = transform(source[sourceKey]);
  }
}

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function normalizeError(error: unknown) {
  if (error instanceof ApiError) return error;
  if (error instanceof RequestBodyError) {
    return new ApiError(error.status, error.code, error.message);
  }

  console.error("[RadarShop AI] product ingestion error", error);

  if (error instanceof Error && error.name === "ZodError") {
    return new ApiError(400, "INVALID_PAYLOAD", "O lote enviado possui campos inválidos.");
  }

  return new ApiError(500, "INGEST_INTERNAL_ERROR", "Não foi possível processar o lote agora.");
}

export async function handleFastmossSyncRequest(request: Request) {
  const { requireApiAdmin, ApiAuthError, ApiAdminError } = await import("@/lib/api-auth.server");
  const { searchFastmossTopProducts, FastmossError } = await import("@/lib/fastmoss.server");
  let ingestionRunId: string | null = null;

  try {
    const userId = await requireApiAdmin(request);
    const raw = (await readJsonBody(request, 4096).catch(() => ({}))) as {
      provider?: unknown;
      region?: unknown;
      pageSize?: unknown;
    };
    if (raw.provider !== undefined && raw.provider !== "fastmoss") {
      throw new ApiError(400, "UNSUPPORTED_PROVIDER", "Provedor de sincronização não suportado.");
    }
    const region =
      typeof raw.region === "string" && /^[A-Za-z]{2}$/.test(raw.region)
        ? raw.region.toUpperCase()
        : (process.env["FASTMOSS_DEFAULT_REGION"] || "BR").toUpperCase();
    if (region !== "BR") {
      throw new ApiError(400, "UNSUPPORTED_REGION", "Nesta etapa apenas o mercado BR é suportado.");
    }
    const pageSize = Math.min(Math.max(Number(raw.pageSize) || 100, 1), 100);

    const result = await searchFastmossTopProducts({ region, pageSize });
    ingestionRunId = await startIngestionRun({
      source: result.source,
      channel: "api",
      accepted_count: result.products.length,
      collected_at: new Date().toISOString(),
    });
    if (ingestionRunId) {
      await supabaseAdmin
        .from("ingestion_runs")
        .update({ created_by: userId })
        .eq("id", ingestionRunId);
    }

    if (!result.products.length) {
      throw new ApiError(502, "FASTMOSS_EMPTY", "A FastMoss não retornou produtos válidos.");
    }

    const body = productIngestRequestSchema.parse({
      source: result.source,
      products: result.products,
    });
    const ingest = await ingestProductBatch(body);

    await finishIngestionRun(ingestionRunId, {
      status: "succeeded",
      accepted_count: ingest.accepted,
      inserted_count: ingest.inserted,
      updated_count: ingest.updated,
      snapshot_count: ingest.metric_snapshots,
      collected_at: ingest.collected_at,
    });

    return Response.json({ ...ingest, provider: "fastmoss", region, received: result.received });
  } catch (error) {
    let normalized: ApiError;
    if (error instanceof ApiAuthError || error instanceof ApiAdminError) {
      normalized = new ApiError(error.status, error.code, error.message);
    } else if (error instanceof FastmossError) {
      normalized = new ApiError(error.status, error.code, error.message);
    } else {
      normalized = normalizeError(error);
    }

    await finishIngestionRun(ingestionRunId, {
      status: "failed",
      error_code: normalized.code,
      error_message: normalized.message,
    });

    return Response.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
