import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ApiAuthError, requireApiUserId } from "@/lib/api-auth.server";

const historyQuerySchema = z.object({
  productId: z.string().trim().min(1).max(255),
  limit: z.coerce.number().int().min(2).max(30).optional(),
});

export const Route = createFileRoute("/api/integrations/tiktok-shop/tracked/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getTikTokOpportunityHistory, normalizeTikTokShopError } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          const url = new URL(request.url);
          const query = historyQuerySchema.parse({
            productId: url.searchParams.get("productId"),
            limit: url.searchParams.get("limit") ?? undefined,
          });

          return Response.json(
            await getTikTokOpportunityHistory(userId, query.productId, query.limit),
          );
        } catch (error) {
          if (error instanceof ApiAuthError) {
            return Response.json(
              { error: error.message, code: error.code },
              { status: error.status },
            );
          }

          if (error instanceof z.ZodError) {
            return Response.json(
              { error: "A consulta do histórico é inválida.", code: "TIKTOK_HISTORY_INVALID" },
              { status: 400 },
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
