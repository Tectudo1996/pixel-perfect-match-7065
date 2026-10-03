import assert from "node:assert/strict";
import test from "node:test";

import {
  createTikTokShopRequestSignature,
  getTikTokTokenLifetimeSeconds,
  normalizeTikTokCommissionRate,
  normalizeTikTokGrantedScopes,
  normalizeTikTokHttpUrl,
  parseTikTokNonNegativeMoney,
} from "../src/lib/tiktok-shop-policy.ts";

test("assinatura TikTok usa ordenação canônica e ignora sign e access_token", () => {
  const signature = createTikTokShopRequestSignature({
    path: "/affiliate_creator/202405/open_collaborations/products/search",
    query: {
      timestamp: 1_700_000_000,
      access_token: "nao-deve-entrar-na-assinatura",
      page_size: 20,
      app_key: "abc",
      sign: "tambem-deve-ser-ignorado",
    },
    body: '{"keyword":"dress"}',
    appSecret: "test_secret_123",
  });

  assert.equal(signature, "57935316d532e461a6d9deb6be0598ce2295cad3ebe209f111b5b1182194d1d0");
});

test("assinatura TikTok não depende da ordem original dos parâmetros", () => {
  const first = createTikTokShopRequestSignature({
    path: "/affiliate_creator/202405/open_collaborations/products/search",
    query: {
      app_key: "abc",
      page_size: 20,
      timestamp: 1_700_000_000,
    },
    body: '{"keyword":"dress"}',
    appSecret: "test_secret_123",
  });

  const second = createTikTokShopRequestSignature({
    path: "/affiliate_creator/202405/open_collaborations/products/search",
    query: {
      timestamp: 1_700_000_000,
      page_size: 20,
      app_key: "abc",
    },
    body: '{"keyword":"dress"}',
    appSecret: "test_secret_123",
  });

  assert.equal(first, second);
});

test("assinatura multipart não inclui o corpo", () => {
  const signature = createTikTokShopRequestSignature({
    path: "/affiliate_creator/202405/open_collaborations/products/search",
    query: {
      app_key: "abc",
      page_size: 20,
      timestamp: 1_700_000_000,
    },
    body: "conteudo-binario-simulado",
    contentType: "multipart/form-data; boundary=radar",
    appSecret: "test_secret_123",
  });

  assert.equal(signature, "7f87e7a04ed0e973aae6633c807e4792601badf44a3bf6fd21544ed08e6966b6");
});

test("taxa de comissão TikTok é convertida para percentual válido", () => {
  assert.equal(normalizeTikTokCommissionRate(1_000), 10);
  assert.equal(normalizeTikTokCommissionRate(10_000), 100);
  assert.equal(normalizeTikTokCommissionRate(0), 0);
  assert.equal(normalizeTikTokCommissionRate(10_001), null);
  assert.equal(normalizeTikTokCommissionRate(-1), null);
  assert.equal(normalizeTikTokCommissionRate(Number.NaN), null);
  assert.equal(normalizeTikTokCommissionRate(undefined), null);
});

test("valores monetários TikTok aceitam somente números finitos e não negativos", () => {
  assert.equal(parseTikTokNonNegativeMoney("19.90"), 19.9);
  assert.equal(parseTikTokNonNegativeMoney("0"), 0);
  assert.equal(parseTikTokNonNegativeMoney(" 7.50 "), 7.5);
  assert.equal(parseTikTokNonNegativeMoney("-1"), null);
  assert.equal(parseTikTokNonNegativeMoney("Infinity"), null);
  assert.equal(parseTikTokNonNegativeMoney("1,50"), null);
  assert.equal(parseTikTokNonNegativeMoney(""), null);
  assert.equal(parseTikTokNonNegativeMoney(undefined), null);
});

test("URLs de produto TikTok aceitam apenas HTTP e HTTPS", () => {
  assert.equal(normalizeTikTokHttpUrl("https://shop.example.com/p/1"), "https://shop.example.com/p/1");
  assert.equal(normalizeTikTokHttpUrl("http://shop.example.com/p/1"), "http://shop.example.com/p/1");
  assert.equal(normalizeTikTokHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeTikTokHttpUrl("ftp://shop.example.com/p/1"), null);
  assert.equal(normalizeTikTokHttpUrl("nao-e-url"), null);
  assert.equal(normalizeTikTokHttpUrl(undefined), null);
});

test("scopes TikTok são normalizados nos formatos suportados pela API", () => {
  assert.deepEqual(
    normalizeTikTokGrantedScopes("creator.info.basic, creator.affiliate_collaboration.read, "),
    ["creator.info.basic", "creator.affiliate_collaboration.read"],
  );

  assert.deepEqual(
    normalizeTikTokGrantedScopes([
      { scope: "creator.info.basic" },
      " creator.affiliate_collaboration.read ",
      { scope: "" },
    ]),
    ["creator.info.basic", "creator.affiliate_collaboration.read"],
  );

  assert.deepEqual(normalizeTikTokGrantedScopes(undefined), []);
});

test("tempo de token prioriza nomes oficiais e mantém compatibilidade legada", () => {
  assert.equal(
    getTikTokTokenLifetimeSeconds(
      {
        access_token_expires_in: 86_400,
        access_token_expire_in: 3_600,
      },
      "access",
    ),
    86_400,
  );

  assert.equal(
    getTikTokTokenLifetimeSeconds(
      {
        refresh_token_expires_in: 2_592_000,
        refresh_token_expire_in: 86_400,
      },
      "refresh",
    ),
    2_592_000,
  );

  assert.equal(getTikTokTokenLifetimeSeconds({ access_token_expire_in: 3_600 }, "access"), 3_600);
  assert.equal(
    getTikTokTokenLifetimeSeconds({ refresh_token_expire_in: 86_400 }, "refresh"),
    86_400,
  );
});
