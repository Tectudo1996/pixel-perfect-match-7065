import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integrations/products")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleProductMarketContentGet } =
          await import("@/lib/product-market-content.server");
        return handleProductMarketContentGet(request);
      },
      POST: async ({ request }) => {
        const { handleProductIngestRequest } = await import("@/lib/product-ingest.server");
        return handleProductIngestRequest(request);
      },
      PUT: async ({ request }) => {
        const { handleFastmossSyncRequest } = await import("@/lib/product-ingest.server");
        return handleFastmossSyncRequest(request);
      },
      PATCH: async ({ request }) => {
        const { handleProductMarketContentRefresh } =
          await import("@/lib/product-market-content.server");
        return handleProductMarketContentRefresh(request);
      },
    },
  },
});
