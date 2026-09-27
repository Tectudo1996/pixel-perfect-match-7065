import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Boas-vindas — RadarShop AI" },
      { name: "description", content: "Configure suas preferências para personalizar o radar." },
      { property: "og:title", content: "Boas-vindas — RadarShop AI" },
      { property: "og:description", content: "Configure suas preferências para personalizar o radar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pageonboarding,
});

function Pageonboarding() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">Boas-vindas</h1>
      <p className="text-muted-foreground">Configure suas preferências para personalizar o radar.</p>
    </div>
  );
}
