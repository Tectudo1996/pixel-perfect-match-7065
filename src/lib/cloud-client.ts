import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";

// Both values are public browser credentials. Keeping them here prevents a
// hosted bundle from depending on environment aliases that only exist server-side.
const CLOUD_URL = "https://rpocaokydibuypwpzptg.supabase.co";
const CLOUD_PUBLISHABLE_KEY = "sb_publishable_hnb3ARnYzYP49uqZ11Ub2g_QPXqloVj";

function cloudFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(
    typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
  );

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  if (headers.get("Authorization") === `Bearer ${CLOUD_PUBLISHABLE_KEY}`) {
    headers.delete("Authorization");
  }

  headers.set("apikey", CLOUD_PUBLISHABLE_KEY);
  return fetch(input, { ...init, headers });
}

export const cloudClient = createClient<Database>(CLOUD_URL, CLOUD_PUBLISHABLE_KEY, {
  global: { fetch: cloudFetch },
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});