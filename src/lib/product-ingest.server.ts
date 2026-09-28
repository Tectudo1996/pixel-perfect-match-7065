import { timingSafeEqual } from "node:crypto";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  source: string;
  data_updated_at: string;
};

export async function handleProductIngestRequest(request: Request) {
  try {
    authorizeIngestion(request);

    const body = productIngestRequestSchema.parse(await request.json());
    assertUniqueUrls(body);
    const result = await ingestProducts(body);

    return Response.json(result, { status: 200 });
  } catch (error) {
    const normalized = normalizeError(error);

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

async function ingestProducts(body: ProductIngestRequest) {
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

  const existingByUrl = new Map(
    (existingRows ?? [])
      .filter((row): row is typeof row & { original_url: string } => Boolean(row.original_url))
      .map((row) => [row.original_url, row.id]),
  );

  const inserts: TablesInsert<"products">[] = [];
  const updates: Array<{ id: string; values: TablesUpdate<"products"> }> = [];

  for (const product of body.products) {
    const existingId = existingByUrl.get(product.original_url);

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
      .select("id,price,commission_amount,sales_count,creators_count,source,data_updated_at");

    if (error) throw error;
    snapshots.push(...((data ?? []) as ProductSnapshot[]));
  }

  for (const update of updates) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .update(update.values)
      .eq("id", update.id)
      .select("id,price,commission_amount,sales_count,creators_count,source,data_updated_at")
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

  console.error("[RadarShop AI] product ingestion error", error);

  if (error instanceof Error && error.name === "ZodError") {
    return new ApiError(400, "INVALID_PAYLOAD", "O lote enviado possui campos inválidos.");
  }

  return new ApiError(500, "INGEST_INTERNAL_ERROR", "Não foi possível processar o lote agora.");
}
