import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, requireApiUserId } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/integrations/tiktok-shop/showcase/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { normalizeTikTokShopError, syncTikTokShowcaseToRadar } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          const url = new URL(request.url);
          const originParam = url.searchParams.get("origin")?.toUpperCase();
          const origin = originParam === "LIVE" ? "LIVE" : "SHOWCASE";
          const maxPagesRaw = url.searchParams.get("max_pages");
          const maxPages = maxPagesRaw ? Number(maxPagesRaw) : 5;

          return Response.json(
            await syncTikTokShowcaseToRadar(userId, {
              origin,
              maxPages,
            }),
          );
        } catch (error) {
          if (error instanceof ApiAuthError) {
            return Response.json(
              { error: error.message, code: error.code },
              { status: error.status },
            );
          }

          const normalized = normalizeTikTokShopError(error);
          return Response.json(
            { error: normalized.message, code: normalized.code },
            { status: normalized.status },
          );
        }
      },
    },
  },
});
