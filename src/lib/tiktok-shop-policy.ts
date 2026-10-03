import { createHmac } from "node:crypto";

export type TikTokShopQueryValue = string | number | boolean | null | undefined;

export type TikTokGrantedScopes = Array<string | { scope: string }> | string | undefined;

export type TikTokTokenLifetimeInput = {
  access_token_expires_in?: number;
  refresh_token_expires_in?: number;
  access_token_expire_in?: number;
  refresh_token_expire_in?: number;
};

export function createTikTokShopRequestSignature({
  path,
  query,
  body,
  contentType = "application/json",
  appSecret,
}: {
  path: string;
  query: Record<string, TikTokShopQueryValue>;
  body?: string | null;
  contentType?: string;
  appSecret: string;
}) {
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

export function normalizeTikTokCommissionRate(rate: number | undefined) {
  if (rate === undefined || !Number.isFinite(rate) || rate < 0) return null;

  const percent = rate / 100;
  return percent <= 100 ? percent : null;
}

export function parseTikTokNonNegativeMoney(value: string | undefined) {
  if (!value?.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeTikTokHttpUrl(value: string | undefined) {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeTikTokGrantedScopes(scopes: TikTokGrantedScopes) {
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

export function getTikTokTokenLifetimeSeconds(
  tokenData: TikTokTokenLifetimeInput,
  type: "access" | "refresh",
) {
  if (type === "access") {
    return tokenData.access_token_expires_in ?? tokenData.access_token_expire_in;
  }

  return tokenData.refresh_token_expires_in ?? tokenData.refresh_token_expire_in;
}
