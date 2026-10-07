import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MARKET_CONTENT_CACHE_TTL_MS,
  MARKET_CONTENT_PARTIAL_RETRY_MS,
  isMarketContentCacheFresh,
  nextMarketContentRefreshAt,
} from "../src/lib/product-market-content-policy.ts";

test("cache de mercado respeita TTL", () => {
  const now = Date.UTC(2026, 9, 7, 12, 0, 0);

  assert.equal(
    isMarketContentCacheFresh(new Date(now + 1000).toISOString(), now),
    true,
  );
  assert.equal(
    isMarketContentCacheFresh(new Date(now).toISOString(), now),
    false,
  );
  assert.equal(isMarketContentCacheFresh("inválido", now), false);
  assert.equal(isMarketContentCacheFresh(null, now), false);
});

test("próxima atualização usa 24h completa e 1h parcial", () => {
  const now = Date.UTC(2026, 9, 7, 12, 0, 0);

  assert.equal(
    Date.parse(nextMarketContentRefreshAt(false, now)) - now,
    MARKET_CONTENT_CACHE_TTL_MS,
  );
  assert.equal(
    Date.parse(nextMarketContentRefreshAt(true, now)) - now,
    MARKET_CONTENT_PARTIAL_RETRY_MS,
  );
});

test("migration 0012 mantém caches server-only com RLS", async () => {
  const sql = await readFile(
    new URL("../drizzle/migrations/0012_product_market_content.sql", import.meta.url),
    "utf8",
  );

  for (const table of [
    "product_related_videos",
    "product_related_creators",
    "product_market_enrichment_state",
  ]) {
    assert.match(
      sql,
      new RegExp("ALTER TABLE public\\." + table + " ENABLE ROW LEVEL SECURITY", "i"),
    );
    assert.match(
      sql,
      new RegExp(
        "REVOKE ALL ON TABLE public\\." + table + " FROM anon, authenticated",
        "i",
      ),
    );
    assert.match(
      sql,
      new RegExp(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\\." +
          table +
          " TO service_role",
        "i",
      ),
    );
  }
});
