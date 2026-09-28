import type { Produto } from "@/types/product";

export type IntelligenceMetricPoint = {
  sales_count: number | null;
  creators_count: number | null;
  recorded_at: string;
};

export type IntelligenceProduct = Produto & {
  identified_at: string;
};

export type GrowthSummary = {
  samples: number;
  periodDays: number | null;
  salesDelta: number | null;
  weeklySalesIncrease: number | null;
  creatorsDelta: number | null;
  weeklyCreatorsIncrease: number | null;
  accelerating: boolean;
};

export type OpportunityTag =
  | "antes_de_viralizar"
  | "novo"
  | "baixa_concorrencia"
  | "segunda_onda";

export type ProductIntelligence = {
  product: IntelligenceProduct;
  ageDays: number;
  growth: GrowthSummary;
  momentumScore: number | null;
  competitionScore: number | null;
  commissionScore: number | null;
  newnessScore: number;
  opportunityIndex: number | null;
  coverage: number;
  tags: OpportunityTag[];
  reasons: string[];
};

export type MarketIntelligenceResult = {
  products: ProductIntelligence[];
  hunter: ProductIntelligence[];
  beforeViral: ProductIntelligence[];
  newProducts: ProductIntelligence[];
  lowCompetition: ProductIntelligence[];
  secondWave: ProductIntelligence[];
};

type BaseIntelligence = {
  product: IntelligenceProduct;
  ageDays: number;
  growth: GrowthSummary;
  commissionKind: "amount" | "percent" | null;
  commissionValue: number | null;
};

const DAY_MS = 86_400_000;

export function buildMarketIntelligence(
  products: IntelligenceProduct[],
  metricsByProduct: Map<string, IntelligenceMetricPoint[]>,
): MarketIntelligenceResult {
  const base: BaseIntelligence[] = products.map((product) => {
    const ageDays = Math.max(0, (Date.now() - new Date(product.identified_at).getTime()) / DAY_MS);
    const growth = summarizeMetricHistory(metricsByProduct.get(product.id) ?? []);

    return {
      product,
      ageDays,
      growth,
      commissionKind:
        product.commission_amount !== null
          ? "amount"
          : product.commission_percent !== null
            ? "percent"
            : null,
      commissionValue: product.commission_amount ?? product.commission_percent,
    };
  });

  const positiveMomentum = base
    .map((item) => item.growth.weeklySalesIncrease)
    .filter((value): value is number => value !== null && value > 0);
  const creators = base
    .map((item) => item.product.creators_count)
    .filter((value): value is number => value !== null);
  const commissionAmounts = base
    .filter((item) => item.commissionKind === "amount")
    .map((item) => item.commissionValue)
    .filter((value): value is number => value !== null);
  const commissionPercents = base
    .filter((item) => item.commissionKind === "percent")
    .map((item) => item.commissionValue)
    .filter((value): value is number => value !== null);

  const analyzed = base.map((item): ProductIntelligence => {
    const momentumScore =
      item.growth.weeklySalesIncrease !== null && item.growth.weeklySalesIncrease > 0
        ? 50 + percentileRank(item.growth.weeklySalesIncrease, positiveMomentum) / 2
        : item.growth.weeklySalesIncrease !== null
          ? 0
          : null;

    const competitionScore =
      item.product.creators_count !== null
        ? 100 - percentileRank(item.product.creators_count, creators)
        : null;

    const commissionPool =
      item.commissionKind === "amount"
        ? commissionAmounts
        : item.commissionKind === "percent"
          ? commissionPercents
          : [];

    const commissionScore =
      item.commissionValue !== null && commissionPool.length
        ? percentileRank(item.commissionValue, commissionPool)
        : null;

    const newnessScore = clamp(100 - (item.ageDays / 60) * 100, 0, 100);

    const weightedSignals = [
      { score: momentumScore, weight: 0.35 },
      { score: competitionScore, weight: 0.3 },
      { score: commissionScore, weight: 0.2 },
      { score: newnessScore, weight: 0.15 },
    ];

    const available = weightedSignals.filter(
      (signal): signal is { score: number; weight: number } => signal.score !== null,
    );
    const weightAvailable = available.reduce((sum, signal) => sum + signal.weight, 0);
    const weightedScore = available.reduce(
      (sum, signal) => sum + signal.score * signal.weight,
      0,
    );
    const opportunityIndex =
      weightAvailable >= 0.45 ? Math.round(weightedScore / weightAvailable) : null;
    const coverage = Math.round(weightAvailable * 100);

    const tags: OpportunityTag[] = [];

    if (
      item.ageDays <= 45 &&
      item.growth.salesDelta !== null &&
      item.growth.salesDelta > 0 &&
      momentumScore !== null &&
      momentumScore >= 70 &&
      competitionScore !== null &&
      competitionScore >= 55
    ) {
      tags.push("antes_de_viralizar");
    }

    if (item.ageDays <= 14) {
      tags.push("novo");
    }

    if (competitionScore !== null && competitionScore >= 70) {
      tags.push("baixa_concorrencia");
    }

    if (item.ageDays > 14 && item.growth.accelerating) {
      tags.push("segunda_onda");
    }

    const reasons: string[] = [];

    if (item.growth.weeklySalesIncrease !== null) {
      reasons.push(
        item.growth.weeklySalesIncrease > 0
          ? `Ritmo observado: +${formatCompact(item.growth.weeklySalesIncrease)} vendas/7d`
          : "Sem crescimento de vendas no período comparável",
      );
    } else {
      reasons.push("Histórico de vendas insuficiente para medir ritmo");
    }

    if (item.product.creators_count !== null && competitionScore !== null) {
      reasons.push(
        `${formatCompact(item.product.creators_count)} criadores informados · concorrência relativa ${Math.round(
          competitionScore,
        )}/100`,
      );
    }

    if (item.commissionValue !== null && commissionScore !== null) {
      reasons.push(`Comissão relativa ${Math.round(commissionScore)}/100 dentro do mesmo tipo de dado`);
    }

    reasons.push(`Produto identificado há ${Math.floor(item.ageDays)} dias`);

    return {
      product: item.product,
      ageDays: item.ageDays,
      growth: item.growth,
      momentumScore: roundNullable(momentumScore),
      competitionScore: roundNullable(competitionScore),
      commissionScore: roundNullable(commissionScore),
      newnessScore: Math.round(newnessScore),
      opportunityIndex,
      coverage,
      tags,
      reasons,
    };
  });

  const byIndex = [...analyzed].sort(compareOpportunity);

  return {
    products: analyzed,
    hunter: byIndex.filter((item) => item.opportunityIndex !== null).slice(0, 20),
    beforeViral: byIndex.filter((item) => item.tags.includes("antes_de_viralizar")).slice(0, 20),
    newProducts: byIndex.filter((item) => item.tags.includes("novo")).slice(0, 20),
    lowCompetition: byIndex.filter((item) => item.tags.includes("baixa_concorrencia")).slice(0, 20),
    secondWave: byIndex.filter((item) => item.tags.includes("segunda_onda")).slice(0, 20),
  };
}

