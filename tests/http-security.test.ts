import assert from "node:assert/strict";
import test from "node:test";

import { applySecurityHeaders } from "../src/lib/http-security.ts";

test("API recebe no-store, Vary e noindex", () => {
  const request = new Request("https://radarshop.test/api/health", {
    headers: { Authorization: "Bearer teste" },
  });
  const response = applySecurityHeaders(request, new Response("ok"));

  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.match(response.headers.get("vary") ?? "", /Authorization/i);
  assert.equal(
    response.headers.get("x-robots-tag"),
    "noindex, nofollow, noarchive",
  );
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.ok(response.headers.get("x-request-id"));
});

test("rota autenticada recebe noindex", () => {
  const request = new Request("https://radarshop.test/dashboard");
  const response = applySecurityHeaders(request, new Response("ok"));

  assert.equal(
    response.headers.get("x-robots-tag"),
    "noindex, nofollow, noarchive",
  );
});

test("landing pública não recebe noindex", () => {
  const request = new Request("https://radarshop.test/");
  const response = applySecurityHeaders(request, new Response("ok"));

  assert.equal(response.headers.get("x-robots-tag"), null);
  assert.equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
  );
});
