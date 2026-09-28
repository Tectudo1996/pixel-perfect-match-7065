import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/billing/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { normalizeBillingError, syncMercadoPagoBilling } =
          await import("@/lib/billing.server");

        try {
          return Response.json(await syncMercadoPagoBilling(request));
        } catch (error) {
          const normalized = normalizeBillingError(error);
          return Response.json(
            { error: normalized.message, code: normalized.code },
            { status: normalized.status },
          );
        }
      },
    },
  },
});
