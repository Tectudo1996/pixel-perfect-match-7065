import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/estudio")({
  head: () => ({
    meta: [
      { title: "Estúdio de Conteúdo — RadarShop AI" },
      { name: "description", content: "Crie roteiros e conteúdos para seus produtos." },
      { property: "og:title", content: "Estúdio de Conteúdo — RadarShop AI" },
      { property: "og:description", content: "Crie roteiros e conteúdos para seus produtos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pageestudio,
});

function Pageestudio() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Estúdio de Conteúdo</h1>
      <p className="text-muted-foreground">Crie roteiros e conteúdos para seus produtos.</p>
    </div>
  );
}
