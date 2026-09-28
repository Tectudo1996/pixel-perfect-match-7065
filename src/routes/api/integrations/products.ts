import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integrations/products")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleProductIngestRequest } = await import("@/lib/product-ingest.server");
        return handleProductIngestRequest(request);
      },
    },
  },
});
