import { Link, createFileRoute } from "@tanstack/react-router";
import { Bot, Database, Radar, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/transparencia")({
  head: () => ({
    meta: [
      { title: "Transparência — RadarShop AI" },
      {
        name: "description",
        content:
          "Entenda como o RadarShop AI trata fontes de dados, indicadores, inteligência de mercado e conteúdo gerado por IA.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: TransparencyPage,
});

const sections = [
  {
    icon: Database,
    title: "Dados de produtos",
    text: "O RadarShop AI trabalha com produtos cadastrados, importados ou recebidos por integrações autorizadas. Cada produto guarda sua fonte e data de atualização. Campos ausentes permanecem indisponíveis em vez de receber valores estimados.",
  },
  {
    icon: TrendingUp,
    title: "Inteligência de mercado",
    text: "O Índice de Oportunidade é um indicador comparativo, não uma probabilidade de venda. Ele combina somente os sinais disponíveis no catálogo e no histórico, como ritmo observado de vendas, concorrência relativa, comissão e novidade, exibindo a cobertura da análise.",
  },
  {
    icon: Bot,
    title: "Conteúdo gerado por IA",
    text: "Quando a geração por IA está configurada, o sistema usa contexto do produto e preferências do usuário para produzir um rascunho estruturado. O resultado deve ser revisado antes de ser salvo ou publicado e não deve ser tratado como verificação independente das informações comerciais.",
  },
  {
    icon: ShieldCheck,
    title: "Credenciais e integrações",
    text: "Chaves administrativas, credenciais do provedor de IA e segredos de ingestão são configurações de servidor. A aplicação cliente não precisa receber essas credenciais para utilizar as funções correspondentes.",
  },
];

function TransparencyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Radar className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="text-sm font-bold">RadarShop AI</span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <span className="gold-chip inline-flex rounded-full px-3 py-1 text-xs font-medium">
          Como a plataforma funciona
        </span>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">Transparência</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Esta página explica os princípios técnicos usados para evitar que estimativas, automações
          ou conteúdo de IA sejam apresentados como fatos que não existem na fonte.
        </p>

        <div className="mt-8 space-y-4">
          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <section key={section.title} className="surface-card p-5 md:p-6">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <h2 className="text-base font-semibold">{section.title}</h2>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{section.text}</p>
              </section>
            );
          })}
        </div>

        <section className="mt-6 rounded-lg border border-border bg-secondary/40 p-5">
          <h2 className="text-sm font-semibold">Limites importantes</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Dados de mercado podem mudar, fontes externas podem atrasar e conteúdo gerado por IA
            pode exigir correção. O RadarShop AI não garante vendas, renda, desempenho de produto ou
            resultados comerciais.
          </p>
        </section>
      </main>
    </div>
  );
}
