import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  FileText,
  PackageSearch,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePreferences, useProfile } from "@/hooks/useAuth";
import { useDashboardOverview } from "@/hooks/useDashboard";
import { brl, percent, NA } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { modo: "entrar" } });

    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("onboarding_completed")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!preferences?.onboarding_completed) {
      throw redirect({ to: "/onboarding" });
    }
  },
  head: () => ({
    meta: [
      { title: "Dashboard — RadarShop AI" },
      {
        name: "description",
        content: "Visão geral da sua operação no RadarShop AI.",
      },
    ],
  }),
  component: DashboardPage,
});

const labels: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
  primeira_venda: "Fazer a primeira venda",
  aumentar_vendas: "Aumentar vendas",
  novos_produtos: "Encontrar produtos novos",
  maior_comissao: "Buscar comissões melhores",
  aparecer: "Aparecendo nos vídeos",
  sem_aparecer: "Sem aparecer",
  ia: "Conteúdo com IA",
  ainda_nao_sei: "Ainda não definido",
};

function DashboardPage() {
  const { data: profile } = useProfile();
  const { data: preferences } = usePreferences();
  const { data: overview, isLoading, isError, error, refetch, isFetching } = useDashboardOverview();

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "Afiliado";
  const categories = preferences?.categories ?? [];

  return (
    <div className="space-y-7">
      <section>
        <div className="flex flex-col gap-2">
          <span className="gold-chip inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Painel do afiliado
          </span>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">Olá, {firstName}.</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Acompanhe o que já existe no sistema e use seus atalhos para continuar a operação. Os
            números abaixo vêm diretamente do banco — sem dados simulados.
          </p>
        </div>
      </section>

      {isError ? (
        <section className="surface-card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Não foi possível carregar o resumo</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Tente novamente em alguns instantes."}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Tentar novamente
          </Button>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={PackageSearch}
            label="Produtos disponíveis"
            value={isLoading ? null : (overview?.productsCount ?? 0)}
            description="Produtos atualmente cadastrados no radar."
          />
          <MetricCard
            icon={Bookmark}
            label="Favoritos"
            value={isLoading ? null : (overview?.favoritesCount ?? 0)}
            description="Produtos salvos na sua conta."
          />
          <MetricCard
            icon={FileText}
            label="Projetos de conteúdo"
            value={isLoading ? null : (overview?.projectsCount ?? 0)}
            description="Rascunhos e projetos vinculados ao seu usuário."
          />
          <MetricCard
            icon={Target}
            label="Categorias do seu radar"
            value={preferences ? categories.length : null}
            description={
              preferences?.goal
                ? labels[preferences.goal] || "Preferências personalizadas"
                : "Preferências personalizadas"
            }
          />
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <section className="surface-card p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Produtos atualizados recentemente</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Uma prévia do que já está disponível no banco.
              </p>
            </div>
            <Link
              to="/radar"
              className="hidden items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              Abrir Radar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-lg border border-border bg-muted/60"
                  />
                ))}
              </div>
            ) : overview?.recentProducts.length ? (
              <div className="divide-y divide-border">
                {overview.recentProducts.map((product) => (
                  <Link
                    key={product.id}
                    to="/produto/$id"
                    params={{ id: product.id }}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PackageSearch className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{product.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {product.store_name || "Loja não informada"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium">
                        {brl(product.commission_amount) ??
                          percent(product.commission_percent) ??
                          NA}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {brl(product.price) ?? "Preço não informado"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyDashboardState />
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="surface-card p-5">
            <h2 className="text-base font-semibold">Seu Radar pessoal</h2>
            <div className="mt-4 space-y-3 text-sm">
              <ProfileRow
                label="Nível"
                value={
                  (preferences?.experience_level && labels[preferences.experience_level]) ||
                  "Não informado"
                }
              />
              <ProfileRow
                label="Objetivo"
                value={(preferences?.goal && labels[preferences.goal]) || "Não informado"}
              />
              <ProfileRow
                label="Vídeos"
                value={
                  (preferences?.video_style && labels[preferences.video_style]) || "Não informado"
                }
              />
              <ProfileRow
                label="Categorias"
                value={categories.length ? categories.join(", ") : "Nenhuma selecionada"}
              />
            </div>
            <Link
              to="/configuracoes"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Ajustar preferências
            </Link>
          </section>

          <section className="surface-card p-5">
            <h2 className="text-base font-semibold">Próximos módulos</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              As rotas já estão preparadas. Vamos ativar cada recurso nas próximas etapas.
            </p>
            <div className="mt-4 grid gap-2">
              <QuickLink to="/radar" label="Radar de Produtos" />
              <QuickLink to="/meu-radar" label="Meu Radar" />
              <QuickLink to="/favoritos" label="Favoritos" />
              <QuickLink to="/estudio" label="Estúdio de Conteúdo" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof PackageSearch;
  label: string;
  value: number | null;
  description: string;
}) {
  return (
    <div className="surface-card p-5">
      <span className="gold-chip flex h-9 w-9 items-center justify-center rounded-md">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {value === null ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-muted" />
      ) : (
        <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p>
      )}
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2.5 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium">{value}</span>
    </div>
  );
}

function QuickLink({
  to,
  label,
}: {
  to: "/radar" | "/meu-radar" | "/favoritos" | "/estudio";
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
    >
      <span>{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}

function EmptyDashboardState() {
  return (
    <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center">
      <PackageSearch className="mx-auto h-5 w-5 text-muted-foreground" />
      <h3 className="mt-3 text-sm font-semibold">Ainda não há produtos no catálogo</h3>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
        O painel permanece zerado até que produtos reais sejam cadastrados ou importados. Não usamos
        números de demonstração como se fossem dados reais.
      </p>
    </div>
  );
}
