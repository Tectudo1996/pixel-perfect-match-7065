import assert from "node:assert/strict";
import test from "node:test";

import { readJsonBody, RequestBodyError } from "../src/lib/request-body.server.ts";

test("readJsonBody aceita JSON válido dentro do limite", async () => {
  const request = new Request("https://radarshop.test/api", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ok: true, value: 7 }),
  });

  const result = await readJsonBody(request, 1024);

  assert.deepEqual(result, { ok: true, value: 7 });
});

test("readJsonBody rejeita content-type diferente de JSON", async () => {
  const request = new Request("https://radarshop.test/api", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  });

  await assert.rejects(
    () => readJsonBody(request, 1024),
    (error) =>
      error instanceof RequestBodyError &&
      error.status === 415 &&
      error.code === "UNSUPPORTED_MEDIA_TYPE",
  );
});

test("readJsonBody bloqueia payload declarado acima do limite", async () => {
  const request = new Request("https://radarshop.test/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": "9999",
    },
    body: "{}",
  });

  await assert.rejects(
    () => readJsonBody(request, 64),
    (error) =>
      error instanceof RequestBodyError &&
      error.status === 413 &&
      error.code === "PAYLOAD_TOO_LARGE",
  );
});

test("readJsonBody rejeita JSON inválido", async () => {
  const request = new Request("https://radarshop.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid",
  });

  await assert.rejects(
    () => readJsonBody(request, 1024),
    (error) =>
      error instanceof RequestBodyError &&
      error.status === 400 &&
      error.code === "INVALID_JSON",
  );
});
