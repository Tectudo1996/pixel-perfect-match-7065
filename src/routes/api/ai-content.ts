import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai-content")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleAiContentRequest } = await import("@/lib/ai-content.server");
        return handleAiContentRequest(request);
      },
    },
  },
});
