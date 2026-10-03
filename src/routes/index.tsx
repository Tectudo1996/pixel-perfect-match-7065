import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Radar,
  Sparkles,
  Heart,
  LayoutDashboard,
  Filter,
  ArrowRight,
  ShieldCheck,
  Database,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RadarShop AI — Inteligência para afiliados do TikTok Shop" },
      {
        name: "description",
        content:
          "Descubra produtos, analise comissões e prepare conteúdo para o TikTok Shop em uma plataforma única, feita para afiliados brasileiros.",
      },
      { property: "og:title", content: "RadarShop AI — Inteligência para afiliados" },
      {
        property: "og:description",
        content:
          "Radar de produtos, recomendações personalizadas e estúdio de conteúdo para afiliados do TikTok Shop.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Radar,
    title: "Radar de Produtos",
    text: "Busque, filtre por categoria, preço e comissão e organize os resultados do seu jeito.",
  },
  {
    icon: Filter,
    title: "Meu Radar",
    text: "Recomendações baseadas nas suas preferências de categoria e faixa de comissão.",
  },
  {
    icon: TrendingUp,
    title: "Inteligência de Mercado",
    text: "Compare sinais de crescimento, concorrência, comissão e novidade com critérios explicáveis.",
  },
  {
    icon: Heart,
    title: "Favoritos",
    text: "Salve produtos e mantenha sua lista de trabalho sempre à mão.",
  },
  {
    icon: LayoutDashboard,
    title: "Análise do produto",
    text: "Ficha completa com preço, comissão, loja, fonte dos dados e data de atualização.",
  },
  {
    icon: Wand2,
    title: "Estúdio de Conteúdo",
    text: "Crie e organize roteiro, legenda, hashtags e prompt audiovisual, com geração por IA quando configurada.",
  },
  {
    icon: ShieldCheck,
    title: "Dados com origem",
    text: "Cada produto registra sua fonte. Campos sem dados ficam marcados como indisponíveis.",
  },
];

const steps = [
  { n: "01", t: "Crie sua conta", d: "Cadastro em segundos, com e-mail ou conta Google." },
  { n: "02", t: "Responda o onboarding", d: "Nível, categorias, objetivo e faixa de comissão." },
  { n: "03", t: "Use o radar", d: "Encontre produtos compatíveis e salve seus favoritos." },
  { n: "04", t: "Prepare o conteúdo", d: "Estruture roteiro, legenda e hashtags no estúdio." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Radar className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="text-sm font-bold tracking-tight">RadarShop AI</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#recursos" className="hover:text-foreground">
              Recursos
            </a>
            <a href="#como-funciona" className="hover:text-foreground">
              Como funciona
            </a>
            <a href="#dados" className="hover:text-foreground">
              Dados
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth" search={{ modo: "entrar" }}>
                Entrar
              </Link>
            </Button>
            <Button asChild variant="gold" size="sm">
              <Link to="/auth" search={{ modo: "criar" }}>
                Criar conta
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border">
        <div className="grid-backdrop absolute inset-0 opacity-70" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center md:items-start md:py-28 md:text-left">
          <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Plataforma para afiliados do TikTok Shop
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl leading-[1.05] font-extrabold sm:text-5xl md:text-6xl">
            Inteligência de produtos para quem vive de{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">comissão</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-3 bg-gold/40" />
            </span>
            .
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Encontre produtos, avalie comissões, organize favoritos e prepare seus conteúdos em um
            único painel — sem números inventados, com a origem dos dados sempre registrada.
          </p>
          <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center md:justify-start">
            <Button asChild variant="gold" size="lg" className="w-full sm:w-auto">
              <Link to="/auth" search={{ modo: "criar" }}>
                Começar agora <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <a href="#como-funciona">Ver como funciona</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="text-center md:text-left">
          <h2 className="text-2xl font-bold md:text-3xl">O que você faz no RadarShop</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground md:mx-0">
            Módulos pensados para o fluxo real de um afiliado: descobrir, analisar e produzir.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="surface-card p-5 text-center transition-shadow hover:shadow-lift sm:text-left"
            >
              <span className="gold-chip mx-auto flex h-9 w-9 items-center justify-center rounded-md sm:mx-0">
                <f.icon className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center md:py-20 md:text-left">
          <h2 className="text-2xl font-bold md:text-3xl">Como funciona</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-lg border border-border p-5 text-center md:text-left"
              >
                <span className="font-mono text-xs font-medium text-gold">{s.n}</span>
                <h3 className="mt-3 text-sm font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="dados" className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="surface-card flex flex-col items-center gap-6 p-6 text-center md:flex-row md:items-center md:text-left md:p-8">
          <span className="gold-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
            <Database className="h-5 w-5" />
          </span>
          <div className="max-w-3xl">
            <h2 className="text-lg font-bold">Transparência sobre os dados</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              O catálogo é alimentado por cadastro e importação administrativa, com espaço para
              integrações futuras (TikTok Shop e provedores autorizados). Nenhum indicador de vendas
              ou comissão é estimado pela plataforma: o que não existe aparece como indisponível.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <span className="font-semibold text-foreground">RadarShop AI</span>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end">
            <Link to="/transparencia" className="hover:text-foreground">
              Transparência
            </Link>
            <Link to="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link to="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <span>Inteligência para afiliados do TikTok Shop · Brasil</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
