import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/billing/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getBillingSummary, normalizeBillingError } = await import("@/lib/billing.server");

        try {
          return Response.json(await getBillingSummary(request));
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
