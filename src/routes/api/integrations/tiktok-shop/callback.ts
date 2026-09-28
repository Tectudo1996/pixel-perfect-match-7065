import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integrations/tiktok-shop/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const {
          completeTikTokCreatorAuthorization,
          matchesTikTokShopAppKey,
          normalizeTikTokShopError,
        } = await import("@/lib/tiktok-shop.server");

        const url = new URL(request.url);
        const code = url.searchParams.get("code")?.trim() ?? "";
        const state = url.searchParams.get("state")?.trim() ?? "";
        const appKey = url.searchParams.get("app_key");

        if (!code || !state || !matchesTikTokShopAppKey(appKey)) {
          return redirectToSettings(request, "error");
        }

        try {
          await completeTikTokCreatorAuthorization(state, code);
          return redirectToSettings(request, "connected");
        } catch (error) {
          const normalized = normalizeTikTokShopError(error);
          console.error("[RadarShop AI] TikTok Shop OAuth callback", normalized.code);
          return redirectToSettings(request, "error");
        }
      },
    },
  },
});

function redirectToSettings(request: Request, status: "connected" | "error") {
  const configuredBase = process.env["APP_PUBLIC_URL"]?.trim();
  const baseUrl = configuredBase || new URL(request.url).origin;
  const destination = new URL("/configuracoes", baseUrl);
  destination.searchParams.set("integracao", "tiktok-shop");
  destination.searchParams.set("status", status);

  return Response.redirect(destination, 302);
}
