import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/produto/$id")({
  head: () => ({
    meta: [
      { title: "Análise do Produto — RadarShop AI" },
      { name: "description", content: "Detalhes e análise do produto." },
      { property: "og:title", content: "Análise do Produto — RadarShop AI" },
      { property: "og:description", content: "Detalhes e análise do produto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageProduto,
});

function PageProduto() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Análise do Produto</h1>
      <p className="text-muted-foreground">Detalhes e análise do produto.</p>
    </div>
  );
}
