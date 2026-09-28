import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ApiAuthError, requireApiUserId } from "@/lib/api-auth.server";
import { readJsonBody } from "@/lib/request-body.server";

const discoveryRequestSchema = z.object({
  search: z.string().trim().max(255).optional(),
  sort: z.enum(["commission", "sales"]).default("commission"),
  pageToken: z.string().trim().max(2048).optional(),
});

export const Route = createFileRoute("/api/integrations/tiktok-shop/discovery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { normalizeTikTokShopError, searchTikTokCreatorOpportunities } =
          await import("@/lib/tiktok-shop.server");

        try {
          const userId = await requireApiUserId(request);
          const body = discoveryRequestSchema.parse(await readJsonBody(request, 8_192));

          return Response.json(
            await searchTikTokCreatorOpportunities(userId, {
              ...(body.search ? { search: body.search } : {}),
              sort: body.sort,
              ...(body.pageToken ? { pageToken: body.pageToken } : {}),
            }),
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
              { error: "Os filtros enviados são inválidos.", code: "TIKTOK_DISCOVERY_INVALID" },
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
