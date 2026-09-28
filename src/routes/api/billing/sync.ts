import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/billing/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { normalizeBillingError, syncBilling } = await import("@/lib/billing.server");

        try {
          return Response.json(await syncBilling(request));
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
