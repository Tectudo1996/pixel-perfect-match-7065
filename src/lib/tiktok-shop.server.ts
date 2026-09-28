import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesInsert } from "@/integrations/supabase/types";

const TIKTOK_SHOP_API_BASE_URL = "https://open-api.tiktokglobalshop.com";
const TIKTOK_SHOP_AUTH_BASE_URL = "https://auth.tiktok-shops.com";
const TIKTOK_SHOP_CREATOR_AUTH_URL = "https://shop.tiktok.com/alliance/creator/auth";

type QueryValue = string | number | boolean | null | undefined;

export type TikTokShopConnectorStatus = {
  enabled: boolean;
  appKeyConfigured: boolean;
  appSecretConfigured: boolean;
  credentialsReady: boolean;
  tokenEncryptionReady: boolean;
  oauthReady: boolean;
};

export type TikTokShopTokenData = {
  access_token: string;
  refresh_token: string;
  open_id: string;
  user_type: number;
  granted_scopes?: Array<string | { scope: string }> | string;
  access_token_expires_in?: number;
  refresh_token_expires_in?: number;
  access_token_expire_in?: number;
  refresh_token_expire_in?: number;
  [key: string]: unknown;
};

type TikTokShopEnvelope<T> = {
  code: number;
  message?: string;
  request_id?: string;
  data?: T;
};

export class TikTokShopError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "TikTokShopError";
  }
}

export function getTikTokShopConnectorStatus(): TikTokShopConnectorStatus {
  const appKeyConfigured = hasEnv("TIKTOK_SHOP_APP_KEY");
  const appSecretConfigured = hasStrongSecret("TIKTOK_SHOP_APP_SECRET");

  const credentialsReady = appKeyConfigured && appSecretConfigured;
  const tokenEncryptionReady = isTikTokTokenEncryptionKeyValid();

  return {
    enabled: envFlag("TIKTOK_SHOP_AFFILIATE_ENABLED"),
    appKeyConfigured,
    appSecretConfigured,
    credentialsReady,
    tokenEncryptionReady,
    oauthReady: credentialsReady && tokenEncryptionReady,
  };
}

export function buildTikTokCreatorAuthorizationUrl(state: string) {
  const { appKey } = requireTikTokShopCredentials();

  if (!state.trim() || state.length < 16) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_INVALID_STATE",
      "O state de autorização do TikTok Shop precisa ser imprevisível e ter pelo menos 16 caracteres.",
      400,
    );
  }

  const url = new URL(TIKTOK_SHOP_CREATOR_AUTH_URL);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeTikTokCreatorAuthorizationCode(authCode: string) {
  const { appKey, appSecret } = requireTikTokShopCredentials();

  if (!authCode.trim()) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_AUTH_CODE_REQUIRED",
      "O código de autorização do TikTok Shop não foi informado.",
      400,
    );
  }

  return requestCreatorToken("/api/v2/token/get", {
    app_key: appKey,
    app_secret: appSecret,
    auth_code: authCode,
    grant_type: "authorized_code",
  });
}

