import assert from "node:assert/strict";
import test from "node:test";

import {
  currencyForRegion,
  httpUrl,
  nonNegativeNumber,
  normalizeFastmossProduct,
  parsePercent,
  tiktokProductUrl,
} from "../src/lib/fastmoss-normalize.ts";

test("percentual '12.5%' vira 12.5", () => {
  assert.equal(parsePercent("12.5%"), 12.5);
  assert.equal(parsePercent("abc"), null);
  assert.equal(parsePercent("150%"), null);
  assert.equal(parsePercent(null), null);
});

test("números não negativos", () => {
  assert.equal(nonNegativeNumber("1234.5"), 1234.5);
  assert.equal(nonNegativeNumber(-1), null);
  assert.equal(nonNegativeNumber(undefined), null);
});

test("URL aceita apenas http/https", () => {
  assert.equal(httpUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(httpUrl("javascript:alert(1)"), null);
  assert.equal(httpUrl("ftp://x.com"), null);
});

test("fallback de URL TikTok", () => {
  assert.equal(tiktokProductUrl("123", "BR", ""), "https://shop.tiktok.com/view/product/123?region=BR");
});

test("BR usa BRL e métricas faltantes viram null", () => {
  assert.equal(currencyForRegion("BR"), "BRL");
  const item = normalizeFastmossProduct({ product_id: "9", title: "Item", commission_rate: "10%" }, "BR");
  assert.ok(item);
  assert.equal(item.currency, "BRL");
  assert.equal(item.commission_percent, 10);
  assert.equal(item.gmv_7d, null);
  assert.equal(item.data_provenance, "third_party_market_intelligence");
  assert.equal(normalizeFastmossProduct({ title: "sem id" }, "BR"), null);
});
