import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Crown, Gauge, Loader2, RefreshCw, Sparkles, WalletCards } from "lucide-react";
import { toast } from "sonner";
import {
  useBillingSummary,
  useCancelBilling,
  useStartProCheckout,
  useSyncBilling,
} from "@/hooks/useBilling";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { Button } from "@/components/ui/button";

type PlanSearch = {
  checkout?: string;
};

export const Route = createFileRoute("/_authenticated/plano")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): PlanSearch => {
    const checkout = typeof search["checkout"] === "string" ? search["checkout"] : undefined;
    return checkout ? { checkout } : {};
  },
  head: () => ({
    meta: [
      { title: "Plano e uso — RadarShop AI" },
      {
        name: "description",
        content: "Consulte seu plano, uso mensal e cobrança do RadarShop AI.",
      },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { checkout } = Route.useSearch();
  const { data, isLoading, isError, error, refetch, isFetching } = usePlanUsage();
  const { data: billing, isLoading: billingLoading } = useBillingSummary();
  const startCheckout = useStartProCheckout();
  const syncBilling = useSyncBilling();
  const cancelBilling = useCancelBilling();

  async function handleStartCheckout() {
    try {
      const response = await startCheckout.mutateAsync();
      window.location.assign(response.checkoutUrl);
    } catch (checkoutError) {
      toast.error(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Não foi possível abrir o checkout.",
      );
    }
  }

  async function handleSyncBilling() {
    try {
      const response = await syncBilling.mutateAsync();
      toast.success("Cobrança sincronizada: " + translateBillingStatus(response.status) + ".");
    } catch (syncError) {
      toast.error(
        syncError instanceof Error ? syncError.message : "Não foi possível atualizar a cobrança.",
      );
    }
  }

  async function handleCancelBilling() {
    if (
      !window.confirm(
        "Cancelar a assinatura Pro agora? Após a confirmação do Mercado Pago, sua conta volta ao plano Grátis.",
      )
    ) {
      return;
    }

    try {
      await cancelBilling.mutateAsync();
      toast.success("Assinatura cancelada. Sua conta voltou ao plano Grátis.");
    } catch (cancelError) {
      toast.error(
        cancelError instanceof Error
          ? cancelError.message
          : "Não foi possível cancelar a assinatura.",
      );
    }
  }

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
          Acompanhe sua capacidade mensal de geração por IA e a cobrança do plano Pro.
        </p>
      </section>

      {checkout === "retorno" && (
        <section className="rounded-lg border border-gold/30 bg-gold-soft/50 p-4">
          <p className="text-sm font-medium">Retorno do checkout recebido</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            O plano não é liberado pelo redirecionamento do navegador. A ativação acontece somente
            depois que o servidor recebe e valida a confirmação do Mercado Pago.
          </p>
        </section>
      )}

      {!data.enforcementEnabled && (
        <section className="rounded-lg border border-gold/30 bg-gold-soft/50 p-4">
          <p className="text-sm font-medium">
            Limites preparados, ainda não ativados neste ambiente
          </p>
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

      <section className="surface-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <WalletCards className="h-4 w-4" />
              <h2 className="text-base font-semibold">Cobrança do Pro</h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Checkout recorrente processado pelo Mercado Pago. A aplicação não recebe dados do seu
              cartão e só libera o Pro depois da confirmação validada no servidor.
            </p>
          </div>

          {billing?.configured && billing.monthlyPrice !== null && (
            <p className="text-lg font-bold">
              {formatMoney(billing.monthlyPrice)}
              <span className="text-xs font-normal text-muted-foreground"> / mês</span>
            </p>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          {billingLoading ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando checkout
            </span>
          ) : data.plan === "pro" ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1 text-sm">
                <p className="font-medium">Seu Pro está ativo.</p>
                {billing?.billingStatus && (
                  <p className="text-xs text-muted-foreground">
                    Status da cobrança: {translateBillingStatus(billing.billingStatus)}
                  </p>
                )}
                {billing?.nextPaymentAt && (
                  <p className="text-xs text-muted-foreground">
                    Próxima cobrança informada: {formatDate(billing.nextPaymentAt)}
                  </p>
                )}
              </div>

              {billing?.managementAvailable && billing.externalSubscriptionId && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={syncBilling.isPending || cancelBilling.isPending}
                    onClick={() => void handleSyncBilling()}
                  >
                    {syncBilling.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Atualizar status
                  </Button>
                  {billing.billingStatus === "authorized" && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={cancelBilling.isPending || syncBilling.isPending}
                      onClick={() => void handleCancelBilling()}
                    >
                      {cancelBilling.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Cancelar assinatura
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : billing?.configured ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {billing.billingStatus === "pending"
                    ? "Seu checkout está pendente."
                    : "Assine quando quiser aumentar sua capacidade de IA."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  O valor vem da configuração segura do servidor e não fica fixado no frontend.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {billing.managementAvailable && billing.externalSubscriptionId && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={syncBilling.isPending || startCheckout.isPending}
                    onClick={() => void handleSyncBilling()}
                  >
                    {syncBilling.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Atualizar status
                  </Button>
                )}
                <Button
                  type="button"
                  variant="gold"
                  disabled={startCheckout.isPending || syncBilling.isPending}
                  onClick={() => void handleStartCheckout()}
                >
                  {startCheckout.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {billing.billingStatus === "pending" ? "Continuar pagamento" : "Assinar Pro"}
                </Button>
              </div>
            </div>
          ) : billing?.managementAvailable && billing.externalSubscriptionId ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Novas assinaturas estão pausadas.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sua assinatura já vinculada continua podendo ser sincronizada com o Mercado Pago.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={syncBilling.isPending}
                onClick={() => void handleSyncBilling()}
              >
                {syncBilling.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar status
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">Checkout ainda não ativado neste ambiente.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                O código está preparado, mas credenciais, URL pública e valor mensal precisam estar
                configurados no servidor antes da cobrança real.
              </p>
            </div>
          )}
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
    </article>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function translateBillingStatus(status: string) {
  if (status === "authorized") return "autorizada";
  if (status === "pending") return "pendente";
  if (status === "paused") return "pausada";
  if (status === "canceled" || status === "cancelled") return "cancelada";
  return status;
}
