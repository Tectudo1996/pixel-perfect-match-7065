import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { createMercadoPagoCheckout, normalizeBillingError } = await import(
          "@/lib/billing.server"
        );

        try {
          return Response.json(await createMercadoPagoCheckout(request));
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
