export const MARKET_CONTENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MARKET_CONTENT_PARTIAL_RETRY_MS = 60 * 60 * 1000;

export function isMarketContentCacheFresh(
  nextRefreshAt: string | null | undefined,
  now = Date.now(),
) {
  if (!nextRefreshAt) return false;

  const parsed = Date.parse(nextRefreshAt);
  return Number.isFinite(parsed) && parsed > now;
}

export function nextMarketContentRefreshAt(
  partial: boolean,
  now = Date.now(),
) {
  return new Date(
    now + (partial ? MARKET_CONTENT_PARTIAL_RETRY_MS : MARKET_CONTENT_CACHE_TTL_MS),
  ).toISOString();
}
