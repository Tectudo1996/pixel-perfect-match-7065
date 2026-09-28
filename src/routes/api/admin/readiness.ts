import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/readiness")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleAdminReadinessGet } = await import("@/lib/readiness.server");
        return handleAdminReadinessGet(request);
      },
    },
  },
});
