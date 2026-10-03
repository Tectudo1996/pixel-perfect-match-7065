import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const robots = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");

const protectedPaths = [
  "/dashboard",
  "/radar",
  "/meu-radar",
  "/inteligencia",
  "/favoritos",
  "/estudio",
  "/plano",
  "/perfil",
  "/configuracoes",
  "/admin",
  "/onboarding",
  "/produto/",
];

test("robots bloqueia crawling das áreas privadas autenticadas", () => {
  for (const path of protectedPaths) {
    assert.match(robots, new RegExp(`^Disallow: ${path.replace("/", "\\/")}$`, "m"), path);
  }
});

test("robots bloqueia endpoints e páginas sensíveis de autenticação", () => {
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.match(robots, /^Disallow: \/auth$/m);
  assert.match(robots, /^Disallow: \/reset-password$/m);
});

test("robots mantém a área pública disponível para crawling", () => {
  assert.match(robots, /^Allow: \/$/m);
});
