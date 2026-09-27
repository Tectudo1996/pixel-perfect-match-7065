import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({
    meta: [
      { title: "Radar de Produtos — RadarShop AI" },
      { name: "description", content: "Descubra produtos em alta para divulgar." },
      { property: "og:title", content: "Radar de Produtos — RadarShop AI" },
      { property: "og:description", content: "Descubra produtos em alta para divulgar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pageradar,
});

function Pageradar() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Radar de Produtos</h1>
      <p className="text-muted-foreground">Descubra produtos em alta para divulgar.</p>
    </div>
  );
}
