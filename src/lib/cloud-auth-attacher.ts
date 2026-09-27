import { createMiddleware } from "@tanstack/react-start";
import { cloudClient } from "@/lib/cloud-client";

export const attachCloudAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await cloudClient.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});