import { AlertCircle, Crown, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  useAdminPlanAccounts,
  useUpdateAdminPlan,
  type AdminPlanAccount,
} from "@/hooks/useAdminPlans";
import { Button } from "@/components/ui/button";

export function AdminPlanManagement({ enabled }: { enabled: boolean }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminPlanAccounts(enabled);
  const updatePlan = useUpdateAdminPlan();

  if (isLoading) {
    return (
      <div className="surface-card flex min-h-48 items-center justify-center">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando planos
        </span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="surface-card p-5">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <p className="text-sm font-semibold">Não foi possível carregar os planos</p>
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

  if (!data.configured) {
    return (
      <section className="rounded-lg border border-gold/30 bg-gold-soft/50 p-5">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Gestão de planos preparada</h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          A administração Free/Pro ficará disponível aqui depois que a migration de planos for
          aplicada no Supabase e AI_USAGE_LIMITS_ENABLED estiver ativo no servidor.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4" />
          <h2 className="text-base font-semibold">Planos dos usuários</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Controle manual para beta e suporte. Toda alteração é revalidada pelo servidor como admin.
        </p>
      </section>

      {data.accounts.length ? (
        <div className="space-y-3">
          {data.accounts.map((account) => (
            <AccountCard
              key={account.userId}
              account={account}
              pending={updatePlan.isPending}
              onUpdate={async (values, confirmation) => {
                if (!window.confirm(confirmation)) return;

                try {
                  await updatePlan.mutateAsync(values);
                  toast.success("Plano atualizado.");
                } catch (updateError) {
                  toast.error(
                    updateError instanceof Error
                      ? updateError.message
                      : "Não foi possível atualizar o plano.",
                  );
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="surface-card p-6 text-sm text-muted-foreground">
          Nenhum usuário encontrado.
        </div>
      )}
    </div>
  );
}

function AccountCard({
  account,
  pending,
  onUpdate,
}: {
  account: AdminPlanAccount;
  pending: boolean;
  onUpdate: (
    values: {
      userId: string;
      plan: "free" | "pro";
      status: "active" | "inactive";
      resetUsage?: boolean;
    },
    confirmation: string,
  ) => Promise<void>;
}) {
  const active = account.status === "active";

  return (
    <article className="surface-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{account.fullName || "Usuário sem nome"}</p>
          <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
            {account.userId}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Uso atual: {account.used.toLocaleString("pt-BR")} gerações
            {account.periodEnd ? " · renova em " + formatDate(account.periodEnd) : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="gold-chip rounded-full px-2.5 py-1 text-[11px] font-medium">
            {account.plan === "pro" ? "Pro" : "Grátis"}
          </span>
          <span className="rounded-full border border-border px-2.5 py-1 text-[11px]">
            {active ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            void onUpdate(
              {
                userId: account.userId,
                plan: account.plan === "pro" ? "free" : "pro",
                status: active ? "active" : "inactive",
              },
              account.plan === "pro"
                ? "Voltar este usuário para o plano Grátis?"
                : "Ativar manualmente o plano Pro para este usuário?",
            )
          }
        >
          {account.plan === "pro" ? "Mudar para Grátis" : "Tornar Pro"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            void onUpdate(
              {
                userId: account.userId,
                plan: account.plan,
                status: active ? "inactive" : "active",
              },
              active
                ? "Desativar novas gerações por IA para este usuário?"
                : "Reativar novas gerações por IA para este usuário?",
            )
          }
        >
          {active ? "Desativar" : "Reativar"}
        </Button>

        {account.used > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              void onUpdate(
                {
                  userId: account.userId,
                  plan: account.plan,
                  status: active ? "active" : "inactive",
                  resetUsage: true,
                },
                "Zerar o uso de IA deste usuário no período atual?",
              )
            }
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Zerar uso
          </Button>
        )}
      </div>
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
