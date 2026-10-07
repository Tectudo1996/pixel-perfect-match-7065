import assert from "node:assert/strict";
import test from "node:test";

import {
  binaryFlag,
  currencyForRegion,
  httpUrl,
  nonNegativeNumber,
  normalizeFastmossCreator,
  normalizeFastmossProduct,
  normalizeFastmossVideo,
  parsePercent,
  timestampToIso,
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
  assert.equal(
    tiktokProductUrl("123", "BR", ""),
    "https://shop.tiktok.com/view/product/123?region=BR",
  );
});

test("BR usa BRL e métricas faltantes viram null", () => {
  assert.equal(currencyForRegion("BR"), "BRL");
  const item = normalizeFastmossProduct(
    { product_id: "9", title: "Item", commission_rate: "10%" },
    "BR",
  );
  assert.ok(item);
  assert.equal(item.currency, "BRL");
  assert.equal(item.commission_percent, 10);
  assert.equal(item.gmv_7d, null);
  assert.equal(item.data_provenance, "third_party_market_intelligence");
  assert.equal(normalizeFastmossProduct({ title: "sem id" }, "BR"), null);
});

test("flag de anúncio aceita somente 0/1", () => {
  assert.equal(binaryFlag(1), true);
  assert.equal(binaryFlag("1"), true);
  assert.equal(binaryFlag(0), false);
  assert.equal(binaryFlag("0"), false);
  assert.equal(binaryFlag(2), null);
});

test("timestamp FastMoss aceita segundos e milissegundos", () => {
  const milliseconds = 1765024218000;
  const expected = new Date(milliseconds).toISOString();

  assert.equal(timestampToIso(milliseconds), expected);
  assert.equal(timestampToIso(milliseconds / 1000), expected);
  assert.equal(timestampToIso("inválido"), null);
});

test("normaliza vídeo associado sem inventar métricas", () => {
  const video = normalizeFastmossVideo({
    video_id: "7468186866076880170",
    uid: "6790997286808093702",
    is_ad: 1,
    play_count: 4592,
    units_sold: 28,
    gmv: 700,
    region: "br",
    create_time: 1765024218000,
    video: {
      video_desc: "Teste",
      cover: "https://example.com/cover.jpg",
      duration: 12,
      tiktok_url: "https://www.tiktok.com/@teste/video/7468186866076880170",
    },
  });

  assert.ok(video);
  assert.equal(video.externalVideoId, "7468186866076880170");
  assert.equal(video.isAd, true);
  assert.equal(video.unitsSold, 28);
  assert.equal(video.gmv, 700);
  assert.equal(video.region, "BR");
  assert.equal(video.commentCount, null);
  assert.equal(video.durationSeconds, 12);
  assert.equal(
    normalizeFastmossVideo({ uid: "sem-video-id" }),
    null,
  );
});

test("normaliza criador associado", () => {
  const creator = normalizeFastmossCreator({
    uid: "6893103660525831169",
    unique_id: "twobakeboys",
    nickname: "Twobakeboys",
    avatar: "https://example.com/avatar.jpg",
    units_sold: 1354,
    gmv: 22034.6,
    follower_count: 22572,
    aweme_count: 510,
    region: "br",
  });

  assert.ok(creator);
  assert.equal(creator.creatorUid, "6893103660525831169");
  assert.equal(creator.uniqueId, "twobakeboys");
  assert.equal(creator.unitsSold, 1354);
  assert.equal(creator.gmv, 22034.6);
  assert.equal(creator.region, "BR");
  assert.equal(normalizeFastmossCreator({ nickname: "sem uid" }), null);
});
