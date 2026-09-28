import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/subscriptions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleAdminSubscriptionsGet } = await import("@/lib/admin-subscriptions.server");
        return handleAdminSubscriptionsGet(request);
      },
      PATCH: async ({ request }) => {
        const { handleAdminSubscriptionsPatch } = await import("@/lib/admin-subscriptions.server");
        return handleAdminSubscriptionsPatch(request);
      },
    },
  },
});
