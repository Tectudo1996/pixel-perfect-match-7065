import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — RadarShop AI" },
      { name: "description", content: "Preferências da sua conta." },
      { property: "og:title", content: "Configurações — RadarShop AI" },
      { property: "og:description", content: "Preferências da sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pageconfiguracoes,
});

function Pageconfiguracoes() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
      <p className="text-muted-foreground">Preferências da sua conta.</p>
    </div>
  );
}
