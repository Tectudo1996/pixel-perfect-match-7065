import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ApiAuthError, requireApiUserId } from "@/lib/api-auth.server";
import { readJsonBody } from "@/lib/request-body.server";

const productRequestSchema = z.object({
  productId: z.string().trim().min(1).max(255),
});

export const Route = createFileRoute("/api/integrations/tiktok-shop/tracked")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { listTikTokTrackedOpportunities, normalizeTikTokShopError } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          return Response.json({
            products: await listTikTokTrackedOpportunities(userId),
          });
        } catch (error) {
          return tikTokErrorResponse(error, normalizeTikTokShopError);
        }
      },

      POST: async ({ request }) => {
        const { normalizeTikTokShopError, trackTikTokCreatorOpportunity } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          const body = productRequestSchema.parse(await readJsonBody(request, 4_096));
          return Response.json({
            product: await trackTikTokCreatorOpportunity(userId, body.productId),
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            return Response.json(
              { error: "O produto informado é inválido.", code: "TIKTOK_TRACK_INVALID" },
              { status: 400 },
            );
          }

          return tikTokErrorResponse(error, normalizeTikTokShopError);
        }
      },

      DELETE: async ({ request }) => {
        const { normalizeTikTokShopError, untrackTikTokCreatorOpportunity } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          const body = productRequestSchema.parse(await readJsonBody(request, 4_096));
          return Response.json(await untrackTikTokCreatorOpportunity(userId, body.productId));
        } catch (error) {
          if (error instanceof z.ZodError) {
            return Response.json(
              { error: "O produto informado é inválido.", code: "TIKTOK_TRACK_INVALID" },
              { status: 400 },
            );
          }

          return tikTokErrorResponse(error, normalizeTikTokShopError);
        }
      },
    },
  },
});

function tikTokErrorResponse(
  error: unknown,
  normalize: (value: unknown) => { message: string; code: string; status: number },
) {
  if (error instanceof ApiAuthError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }

  const normalized = normalize(error);
  return Response.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.status },
  );
}
