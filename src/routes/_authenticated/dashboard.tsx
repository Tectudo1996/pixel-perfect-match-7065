import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — RadarShop AI" },
      { name: "description", content: "Visão geral das oportunidades e do seu radar." },
      { property: "og:title", content: "Dashboard — RadarShop AI" },
      { property: "og:description", content: "Visão geral das oportunidades e do seu radar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pagedashboard,
});

function Pagedashboard() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="text-muted-foreground">Visão geral das oportunidades e do seu radar.</p>
    </div>
  );
}
