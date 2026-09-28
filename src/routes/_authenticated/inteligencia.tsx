import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Compass,
  Info,
  Loader2,
  PackageSearch,
  RefreshCw,
  Sparkles,
  TimerReset,
  TrendingUp,
  UsersRound,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMarketIntelligence } from "@/hooks/useMarketIntelligence";
import {
  type MarketIntelligenceResult,
  type OpportunityTag,
  type ProductIntelligence,
} from "@/lib/market-intelligence";
import { brl, num, percent, NA } from "@/lib/format";
import { cn } from "@/lib/utils";

type IntelligenceView = "hunter" | "beforeViral" | "newProducts" | "lowCompetition" | "secondWave";

const views: Array<{
  id: IntelligenceView;
  label: string;
  description: string;
  icon: typeof Compass;
}> = [
  {
    id: "hunter",
    label: "Caçador de Oportunidades",
    description: "Índice composto pelos sinais disponíveis, com cobertura explícita.",
    icon: Compass,
  },
  {
    id: "beforeViral",
    label: "Antes de Viralizar",
    description:
      "Aceleração observada em produtos ainda recentes e com concorrência relativa menor.",
    icon: Sparkles,
  },
  {
    id: "newProducts",
    label: "Produtos Novos",
    description: "Itens identificados no catálogo há até 14 dias.",
    icon: TimerReset,
  },
  {
    id: "lowCompetition",
    label: "Baixa Concorrência",
    description: "Produtos no grupo com menos criadores informados dentro da amostra analisada.",
    icon: UsersRound,
  },
  {
    id: "secondWave",
    label: "Segunda Onda",
    description: "Produtos com pelo menos três coletas e aceleração recente do ritmo de vendas.",
    icon: Waves,
  },
];

const tagLabels: Record<OpportunityTag, string> = {
  antes_de_viralizar: "Aceleração inicial",
  novo: "Novo",
  baixa_concorrencia: "Baixa concorrência",
  segunda_onda: "Segunda onda",
};

export const Route = createFileRoute("/_authenticated/inteligencia")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inteligência de Mercado — RadarShop AI" },
      {
        name: "description",
        content: "Sinais explicáveis de oportunidade com base no histórico real do catálogo.",
      },
    ],
  }),
  component: MarketIntelligencePage,
});

