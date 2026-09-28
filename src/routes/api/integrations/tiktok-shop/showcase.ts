import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, requireApiUserId } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/integrations/tiktok-shop/showcase")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getTikTokShowcaseProducts, normalizeTikTokShopError } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          const url = new URL(request.url);
          const originParam = url.searchParams.get("origin")?.toUpperCase();
          const origin = originParam === "LIVE" ? "LIVE" : "SHOWCASE";
          const pageSizeRaw = url.searchParams.get("page_size");
          const pageSize = pageSizeRaw ? Number(pageSizeRaw) : 20;
          const pageToken = url.searchParams.get("page_token") ?? undefined;

          return Response.json(
            await getTikTokShowcaseProducts(userId, {
              origin,
              pageSize,
              pageToken,
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
