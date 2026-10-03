import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync(
  new URL("../src/lib/admin-scraper.server.ts", import.meta.url),
  "utf8",
);
const componentSource = readFileSync(
  new URL("../src/components/admin-scraper.tsx", import.meta.url),
  "utf8",
);
const adminSource = readFileSync(
  new URL("../src/routes/_authenticated/admin.tsx", import.meta.url),
  "utf8",
);

test("scraper administrativo exige role admin no servidor", () => {
  assert.match(serverSource, /requireApiAdmin\(request\)/);
});

test("scraper protege contra acesso a redes locais e portas personalizadas", () => {
  assert.match(serverSource, /hostname === "localhost"/);
  assert.match(serverSource, /hostname\.endsWith\("\.local"\)/);
  assert.match(serverSource, /hostname\.endsWith\("\.internal"\)/);
  assert.match(serverSource, /isPrivateAddress/);
  assert.match(serverSource, /SCRAPER_UNSAFE_PORT/);
  assert.match(serverSource, /lookup\(hostname/);
});

test("URLs de imagem também passam pela validação de destino público", () => {
  assert.match(serverSource, /normalizePublicAssetUrl/);
  assert.match(serverSource, /validatePublicUrl\(resolved\.toString\(\)\)/);
});

test("scraper não tenta contornar proteção de acesso ou rate limit", () => {
  assert.match(serverSource, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(serverSource, /SCRAPER_ACCESS_RESTRICTED/);
  assert.match(serverSource, /response\.status === 429/);
  assert.match(serverSource, /SCRAPER_RATE_LIMITED/);
  assert.doesNotMatch(serverSource, /Cookie:/i);
  assert.doesNotMatch(serverSource, /Authorization.*fetch/i);
});

test("scraper consulta robots e limita tempo, redirects e tamanho da página", () => {
  assert.match(serverSource, /robots\.txt/);
  assert.match(serverSource, /SCRAPER_ROBOTS_DISALLOWED/);
  assert.match(serverSource, /MAX_REDIRECTS = 3/);
  assert.match(serverSource, /FETCH_TIMEOUT_MS = 12_000/);
  assert.match(serverSource, /MAX_HTML_BYTES = 2_000_000/);
});

test("scraper prioriza dados estruturados e não inventa métricas de afiliado", () => {
  assert.match(serverSource, /application\\\/ld\\\+json/);
  assert.match(serverSource, /json-ld/);
  assert.match(serverSource, /commission_amount: null/);
  assert.match(serverSource, /commission_percent: null/);
  assert.match(serverSource, /sales_count: null/);
  assert.match(serverSource, /creators_count: null/);
});

test("preço só entra no catálogo quando a moeda detectada é BRL", () => {
  assert.match(serverSource, /const importPrice = currency === "BRL" \? price : null/);
});

test("origem coletada pelo scraper fica identificada separadamente da API oficial", () => {
  assert.match(serverSource, /source = raw\.toLowerCase\(\)\.startsWith\("scraper:"\)/);
  assert.match(serverSource, /`scraper:\$\{raw\}`/);
});

test("admin mostra prévia antes da importação e explica os limites do scraper", () => {
  assert.match(componentSource, /Prévia da coleta/);
  assert.match(componentSource, /Analisar página/);
  assert.match(componentSource, /Importar para o catálogo/);
  assert.match(componentSource, /não resolve CAPTCHA/);
  assert.match(adminSource, /setTab\("scraper"\)/);
  assert.match(adminSource, />\s*Raspagem\s*</);
});
