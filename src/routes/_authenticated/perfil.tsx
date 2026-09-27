import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — RadarShop AI" },
      { name: "description", content: "Seus dados de conta." },
      { property: "og:title", content: "Meu Perfil — RadarShop AI" },
      { property: "og:description", content: "Seus dados de conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pageperfil,
});

function Pageperfil() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Meu Perfil</h1>
      <p className="text-muted-foreground">Seus dados de conta.</p>
    </div>
  );
}
