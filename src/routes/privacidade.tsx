import { Link, createFileRoute } from "@tanstack/react-router";
import { Database, LockKeyhole, Radar, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — RadarShop AI" },
      {
        name: "description",
        content:
          "Saiba quais dados o RadarShop AI trata, para quais finalidades e quais medidas de proteção são adotadas.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacyPage,
});

const sections = [
  {
    icon: UserRound,
    title: "Dados tratados",
    paragraphs: [
      "Podemos tratar dados de conta, como nome, e-mail, identificadores de autenticação e data de cadastro, além das preferências escolhidas no onboarding e nas configurações.",
      "Também podem ser armazenados favoritos, projetos do Estúdio, uso do plano, estado de assinatura, histórico de ações necessárias ao funcionamento da conta e metadados técnicos de integrações autorizadas.",
      "Quando o usuário conecta o TikTok Shop, credenciais de acesso do Creator são mantidas somente no servidor e armazenadas de forma criptografada. Elas não são exibidas no navegador.",
    ],
  },
  {
    icon: Database,
    title: "Finalidades",
    paragraphs: [
      "Os dados são usados para autenticar a conta, personalizar o Meu Radar, salvar favoritos e projetos, gerar conteúdo solicitado pelo usuário, controlar limites de uso, processar assinaturas e manter a segurança e a integridade da plataforma.",
      "Informações de produto e histórico de métricas são utilizadas para apresentar análises comparativas. O RadarShop não fabrica valores ausentes para preencher o catálogo.",
    ],
  },
  {
    icon: LockKeyhole,
    title: "Segurança e acesso",
    paragraphs: [
      "A aplicação utiliza controles de acesso no banco, separação entre credenciais públicas e segredos de servidor, políticas por usuário e armazenamento server-side para informações sensíveis.",
      "Nenhum sistema conectado à internet oferece risco zero. Em caso de incidente relevante, as medidas aplicáveis serão adotadas de acordo com a natureza do evento e as obrigações legais correspondentes.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Fornecedores e integrações",
    paragraphs: [
      "Para operar a plataforma, podem ser utilizados serviços de infraestrutura, autenticação e banco de dados, provedores de IA, gateways de pagamento e integrações oficiais do TikTok Shop.",
      "Cada fornecedor trata os dados necessários para prestar seu serviço conforme sua própria documentação e termos. O RadarShop procura limitar o envio ao que é necessário para executar a função solicitada.",
    ],
  },
];

function PrivacyPage() {
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
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">Política de Privacidade</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Esta política descreve, de forma objetiva, como o RadarShop AI trata dados necessários
          para oferecer a plataforma aos seus usuários.
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

        <section className="mt-6 surface-card p-5 md:p-6">
          <h2 className="text-base font-semibold">IA e conteúdo criado pelo usuário</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Quando o usuário solicita uma geração por IA, o sistema pode enviar ao provedor
            configurado dados do produto, preferências e trechos necessários de projetos anteriores
            para produzir a resposta. A plataforma não envia ao navegador chaves privadas do
            provedor de IA.
          </p>
        </section>

        <section className="mt-4 surface-card p-5 md:p-6">
          <h2 className="text-base font-semibold">Retenção, correção e exclusão</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Os dados são mantidos enquanto forem necessários para prestar o serviço, proteger a
              conta, cumprir obrigações aplicáveis ou preservar registros legítimos de operação e
              cobrança.
            </p>
            <p>
              O usuário pode atualizar informações disponíveis no Perfil e nas Configurações.
              Solicitações relacionadas a acesso, correção, exclusão, anonimização ou demais
              direitos aplicáveis devem ser encaminhadas pelo canal oficial de suporte divulgado
              pela operação antes do lançamento comercial.
            </p>
          </div>
        </section>

        <section className="mt-4 surface-card p-5 md:p-6">
          <h2 className="text-base font-semibold">Sessão e armazenamento no navegador</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            O RadarShop utiliza mecanismos de sessão e armazenamento local necessários para manter a
            autenticação e o funcionamento do aplicativo. Esses mecanismos não devem ser usados para
            guardar chaves administrativas ou segredos de servidor.
          </p>
        </section>

        <section className="mt-4 rounded-lg border border-border bg-secondary/40 p-5">
          <h2 className="text-sm font-semibold">Atualizações desta política</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Esta política pode ser atualizada para acompanhar mudanças técnicas, comerciais ou
            legais. Quando uma alteração material exigir ciência do usuário, a plataforma deverá
            apresentar aviso adequado.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link to="/termos" className="font-medium hover:underline">
            Termos de Uso
          </Link>
          <Link to="/transparencia" className="font-medium hover:underline">
            Transparência
          </Link>
        </div>
      </main>
    </div>
  );
}
