import { createFileRoute, redirect } from "@tanstack/react-router";
import { CheckCircle2, Compass, Database, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePreferences, useProfile } from "@/hooks/useAuth";

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
      { name: "description", content: "Painel do afiliado no RadarShop AI." },
    ],
  }),
  component: DashboardPage,
});

const labels: Record<string, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
  primeira_venda: "Primeira venda",
  aumentar_vendas: "Aumentar vendas",
  novos_produtos: "Encontrar produtos novos",
  maior_comissao: "Comissões melhores",
  aparecer: "Aparecendo nos vídeos",
  sem_aparecer: "Sem aparecer",
  ia: "Conteúdo com IA",
  ainda_nao_sei: "Ainda não definido",
};

function DashboardPage() {
  const { data: profile } = useProfile();
  const { data: preferences } = usePreferences();

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || "Afiliado";
  const categories = preferences?.categories ?? [];

  return (
    <div>
      <div className="flex flex-col gap-2">
        <span className="gold-chip inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" /> Etapa inicial concluída
        </span>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">Olá, {firstName}.</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Sua conta está configurada e suas preferências já estão salvas. Na próxima etapa vamos
          transformar este painel no centro de operação do RadarShop AI.
        </p>
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={Compass}
          title="Seu perfil"
          value={
            (preferences?.experience_level && labels[preferences.experience_level]) ||
            "Configurado"
          }
          description={(preferences?.goal && labels[preferences.goal]) || "Objetivo salvo"}
        />
        <SummaryCard
          icon={Sparkles}
          title="Conteúdo"
          value={(preferences?.video_style && labels[preferences.video_style]) || "Configurado"}
          description={
            categories.length
              ? `${categories.length} categoria(s) selecionada(s)`
              : "Preferências salvas"
          }
        />
        <SummaryCard
          icon={Database}
          title="Dados"
          value="Sem números inventados"
          description="Os próximos módulos usarão somente informações disponíveis no banco."
        />
      </div>

      <section className="surface-card mt-6 p-5 md:p-6">
        <h2 className="text-base font-semibold">Próxima etapa: Dashboard + Radar</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          A fundação de conta e onboarding está pronta. O próximo desenvolvimento adicionará os
          indicadores do painel e o primeiro catálogo funcional de produtos, mantendo estados vazios
          quando ainda não houver dados importados.
        </p>
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: typeof Compass;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="surface-card p-5">
      <span className="gold-chip flex h-9 w-9 items-center justify-center rounded-md">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
