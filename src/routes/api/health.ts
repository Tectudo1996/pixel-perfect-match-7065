import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            status: "ok",
            service: "radarshop-ai",
            time: new Date().toISOString(),
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        ),
    },
  },
});
