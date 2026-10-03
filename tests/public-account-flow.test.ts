import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authSource = readFileSync(new URL("../src/routes/auth.tsx", import.meta.url), "utf8");
const resetSource = readFileSync(
  new URL("../src/routes/reset-password.tsx", import.meta.url),
  "utf8",
);

test("páginas públicas de autenticação sensíveis ficam fora da indexação", () => {
  assert.match(authSource, /noindex,nofollow,noarchive/);
  assert.match(resetSource, /noindex,nofollow,noarchive/);
});

test("cadastro mantém links explícitos para Termos e Privacidade", () => {
  assert.match(authSource, /to="\/termos"/);
  assert.match(authSource, /to="\/privacidade"/);
  assert.match(authSource, /Ao criar sua conta/);
});

test("fluxo de redefinição trata link inválido e oferece nova recuperação", () => {
  assert.match(resetSource, /Link inválido ou expirado/);
  assert.match(resetSource, /search=\{\{ modo: "recuperar" \}\}/);
  assert.match(resetSource, /getSession\(\)/);
});

test("campos de credenciais informam autocomplete apropriado", () => {
  assert.match(authSource, /autoComplete="email"/);
  assert.match(authSource, /current-password/);
  assert.match(authSource, /new-password/);
  assert.match(resetSource, /autoComplete="new-password"/);
});