export async function refreshTikTokCreatorAccessToken(refreshToken: string) {
  const { appKey, appSecret } = requireTikTokShopCredentials();

  if (!refreshToken.trim()) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_REFRESH_TOKEN_REQUIRED",
      "O refresh token do TikTok Shop não foi informado.",
      400,
    );
  }

  return requestCreatorToken("/api/v2/token/refresh", {
    app_key: appKey,
    app_secret: appSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

export function generateTikTokShopSignature({
  path,
  query,
  body,
  contentType = "application/json",
  appSecret,
}: {
  path: string;
  query: Record<string, QueryValue>;
  body?: string | null;
  contentType?: string;
  appSecret: string;
}) {
  if (!path.startsWith("/")) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_INVALID_PATH",
      "O caminho da API do TikTok Shop deve começar com '/'.",
      500,
    );
  }

  const paramString = Object.entries(query)
    .filter(
      ([key, value]) =>
        key !== "sign" && key !== "access_token" && value !== undefined && value !== null,
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${String(value)}`)
    .join("");

  const normalizedContentType = contentType.toLowerCase();
  const bodyString = body && !normalizedContentType.startsWith("multipart/form-data") ? body : "";
  const signString = `${appSecret}${path}${paramString}${bodyString}${appSecret}`;

  return createHmac("sha256", appSecret).update(signString).digest("hex");
}

export async function requestTikTokShopApi<T>({
  accessToken,
  path,
  method = "GET",
  query = {},
  body,
}: {
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
}): Promise<T> {
  const { appKey, appSecret } = requireTikTokShopCredentials();

  if (!accessToken.trim()) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_ACCESS_TOKEN_REQUIRED",
      "O access token do TikTok Shop não foi informado.",
      400,
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const bodyText = body === undefined ? null : JSON.stringify(body);
  const signedQuery: Record<string, QueryValue> = {
    ...query,
    app_key: appKey,
    timestamp,
  };
  const sign = generateTikTokShopSignature({
    path,
    query: signedQuery,
    body: bodyText,
    appSecret,
  });

  const url = new URL(path, TIKTOK_SHOP_API_BASE_URL);

  for (const [key, value] of Object.entries(signedQuery)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set("sign", sign);

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-tts-access-token": accessToken,
    },
    body: bodyText,
  });

  const payload = (await response.json().catch(() => null)) as TikTokShopEnvelope<T> | null;

  if (!response.ok) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_HTTP_ERROR",
      "O TikTok Shop respondeu com erro HTTP.",
      response.status,
      payload?.request_id,
    );
  }

  if (!payload || payload.code !== 0 || payload.data === undefined) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_API_ERROR",
      payload?.message || "O TikTok Shop não concluiu a operação.",
      502,
      payload?.request_id,
    );
  }

  return payload.data;
}

async function requestCreatorToken(path: string, query: Record<string, string>) {
  const url = new URL(path, TIKTOK_SHOP_AUTH_BASE_URL);

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { method: "GET" });
  const payload = (await response
    .json()
    .catch(() => null)) as TikTokShopEnvelope<TikTokShopTokenData> | null;

  if (!response.ok) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_AUTH_HTTP_ERROR",
      "Não foi possível concluir a autorização com o TikTok Shop.",
      response.status,
      payload?.request_id,
    );
  }

  if (!payload || payload.code !== 0 || !payload.data?.access_token) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_AUTH_FAILED",
      payload?.message || "O TikTok Shop não retornou um token válido.",
      502,
      payload?.request_id,
    );
  }

  if (payload.data.user_type !== 1) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_NOT_CREATOR",
      "A autorização retornada não pertence a uma conta Creator do TikTok Shop.",
      409,
      payload.request_id,
    );
  }

  return payload.data;
}

function requireTikTokShopCredentials() {
  const status = getTikTokShopConnectorStatus();

  if (!status.enabled) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_DISABLED",
      "A integração Affiliate do TikTok Shop está desativada neste ambiente.",
      503,
    );
  }

  const appKey = process.env["TIKTOK_SHOP_APP_KEY"]?.trim() ?? "";
  const appSecret = process.env["TIKTOK_SHOP_APP_SECRET"]?.trim() ?? "";

  if (!status.credentialsReady || !appKey || !appSecret) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_NOT_CONFIGURED",
      "As credenciais server-side do TikTok Shop ainda não estão configuradas.",
      503,
    );
  }

  return { appKey, appSecret };
}

export async function createTikTokCreatorAuthorization(userId: string) {
  requireTikTokTokenEncryptionKey();

  const state = randomBytes(32).toString("base64url");
  const stateHash = hashOAuthState(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("tiktok_shop_oauth_states").insert({
    state_hash: stateHash,
    user_id: userId,
    expires_at: expiresAt,
  });

  if (error) throw error;

  void supabaseAdmin
    .from("tiktok_shop_oauth_states")
    .delete()
    .lt("expires_at", new Date().toISOString());

  return {
    authorizationUrl: buildTikTokCreatorAuthorizationUrl(state),
    expiresAt,
  };
}

export async function completeTikTokCreatorAuthorization(state: string, authCode: string) {
  const userId = await consumeTikTokOAuthState(state);
  const tokenData = await exchangeTikTokCreatorAuthorizationCode(authCode);

  await saveTikTokShopConnection(userId, tokenData);

  return userId;
}

export async function getTikTokShopConnectionStatus(userId: string) {
  const connector = getTikTokShopConnectorStatus();

  if (!connector.enabled || !connector.oauthReady) {
    return {
      enabled: connector.enabled,
      configured: connector.oauthReady,
      connected: false,
      openId: null,
      userType: null,
      grantedScopes: [],
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      connectedAt: null,
      updatedAt: null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("tiktok_shop_connections")
    .select(
      "open_id,user_type,granted_scopes,access_token_expires_at,refresh_token_expires_at,connected_at,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    enabled: connector.enabled,
    configured: connector.oauthReady,
    connected: Boolean(data),
    openId: data?.open_id ?? null,
    userType: data?.user_type ?? null,
    grantedScopes: data?.granted_scopes ?? [],
    accessTokenExpiresAt: data?.access_token_expires_at ?? null,
    refreshTokenExpiresAt: data?.refresh_token_expires_at ?? null,
    connectedAt: data?.connected_at ?? null,
    updatedAt: data?.updated_at ?? null,
  };
}

export async function loadTikTokCreatorTokens(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("tiktok_shop_connections")
    .select("token_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_NOT_CONNECTED",
      "Nenhuma conta Creator do TikTok Shop está conectada.",
      404,
    );
  }

  return decryptTikTokTokens(data.token_ciphertext);
}

export async function getTikTokShowcaseProducts(
  userId: string,
  {
    origin = "SHOWCASE",
    pageSize = 20,
    pageToken,
  }: {
    origin?: "SHOWCASE" | "LIVE";
    pageSize?: number;
    pageToken?: string;
  } = {},
) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_INVALID_PAGE_SIZE",
      "O page_size do TikTok Shop precisa ficar entre 1 e 20.",
      400,
    );
  }

  await requireTikTokShopGrantedScope(userId, ["creator.showcase.read", "creator.video.write"]);

  const accessToken = await getValidTikTokCreatorAccessToken(userId);

  return requestTikTokShopApi<{
    products?: Array<Record<string, unknown>>;
    next_page_token?: string;
    total_count?: number;
    [key: string]: unknown;
  }>({
    accessToken,
    path: "/affiliate_creator/202405/showcases/products",
    method: "GET",
    query: {
      page_size: pageSize,
      origin,
      page_token: pageToken?.trim() || undefined,
    },
  });
}

type TikTokOpenCollaborationProduct = {
  id?: string;
  title?: string;
  detail_link?: string;
  main_image_url?: string;
  sale_region?: string;
  has_inventory?: boolean;
  units_sold?: number;
  shop?: {
    name?: string;
  };
  original_price?: TikTokMoneyRange;
  sales_price?: TikTokMoneyRange;
  commission?: {
    amount?: string;
    currency?: string;
    rate?: number;
  };
};

type TikTokMoneyRange = {
  currency?: string;
  minimum_amount?: string;
  maximum_amount?: string;
};

export async function getTikTokOpenCollaborationProductsByIds(
  userId: string,
  productIds: string[],
) {
  const normalizedIds = Array.from(new Set(productIds.map((id) => id.trim()).filter(Boolean)));

  if (!normalizedIds.length) {
    return { products: [] as TikTokOpenCollaborationProduct[] };
  }

  if (normalizedIds.length > 20) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_TOO_MANY_PRODUCT_IDS",
      "Consulte no máximo 20 produtos do TikTok Shop por lote.",
      400,
    );
  }

  await requireTikTokShopGrantedScope(userId, ["creator.affiliate_collaboration.read"]);
  const accessToken = await getValidTikTokCreatorAccessToken(userId);

  return requestTikTokShopApi<{
    products?: TikTokOpenCollaborationProduct[];
    [key: string]: unknown;
  }>({
    accessToken,
    path: "/affiliate_creator/202509/open_collaborations/products",
    method: "POST",
    query: {
      product_ids: normalizedIds.join(","),
    },
    body: {},
  });
}

export async function syncTikTokShowcasePrivateCache(
  userId: string,
  {
    origin = "SHOWCASE",
    maxPages = 5,
  }: {
    origin?: "SHOWCASE" | "LIVE";
    maxPages?: number;
  } = {},
) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 5) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_INVALID_MAX_PAGES",
      "A sincronização aceita entre 1 e 5 páginas por execução.",
      400,
    );
  }

  const rowsByProductId = new Map<string, TablesInsert<"user_tiktok_showcase_products">>();
  let pageToken: string | undefined;
  let showcaseItems = 0;
  let skipped = 0;
  let pagesRead = 0;
  const syncedAt = new Date().toISOString();

  for (let page = 0; page < maxPages; page += 1) {
    const showcase = await getTikTokShowcaseProducts(userId, {
      origin,
      pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    });
    pagesRead += 1;

    const ids = (showcase.products ?? [])
      .map((product) => readString(product, "id"))
      .filter((id): id is string => Boolean(id));

    showcaseItems += ids.length;

    if (ids.length) {
      const enriched = await getTikTokOpenCollaborationProductsByIds(userId, ids);

      for (const product of enriched.products ?? []) {
        const row = normalizeTikTokProductForPrivateCache(userId, product, syncedAt);

        if (!row) {
          skipped += 1;
          continue;
        }

        rowsByProductId.set(row.product_id, row);
      }
    }

    const next = readString(showcase, "next_page_token");
    if (!next) break;
    pageToken = next;
  }

  const rows = Array.from(rowsByProductId.values());

  if (rows.length) {
    const { error } = await supabaseAdmin
      .from("user_tiktok_showcase_products")
      .upsert(rows, { onConflict: "user_id,product_id" });

    if (error) throw error;
  }

  return {
    ok: true,
    pages_read: pagesRead,
    showcase_items: showcaseItems,
    saved: rows.length,
    skipped,
    synced_at: syncedAt,
  };
}

function normalizeTikTokProductForPrivateCache(
  userId: string,
  product: TikTokOpenCollaborationProduct,
  syncedAt: string,
): TablesInsert<"user_tiktok_showcase_products"> | null {
  const productId = product.id?.trim() ?? "";
  const title = product.title?.trim() ?? "";

  if (!productId || !title) return null;

  const priceRange = product.sales_price ?? product.original_price;
  const commissionRate = normalizeCommissionRate(product.commission?.rate);
  const unitsSold =
    Number.isInteger(product.units_sold) && (product.units_sold ?? -1) >= 0
      ? product.units_sold
      : null;

  return {
    user_id: userId,
    product_id: productId,
    title,
    detail_link: normalizeHttpUrl(product.detail_link),
    image_url: normalizeHttpUrl(product.main_image_url),
    shop_name: product.shop?.name?.trim() || null,
    sale_region: product.sale_region?.trim().toUpperCase() || null,
    currency: priceRange?.currency?.trim().toUpperCase() || null,
    minimum_price: parseNonNegativeMoney(priceRange?.minimum_amount),
    maximum_price: parseNonNegativeMoney(priceRange?.maximum_amount),
    commission_amount: parseNonNegativeMoney(product.commission?.amount),
    commission_currency: product.commission?.currency?.trim().toUpperCase() || null,
    commission_percent: commissionRate,
    units_sold: unitsSold,
    has_inventory: typeof product.has_inventory === "boolean" ? product.has_inventory : null,
    synced_at: syncedAt,
  };
}

function normalizeCommissionRate(rate: number | undefined) {
  if (rate === undefined || !Number.isFinite(rate) || rate < 0) return null;
  const percent = rate / 100;
  return percent <= 100 ? percent : null;
}

function parseNonNegativeMoney(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeHttpUrl(value: string | undefined) {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readString(value: unknown, key: string) {
  if (!value || typeof value !== "object") return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

async function requireTikTokShopGrantedScope(userId: string, acceptableScopes: string[]) {
  const { data, error } = await supabaseAdmin
    .from("tiktok_shop_connections")
    .select("granted_scopes")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_NOT_CONNECTED",
      "Nenhuma conta Creator do TikTok Shop está conectada.",
      404,
    );
  }

  const granted = new Set(data.granted_scopes);
  const allowed = acceptableScopes.some((scope) => granted.has(scope));

  if (!allowed) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_SCOPE_REQUIRED",
      "Sua autorização do TikTok Shop não concedeu acesso à vitrine. Reautorize a conta com o escopo necessário.",
      403,
    );
  }
}

export async function getValidTikTokCreatorAccessToken(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("tiktok_shop_connections")
    .select(
      "open_id,token_ciphertext,access_token_expires_at,refresh_token_expires_at,granted_scopes",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_NOT_CONNECTED",
      "Nenhuma conta Creator do TikTok Shop está conectada.",
      404,
    );
  }

  const tokens = decryptTikTokTokens(data.token_ciphertext);
  const now = Date.now();
  const refreshExpiresAt = data.refresh_token_expires_at
    ? new Date(data.refresh_token_expires_at).getTime()
    : null;

  if (refreshExpiresAt !== null && refreshExpiresAt <= now) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_REAUTH_REQUIRED",
      "A autorização do TikTok Shop expirou. Conecte sua conta novamente.",
      401,
    );
  }

  const accessExpiresAt = data.access_token_expires_at
    ? new Date(data.access_token_expires_at).getTime()
    : null;
  const refreshNeeded = accessExpiresAt === null || accessExpiresAt <= now + 5 * 60 * 1000;

  if (!refreshNeeded) return tokens.accessToken;

  const refreshed = await refreshTikTokCreatorAccessToken(tokens.refreshToken);

  if (refreshed.open_id !== data.open_id) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_IDENTITY_MISMATCH",
      "O TikTok Shop retornou uma identidade diferente durante o refresh.",
      409,
    );
  }

  const refreshedScopes = normalizeGrantedScopes(refreshed.granted_scopes);

  const { error: updateError } = await supabaseAdmin
    .from("tiktok_shop_connections")
    .update({
      user_type: refreshed.user_type,
      granted_scopes: refreshedScopes,
      token_ciphertext: encryptTikTokTokens({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
      }),
      access_token_expires_at: expirationFromSeconds(getTokenLifetimeSeconds(refreshed, "access")),
      refresh_token_expires_at: expirationFromSeconds(
        getTokenLifetimeSeconds(refreshed, "refresh"),
      ),
    })
    .eq("user_id", userId);

  if (updateError) throw updateError;

  return refreshed.access_token;
}

export async function disconnectTikTokShop(userId: string) {
  const { error } = await supabaseAdmin
    .from("tiktok_shop_connections")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;

  await supabaseAdmin.from("tiktok_shop_oauth_states").delete().eq("user_id", userId);
}

export function matchesTikTokShopAppKey(value: string | null) {
  if (!value) return true;
  const configured = process.env["TIKTOK_SHOP_APP_KEY"]?.trim() ?? "";
  return Boolean(configured) && value === configured;
}

async function consumeTikTokOAuthState(state: string) {
  if (!state.trim()) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_INVALID_STATE",
      "O state da autorização do TikTok Shop é inválido ou expirou.",
      400,
    );
  }

  const stateHash = hashOAuthState(state);
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("tiktok_shop_oauth_states")
    .update({ consumed_at: now })
    .eq("state_hash", stateHash)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("user_id")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_INVALID_STATE",
      "O state da autorização do TikTok Shop é inválido ou expirou.",
      400,
    );
  }

  return data.user_id;
}

async function saveTikTokShopConnection(userId: string, tokenData: TikTokShopTokenData) {
  const grantedScopes = normalizeGrantedScopes(tokenData.granted_scopes);
  const tokenCiphertext = encryptTikTokTokens({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
  });

  const { error } = await supabaseAdmin.from("tiktok_shop_connections").upsert(
    {
      user_id: userId,
      open_id: tokenData.open_id,
      user_type: tokenData.user_type,
      granted_scopes: grantedScopes,
      token_ciphertext: tokenCiphertext,
      access_token_expires_at: expirationFromSeconds(getTokenLifetimeSeconds(tokenData, "access")),
      refresh_token_expires_at: expirationFromSeconds(
        getTokenLifetimeSeconds(tokenData, "refresh"),
      ),
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

function normalizeGrantedScopes(scopes: TikTokShopTokenData["granted_scopes"]) {
  if (!scopes) return [];
  if (typeof scopes === "string") {
    return scopes
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  return scopes
    .map((scope) => (typeof scope === "string" ? scope : scope.scope))
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function getTokenLifetimeSeconds(tokenData: TikTokShopTokenData, type: "access" | "refresh") {
  if (type === "access") {
    return tokenData.access_token_expires_in ?? tokenData.access_token_expire_in;
  }

  return tokenData.refresh_token_expires_in ?? tokenData.refresh_token_expire_in;
}

function expirationFromSeconds(seconds: number | undefined) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

function encryptTikTokTokens(tokens: { access_token: string; refresh_token: string }) {
  const key = requireTikTokTokenEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function decryptTikTokTokens(ciphertext: string) {
  const [version, ivEncoded, tagEncoded, dataEncoded] = ciphertext.split(".");

  if (version !== "v1" || !ivEncoded || !tagEncoded || !dataEncoded) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_TOKEN_STORAGE_INVALID",
      "O armazenamento seguro do TikTok Shop está inválido.",
      500,
    );
  }

  try {
    const key = requireTikTokTokenEncryptionKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    const parsed = JSON.parse(plaintext) as {
      access_token?: unknown;
      refresh_token?: unknown;
    };

    if (typeof parsed.access_token !== "string" || typeof parsed.refresh_token !== "string") {
      throw new Error("invalid token payload");
    }

    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
    };
  } catch (error) {
    if (error instanceof TikTokShopError) throw error;
    throw new TikTokShopError(
      "TIKTOK_SHOP_TOKEN_DECRYPT_FAILED",
      "Não foi possível abrir as credenciais armazenadas do TikTok Shop.",
      500,
    );
  }
}

export function normalizeTikTokShopError(error: unknown) {
  if (error instanceof TikTokShopError) return error;

  console.error("[RadarShop AI] TikTok Shop integration error", error);
  return new TikTokShopError(
    "TIKTOK_SHOP_INTERNAL_ERROR",
    "Não foi possível concluir a operação com o TikTok Shop.",
    500,
  );
}

function isTikTokTokenEncryptionKeyValid() {
  const raw = process.env["TIKTOK_SHOP_TOKEN_ENCRYPTION_KEY"]?.trim() ?? "";
  if (!raw) return false;

  try {
    return Buffer.from(raw, "base64").length === 32;
  } catch {
    return false;
  }
}

function requireTikTokTokenEncryptionKey() {
  const raw = process.env["TIKTOK_SHOP_TOKEN_ENCRYPTION_KEY"]?.trim() ?? "";

  if (!raw) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_ENCRYPTION_NOT_CONFIGURED",
      "A chave de criptografia dos tokens do TikTok Shop não está configurada.",
      503,
    );
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new TikTokShopError(
      "TIKTOK_SHOP_ENCRYPTION_KEY_INVALID",
      "A chave de criptografia do TikTok Shop precisa conter exatamente 32 bytes em base64.",
      503,
    );
  }

  return key;
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

function hasStrongSecret(name: string) {
  const value = process.env[name]?.trim() ?? "";
  return value.length >= 16 && !/^(replace|your-|example|changeme)/i.test(value);
}

function envFlag(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}
