import { AlertCircle, CheckCircle2, CircleDashed, Loader2, RefreshCw, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReadiness, type ReadinessCheck } from "@/hooks/useReadiness";

export function AdminReadiness({ enabled }: { enabled: boolean }) {
  const { data, isLoading, isError, error, isFetching, refetch } = useReadiness(enabled);

  if (isLoading) {
    return (
      <div className="surface-card flex min-h-48 items-center justify-center">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verificando ambiente
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
            <p className="text-sm font-semibold">Não foi possível verificar o ambiente</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Tente novamente."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
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

  return (
    <div className="space-y-5">
      <section className="surface-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              <h2 className="text-base font-semibold">Prontidão de produção</h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Diagnóstico executado no servidor. A tela mostra somente presença e estado das
              configurações; nenhuma chave ou segredo é devolvido ao navegador.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Verificar agora
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <StatusCard
            label="Núcleo da aplicação"
            ready={data.coreReady}
            readyText="Pronto"
            pendingText="Pendente"
          />
          <StatusCard
            label="Lançamento pago"
            ready={data.paidLaunchReady}
            readyText="Pronto"
            pendingText="Ainda não"
          />
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Última verificação: {new Date(data.checkedAt).toLocaleString("pt-BR")}
        </p>
      </section>

      <section className="space-y-3">
        {data.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </section>
    </div>
  );
}

function StatusCard({
  label,
  ready,
  readyText,
  pendingText,
}: {
  label: string;
  ready: boolean;
  readyText: string;
  pendingText: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold">
        {ready ? <CheckCircle2 className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
        {ready ? readyText : pendingText}
      </p>
    </div>
  );
}

function CheckRow({ check }: { check: ReadinessCheck }) {
  const icon =
    check.state === "ready" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : check.state === "error" ? (
      <AlertCircle className="h-4 w-4 text-destructive" />
    ) : (
      <CircleDashed className="h-4 w-4" />
    );

  return (
    <article className="surface-card flex gap-3 p-4">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{check.label}</p>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase">
            {stateLabel(check.state)}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
      </div>
    </article>
  );
}

function stateLabel(state: ReadinessCheck["state"]) {
  if (state === "ready") return "pronto";
  if (state === "disabled") return "desativado";
  if (state === "missing") return "faltando";
  return "erro";
}
