import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel admin — RadarShop AI" },
      { name: "description", content: "Administração da plataforma." },
      { property: "og:title", content: "Painel admin — RadarShop AI" },
      { property: "og:description", content: "Administração da plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pageadmin,
});

function Pageadmin() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Painel admin</h1>
      <p className="text-muted-foreground">Administração da plataforma.</p>
    </div>
  );
}
