import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/favoritos")({
  head: () => ({
    meta: [
      { title: "Favoritos — RadarShop AI" },
      { name: "description", content: "Seus produtos favoritos." },
      { property: "og:title", content: "Favoritos — RadarShop AI" },
      { property: "og:description", content: "Seus produtos favoritos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pagefavoritos,
});

function Pagefavoritos() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Favoritos</h1>
      <p className="text-muted-foreground">Seus produtos favoritos.</p>
    </div>
  );
}
