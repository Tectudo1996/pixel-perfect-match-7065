import { Link, createFileRoute } from "@tanstack/react-router";
import { Bot, CreditCard, Radar, ShieldAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — RadarShop AI" },
      {
        name: "description",
        content:
          "Condições de uso do RadarShop AI para contas, inteligência de produtos, IA e planos da plataforma.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: TermsPage,
});

const sections = [
  {
    icon: UserRound,
    title: "Conta e acesso",
    paragraphs: [
      "O usuário é responsável por manter seus dados de acesso protegidos e por utilizar a conta apenas de forma compatível com as funções da plataforma.",
      "Informações fornecidas no onboarding, Perfil e Configurações devem refletir as preferências do próprio usuário. O acesso administrativo é concedido separadamente e não é atribuído automaticamente a novas contas.",
    ],
  },
  {
    icon: Radar,
    title: "Dados e inteligência de produtos",
    paragraphs: [
      "O RadarShop organiza dados cadastrados, importados ou recebidos por integrações autorizadas. Disponibilidade, preço, comissão, vendas e outros campos podem mudar ou ficar indisponíveis.",
      "Indicadores comparativos, incluindo o Índice de Oportunidade, não representam garantia nem probabilidade de venda. O usuário deve avaliar as informações antes de tomar decisões comerciais.",
    ],
  },
  {
    icon: Bot,
    title: "Conteúdo gerado por IA",
    paragraphs: [
      "Recursos de IA produzem rascunhos de roteiro, legenda, hashtags e prompts a partir do contexto disponível. O resultado deve ser revisado pelo usuário antes de publicação.",
      "A IA pode produzir erros, omissões ou linguagem inadequada. O usuário continua responsável pelo conteúdo que decidir publicar e por verificar alegações sobre produtos.",
    ],
  },
  {
    icon: CreditCard,
    title: "Planos e pagamentos",
    paragraphs: [
      "Quando a cobrança estiver habilitada, preço, gateway disponível e condições do plano Pro serão apresentados na área Plano e uso e/ou no checkout correspondente.",
      "O acesso Pro só deve ser ativado após confirmação server-to-server do provedor de pagamento. O retorno visual do checkout, sozinho, não confirma pagamento.",
      "O fluxo técnico atual foi preparado para cancelamento imediato após a confirmação do provedor. Qualquer alteração dessa política comercial deve ser apresentada antes de novas vendas.",
    ],
  },
];

function TermsPage() {
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
          Vigente a partir de 03/10/2026
        </span>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">Termos de Uso</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Estes termos estabelecem as condições básicas para utilização do RadarShop AI, uma
          plataforma de apoio a afiliados que reúne descoberta, organização, análise e preparação de
          conteúdo.
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
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-4 surface-card p-5 md:p-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <h2 className="text-base font-semibold">Uso permitido e segurança</h2>
          </div>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Não é permitido tentar obter acesso não autorizado, contornar limites técnicos,
              explorar falhas, usar credenciais de terceiros sem autorização ou interferir no
              funcionamento da plataforma.
            </p>
            <p>
              Integrações externas devem ser usadas dentro das permissões concedidas pelo usuário e
              das regras do respectivo serviço. O RadarShop não transforma dados privados de uma
              conta Creator em catálogo global para outros usuários.
            </p>
          </div>
        </section>

        <section className="mt-4 surface-card p-5 md:p-6">
          <h2 className="text-base font-semibold">Disponibilidade e alterações</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Funções podem ficar temporariamente indisponíveis por manutenção, falha de fornecedor ou
            mudança de API externa. Recursos podem evoluir desde que a plataforma preserve a
            segurança dos dados e informe alterações relevantes nas condições de uso quando
            necessário.
          </p>
        </section>

        <section className="mt-4 rounded-lg border border-border bg-secondary/40 p-5">
          <h2 className="text-sm font-semibold">Resultados comerciais</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            O RadarShop AI é uma ferramenta de apoio. A plataforma não promete faturamento, renda,
            vendas, viralização, aprovação em programas de afiliados ou desempenho de qualquer
            produto.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link to="/privacidade" className="font-medium hover:underline">
            Política de Privacidade
          </Link>
          <Link to="/transparencia" className="font-medium hover:underline">
            Transparência
          </Link>
        </div>
      </main>
    </div>
  );
}
