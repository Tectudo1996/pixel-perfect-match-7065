import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, requireApiUserId } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/integrations/tiktok-shop/authorize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { createTikTokCreatorAuthorization, normalizeTikTokShopError } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          return Response.json(await createTikTokCreatorAuthorization(userId));
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
