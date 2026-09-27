import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/meu-radar")({
  head: () => ({
    meta: [
      { title: "Meu Radar — RadarShop AI" },
      { name: "description", content: "Produtos que você está acompanhando." },
      { property: "og:title", content: "Meu Radar — RadarShop AI" },
      { property: "og:description", content: "Produtos que você está acompanhando." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pagemeuradar,
});

function Pagemeuradar() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Meu Radar</h1>
      <p className="text-muted-foreground">Produtos que você está acompanhando.</p>
    </div>
  );
}
