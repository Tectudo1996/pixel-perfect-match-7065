import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Crown, Gauge, Loader2, Sparkles } from "lucide-react";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/plano")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Plano e uso — RadarShop AI" },
      {
        name: "description",
        content: "Consulte seu plano e o uso mensal dos recursos de IA.",
      },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = usePlanUsage();

  if (isLoading) {
    return (
      <div className="surface-card flex min-h-64 items-center justify-center">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando plano
        </span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="surface-card p-5">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
          <div className="flex-1">
            <h1 className="text-sm font-semibold">Não foi possível carregar seu plano</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Tente novamente em alguns instantes."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const percent = data.limit > 0 ? Math.min(100, Math.round((data.used / data.limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <section>
        <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <Crown className="h-3.5 w-3.5" /> Conta e capacidade
        </span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Plano e uso</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Acompanhe sua capacidade mensal de geração por IA e a estrutura de planos do RadarShop AI.
        </p>
      </section>

      {!data.enforcementEnabled && (
        <section className="rounded-lg border border-gold/30 bg-gold-soft/50 p-4">
          <p className="text-sm font-medium">Limites preparados, ainda não ativados neste ambiente</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            A estrutura de planos está pronta no código. O bloqueio de uso só entra em vigor após a
            migration correspondente ser aplicada e a configuração do servidor ser habilitada.
          </p>
        </section>
      )}

      <section className="surface-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Plano atual
            </p>
            <h2 className="mt-1 text-xl font-bold">{data.plan === "pro" ? "Pro" : "Grátis"}</h2>
          </div>
          <span className="gold-chip rounded-full px-3 py-1 text-xs font-medium">
            {data.status === "active"
              ? "Ativo"
              : data.status === "unconfigured"
                ? "Preparação"
                : "Requer atenção"}
          </span>
        </div>

        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" /> Gerações por IA
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {data.used} / {data.limit}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>{data.remaining} restantes no período</span>
            {data.periodEnd && <span>Renova em {formatDate(data.periodEnd)}</span>}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          <h2 className="text-base font-semibold">Estrutura de planos</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Os limites podem ser ajustados no servidor sem expor regras sensíveis no navegador.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <PlanCard
            name="Grátis"
            current={data.plan === "free"}
            generations={data.catalog.free.aiGenerationsMonthly}
            description="Para começar a pesquisar produtos e testar o Estúdio."
          />
          <PlanCard
            name="Pro"
            current={data.plan === "pro"}
            generations={data.catalog.pro.aiGenerationsMonthly}
            description="Mais capacidade mensal para quem usa a IA com frequência."
          />
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  name,
  current,
  generations,
  description,
}: {
  name: string;
  current: boolean;
  generations: number;
  description: string;
}) {
  return (
    <article className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {current && <span className="gold-chip rounded-full px-2.5 py-1 text-[11px]">Atual</span>}
      </div>
      <p className="mt-5 text-sm font-medium">
        {generations.toLocaleString("pt-BR")} gerações por IA / mês
      </p>
      {!current && (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          A ativação paga será conectada em uma etapa separada, depois da definição de preço e
          provedor de cobrança.
        </p>
      )}
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
