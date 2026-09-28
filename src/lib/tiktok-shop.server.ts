import { createHmac } from "node:crypto";

const TIKTOK_SHOP_API_BASE_URL = "https://open-api.tiktokglobalshop.com";
const TIKTOK_SHOP_AUTH_BASE_URL = "https://auth.tiktok-shops.com";
const TIKTOK_SHOP_CREATOR_AUTH_URL = "https://shop.tiktok.com/alliance/creator/auth";

type QueryValue = string | number | boolean | null | undefined;

export type TikTokShopConnectorStatus = {
  enabled: boolean;
  appKeyConfigured: boolean;
  appSecretConfigured: boolean;
  credentialsReady: boolean;
};

export type TikTokShopTokenData = {
  access_token: string;
  refresh_token: string;
  open_id: string;
  user_type: number;
  granted_scopes?: string[] | string;
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

  return {
    enabled: envFlag("TIKTOK_SHOP_AFFILIATE_ENABLED"),
    appKeyConfigured,
    appSecretConfigured,
    credentialsReady: appKeyConfigured && appSecretConfigured,
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
    body: bodyText ?? undefined,
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