function MarketIntelligencePage() {
  const [view, setView] = useState<IntelligenceView>("hunter");
  const { data, isLoading, isError, error, refetch, isFetching } = useMarketIntelligence();

  if (isError) {
    return (
      <div className="surface-card flex flex-col items-center justify-center p-10 text-center">
        <RefreshCw className="h-5 w-5 text-muted-foreground" />
        <h1 className="mt-3 text-base font-semibold">Não foi possível montar a inteligência</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Tente novamente em alguns instantes."}
        </p>
        <Button className="mt-4" variant="outline" size="sm" onClick={() => void refetch()}>
          {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
          Tentar novamente
        </Button>
      </div>
    );
  }

  const current = data ? selectView(data, view) : [];
  const currentMeta = views.find((item) => item.id === view) ?? views[0]!;

  return (
    <div className="space-y-6">
      <section>
        <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <TrendingUp className="h-3.5 w-3.5" /> Etapa 8
        </span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Inteligência de Mercado</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Detecte sinais de crescimento, novidade, concorrência e comissão usando apenas dados
          existentes no catálogo e no histórico de coletas.
        </p>
      </section>

      <section className="rounded-lg border border-gold/30 bg-gold-soft/50 p-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-medium">Índice de Oportunidade não é chance de venda</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              O índice de 0 a 100 combina sinais observáveis: 35% ritmo de vendas, 30% concorrência
              relativa, 20% comissão e 15% novidade. Quando um sinal não existe, o peso é
              redistribuído e a cobertura mostra quanto da fórmula pôde ser calculado.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {views.map((item) => {
          const Icon = item.icon;
          const count = data ? selectView(data, item.id).length : 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "surface-card cursor-pointer p-4 text-left transition-shadow hover:shadow-lift",
                view === item.id && "ring-1 ring-gold",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-xs text-muted-foreground">{isLoading ? "…" : count}</span>
              </div>
              <p className="mt-3 text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </button>
          );
        })}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{currentMeta.label}</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              {currentMeta.description}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? "Analisando catálogo..."
              : `${data?.analyzedCount ?? 0} produtos analisados · limite atual de ${data?.limit ?? 0}`}
          </p>
        </div>

        {isLoading ? (
          <IntelligenceSkeleton />
        ) : current.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {current.map((item) => (
              <IntelligenceCard key={item.product.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="surface-card flex flex-col items-center justify-center p-10 text-center">
            <PackageSearch className="h-6 w-6 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-semibold">Nenhum produto atende a este sinal agora</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Alguns sinais exigem duas ou três coletas em momentos diferentes. O sistema prefere
              mostrar vazio a fabricar tendência sem histórico suficiente.
            </p>
          </div>
        )}
      </section>

      <Methodology />
    </div>
  );
}

function IntelligenceCard({ item }: { item: ProductIntelligence }) {
  const product = item.product;

  return (
    <article className="surface-card overflow-hidden">
      <div className="flex gap-4 p-4 md:p-5">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <PackageSearch className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              {product.categories?.name && (
                <span className="gold-chip rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {product.categories.name}
                </span>
              )}
              <h3 className="mt-2 line-clamp-2 text-sm font-semibold">{product.name}</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {product.store_name || "Loja não informada"}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Índice</p>
              <p className="text-2xl font-bold">
                {item.opportunityIndex === null ? "—" : item.opportunityIndex}
              </p>
              <p className="text-[10px] text-muted-foreground">cobertura {item.coverage}%</p>
            </div>
          </div>

          {item.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px]"
                >
                  {tagLabels[tag]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
        <SignalCell label="Ritmo" value={scoreText(item.momentumScore)} icon={Activity} />
        <SignalCell
          label="Concorrência"
          value={scoreText(item.competitionScore)}
          icon={UsersRound}
        />
        <SignalCell label="Comissão" value={scoreText(item.commissionScore)} icon={TrendingUp} />
        <SignalCell label="Novidade" value={scoreText(item.newnessScore)} icon={TimerReset} />
      </div>

      <div className="p-4 md:p-5">
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <DataRow label="Preço" value={brl(product.price) ?? NA} />
          <DataRow
            label="Comissão"
            value={brl(product.commission_amount) ?? percent(product.commission_percent) ?? NA}
          />
          <DataRow label="Vendas atuais" value={num(product.sales_count) ?? NA} />
          <DataRow label="Criadores atuais" value={num(product.creators_count) ?? NA} />
        </div>

        <div className="mt-4 space-y-1.5 border-t border-border pt-3">
          {item.reasons.slice(0, 3).map((reason) => (
            <p key={reason} className="text-[11px] leading-relaxed text-muted-foreground">
              • {reason}
            </p>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link to="/produto/$id" params={{ id: product.id }}>
              Ver análise do produto
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function SignalCell({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="bg-surface p-3">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-secondary/50 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Methodology() {
  return (
    <section className="surface-card p-5">
      <h2 className="text-base font-semibold">Como os sinais são definidos</h2>
      <div className="mt-4 grid gap-4 text-xs leading-relaxed text-muted-foreground md:grid-cols-2">
        <p>
          <strong className="text-foreground">Ritmo:</strong> usa a diferença de vendas acumuladas
          entre coletas separadas por pelo menos seis horas e converte o avanço para um ritmo
          equivalente de sete dias.
        </p>
        <p>
          <strong className="text-foreground">Concorrência:</strong> compara o número de criadores
          informados com os demais produtos analisados. Menos criadores gera pontuação relativa
          maior; ausência do dado reduz a cobertura.
        </p>
        <p>
          <strong className="text-foreground">Comissão:</strong> compara R$ com R$ e percentual com
          percentual, sem misturar unidades diferentes.
        </p>
        <p>
          <strong className="text-foreground">Segunda onda:</strong> exige no mínimo três pontos de
          vendas e considera aceleração quando o ritmo recente supera em pelo menos 25% o ritmo
          anterior.
        </p>
      </div>
    </section>
  );
}

function selectView(data: MarketIntelligenceResult, view: IntelligenceView) {
  return data[view];
}

function scoreText(value: number | null) {
  return value === null ? "Sem dado" : `${value}/100`;
}

function IntelligenceSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="surface-card h-72 animate-pulse bg-muted" />
      ))}
    </div>
  );
}
