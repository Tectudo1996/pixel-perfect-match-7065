import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/mercado-pago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMercadoPagoWebhook, normalizeBillingError } = await import(
          "@/lib/billing.server"
        );

        try {
          const result = await handleMercadoPagoWebhook(request);
          return Response.json(result, { status: 200 });
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