export function summarizeMetricHistory(metrics: IntelligenceMetricPoint[]): GrowthSummary {
  const ordered = [...metrics].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );
  const salesPoints = ordered.filter(
    (point): point is IntelligenceMetricPoint & { sales_count: number } =>
      point.sales_count !== null,
  );
  const creatorPoints = ordered.filter(
    (point): point is IntelligenceMetricPoint & { creators_count: number } =>
      point.creators_count !== null,
  );

  const sales = calculateDelta(salesPoints, (point) => point.sales_count);
  const creatorsGrowth = calculateDelta(creatorPoints, (point) => point.creators_count);
  const accelerating = calculateAcceleration(salesPoints);

  return {
    samples: ordered.length,
    periodDays: sales.periodDays ?? creatorsGrowth.periodDays,
    salesDelta: sales.delta,
    weeklySalesIncrease: sales.weeklyRate,
    creatorsDelta: creatorsGrowth.delta,
    weeklyCreatorsIncrease: creatorsGrowth.weeklyRate,
    accelerating,
  };
}

function calculateDelta<T extends { recorded_at: string }>(
  points: T[],
  valueOf: (point: T) => number,
) {
  if (points.length < 2) {
    return { delta: null, weeklyRate: null, periodDays: null };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const periodDays =
    (new Date(last.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / DAY_MS;

  if (periodDays < 0.25) {
    return { delta: null, weeklyRate: null, periodDays };
  }

  const delta = valueOf(last) - valueOf(first);

  return {
    delta,
    weeklyRate: (delta / periodDays) * 7,
    periodDays,
  };
}

function calculateAcceleration(
  points: Array<IntelligenceMetricPoint & { sales_count: number }>,
) {
  if (points.length < 3) return false;

  const first = points[0];
  const previous = points[points.length - 2];
  const latest = points[points.length - 1];
  const earlierDays =
    (new Date(previous.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / DAY_MS;
  const recentDays =
    (new Date(latest.recorded_at).getTime() - new Date(previous.recorded_at).getTime()) / DAY_MS;

  if (earlierDays < 0.25 || recentDays < 0.25) return false;

  const earlierRate = (previous.sales_count - first.sales_count) / earlierDays;
  const recentRate = (latest.sales_count - previous.sales_count) / recentDays;

  if (recentRate <= 0) return false;
  if (earlierRate <= 0) return true;

  return recentRate >= earlierRate * 1.25;
}

function percentileRank(value: number, values: number[]) {
  if (!values.length) return 50;
  if (values.length === 1) return 50;

  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter((item) => item < value).length;
  const equal = sorted.filter((item) => item === value).length;
  const midRank = below + Math.max(0, equal - 1) / 2;

  return clamp((midRank / (sorted.length - 1)) * 100, 0, 100);
}

function compareOpportunity(a: ProductIntelligence, b: ProductIntelligence) {
  if (a.opportunityIndex === null && b.opportunityIndex === null) {
    return b.coverage - a.coverage;
  }

  if (a.opportunityIndex === null) return 1;
  if (b.opportunityIndex === null) return -1;

  return (
    b.opportunityIndex - a.opportunityIndex ||
    b.coverage - a.coverage ||
    new Date(b.product.data_updated_at).getTime() -
      new Date(a.product.data_updated_at).getTime()
  );
}

function roundNullable(value: number | null) {
  return value === null ? null : Math.round(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
