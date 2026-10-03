import assert from "node:assert/strict";
import test from "node:test";

import {
  productIngestItemSchema,
  productIngestRequestSchema,
} from "../src/lib/product-ingest-schema.ts";

test("ingestão aceita um lote válido e normaliza espaços", () => {
  const parsed = productIngestRequestSchema.parse({
    source: "  parceiro_oficial  ",
    collected_at: "2026-10-03T10:00:00-03:00",
    products: [
      {
        name: "  Produto teste  ",
        original_url: "https://example.com/produto/1",
        price: 29.9,
        commission_amount: 4.5,
        commission_percent: 15,
        sales_count: 120,
        creators_count: 8,
      },
    ],
  });

  assert.equal(parsed.source, "parceiro_oficial");
  assert.equal(parsed.products[0]?.name, "Produto teste");
  assert.equal(parsed.products[0]?.price, 29.9);
});

test("ingestão rejeita valores comerciais impossíveis", () => {
  const invalidCases = [
    { price: -0.01 },
    { commission_amount: -1 },
    { commission_percent: 100.01 },
    { commission_percent: -0.01 },
    { sales_count: -1 },
    { creators_count: -1 },
    { sales_count: 1.5 },
  ];

  for (const invalid of invalidCases) {
    const result = productIngestItemSchema.safeParse({
      name: "Produto",
      original_url: "https://example.com/produto",
      ...invalid,
    });

    assert.equal(result.success, false, JSON.stringify(invalid));
  }
});

test("ingestão rejeita URL inválida e lote acima de 100 produtos", () => {
  assert.equal(
    productIngestItemSchema.safeParse({
      name: "Produto",
      original_url: "nao-e-url",
    }).success,
    false,
  );

  const products = Array.from({ length: 101 }, (_, index) => ({
    name: `Produto ${index + 1}`,
    original_url: `https://example.com/produto/${index + 1}`,
  }));

  const result = productIngestRequestSchema.safeParse({
    source: "partner",
    products,
  });

  assert.equal(result.success, false);
});

test("ingestão não permite lote vazio nem fonte sem identificação", () => {
  assert.equal(
    productIngestRequestSchema.safeParse({
      source: "x",
      products: [],
    }).success,
    false,
  );
});
