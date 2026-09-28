import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, requireApiUserId } from "@/lib/api-auth.server";
import { getPlanUsage } from "@/lib/usage.server";

export const Route = createFileRoute("/api/usage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await requireApiUserId(request);
          return Response.json(await getPlanUsage(userId));
        } catch (error) {
          if (error instanceof ApiAuthError) {
            return Response.json(
              { error: error.message, code: error.code },
              { status: error.status },
            );
          }

          console.error("[RadarShop AI] usage route error", error);
          return Response.json(
            { error: "Não foi possível carregar os dados do plano.", code: "USAGE_INTERNAL_ERROR" },
            { status: 500 },
          );
        }
      },
    },
  },
});
