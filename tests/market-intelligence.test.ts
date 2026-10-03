import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketIntelligence,
  summarizeMetricHistory,
  type IntelligenceProduct,
} from "../src/lib/market-intelligence.ts";

test("histórico calcula ritmo semanal usando a ordem cronológica real", () => {
  const summary = summarizeMetricHistory([
    {
      recorded_at: "2026-01-08T00:00:00Z",
      sales_count: 170,
      creators_count: 30,
    },
    {
      recorded_at: "2026-01-01T00:00:00Z",
      sales_count: 100,
      creators_count: 20,
    },
  ]);

  assert.equal(summary.samples, 2);
  assert.equal(summary.periodDays, 7);
  assert.equal(summary.salesDelta, 70);
  assert.equal(summary.weeklySalesIncrease, 70);
  assert.equal(summary.creatorsDelta, 10);
  assert.equal(summary.weeklyCreatorsIncrease, 10);
  assert.equal(summary.accelerating, false);
});

test("histórico identifica aceleração somente quando o ritmo recente aumenta", () => {
  const accelerating = summarizeMetricHistory([
    { recorded_at: "2026-01-01T00:00:00Z", sales_count: 100, creators_count: null },
    { recorded_at: "2026-01-08T00:00:00Z", sales_count: 120, creators_count: null },
    { recorded_at: "2026-01-15T00:00:00Z", sales_count: 170, creators_count: null },
  ]);

  const slowing = summarizeMetricHistory([
    { recorded_at: "2026-01-01T00:00:00Z", sales_count: 100, creators_count: null },
    { recorded_at: "2026-01-08T00:00:00Z", sales_count: 150, creators_count: null },
    { recorded_at: "2026-01-15T00:00:00Z", sales_count: 160, creators_count: null },
  ]);

  assert.equal(accelerating.accelerating, true);
  assert.equal(slowing.accelerating, false);
});

test("produto sem sinais suficientes não recebe Índice de Oportunidade inventado", () => {
  const originalNow = Date.now;
  Date.now = () => new Date("2026-10-03T12:00:00Z").getTime();

  try {
    const product: IntelligenceProduct = {
      id: "produto-sem-dados",
      name: "Produto sem dados",
      image_url: null,
      price: null,
      commission_amount: null,
      commission_percent: null,
      store_name: null,
      sales_count: null,
      creators_count: null,
      source: "teste",
      data_updated_at: "2026-10-03T11:00:00Z",
      identified_at: "2026-10-02T12:00:00Z",
      categories: null,
    };

    const result = buildMarketIntelligence([product], new Map());
    const analyzed = result.products[0];

    assert.ok(analyzed);
    assert.equal(analyzed.opportunityIndex, null);
    assert.equal(analyzed.coverage, 15);
    assert.equal(analyzed.momentumScore, null);
    assert.equal(analyzed.competitionScore, null);
    assert.equal(analyzed.commissionScore, null);
    assert.match(analyzed.reasons[0] ?? "", /insuficiente/i);
  } finally {
    Date.now = originalNow;
  }
});

test("comissão em reais e percentual usam grupos separados", () => {
  const originalNow = Date.now;
  Date.now = () => new Date("2026-10-03T12:00:00Z").getTime();

  try {
    const base = {
      image_url: null,
      price: 50,
      store_name: "Loja",
      sales_count: null,
      creators_count: 10,
      source: "teste",
      data_updated_at: "2026-10-03T11:00:00Z",
      identified_at: "2026-09-30T12:00:00Z",
      categories: null,
    };

    const amountProduct: IntelligenceProduct = {
      ...base,
      id: "amount",
      name: "Comissão em reais",
      commission_amount: 20,
      commission_percent: null,
    };

    const percentProduct: IntelligenceProduct = {
      ...base,
      id: "percent",
      name: "Comissão percentual",
      commission_amount: null,
      commission_percent: 50,
    };

    const result = buildMarketIntelligence([amountProduct, percentProduct], new Map());
    const amount = result.products.find((item) => item.product.id === "amount");
    const percent = result.products.find((item) => item.product.id === "percent");

    assert.equal(amount?.commissionScore, 50);
    assert.equal(percent?.commissionScore, 50);
  } finally {
    Date.now = originalNow;
  }
});
