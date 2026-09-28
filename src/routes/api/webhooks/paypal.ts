import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/paypal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handlePayPalWebhook, normalizeBillingError } = await import("@/lib/billing.server");

        try {
          return Response.json(await handlePayPalWebhook(request), { status: 200 });
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
