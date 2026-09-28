import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, requireApiUserId } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/integrations/tiktok-shop/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getTikTokShopConnectionStatus, normalizeTikTokShopError } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          return Response.json(await getTikTokShopConnectionStatus(userId));
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
      DELETE: async ({ request }) => {
        const { disconnectTikTokShop, normalizeTikTokShopError } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          await disconnectTikTokShop(userId);
          return Response.json({ ok: true });
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
