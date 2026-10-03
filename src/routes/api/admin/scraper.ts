import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/scraper")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleAdminScraperPost } = await import("@/lib/admin-scraper.server");
        return handleAdminScraperPost(request);
      },
    },
  },
});
