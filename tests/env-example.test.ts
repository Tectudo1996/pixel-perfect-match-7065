import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

const requiredDocumentedKeys = [
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LOVABLE_AI_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_BASE_URL",
  "PRODUCT_INGEST_SECRET",
  "AI_USAGE_LIMITS_ENABLED",
  "AI_FREE_MONTHLY_LIMIT",
  "AI_PRO_MONTHLY_LIMIT",
  "MERCADO_PAGO_BILLING_ENABLED",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "MERCADO_PAGO_PRO_MONTHLY_BRL",
  "MERCADO_PAGO_PRO_REASON",
  "APP_PUBLIC_URL",
  "PAYPAL_BILLING_ENABLED",
  "PAYPAL_ENVIRONMENT",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_PLAN_ID",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_PRO_MONTHLY_BRL",
  "PAYPAL_BRAND_NAME",
  "PEPPER_BILLING_ENABLED",
  "PEPPER_CHECKOUT_URL",
  "PEPPER_PRO_MONTHLY_BRL",
  "TIKTOK_SHOP_AFFILIATE_ENABLED",
  "TIKTOK_SHOP_APP_KEY",
  "TIKTOK_SHOP_APP_SECRET",
  "TIKTOK_SHOP_TOKEN_ENCRYPTION_KEY",
];

const serverOnlySecrets = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "PRODUCT_INGEST_SECRET",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "PAYPAL_CLIENT_SECRET",
  "TIKTOK_SHOP_APP_SECRET",
  "TIKTOK_SHOP_TOKEN_ENCRYPTION_KEY",
];

const disabledByDefaultFlags = [
  "AI_USAGE_LIMITS_ENABLED",
  "MERCADO_PAGO_BILLING_ENABLED",
  "PAYPAL_BILLING_ENABLED",
  "PEPPER_BILLING_ENABLED",
  "TIKTOK_SHOP_AFFILIATE_ENABLED",
];

function readExampleValue(key: string) {
  const match = envExample.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1] ?? null;
}

test(".env.example documenta todas as configurações operacionais críticas", () => {
  for (const key of requiredDocumentedKeys) {
    assert.notEqual(readExampleValue(key), null, `${key} não está documentada no .env.example`);
  }

  assert.match(
    envExample,
    /LOVABLE_API_KEY.*gerenciada automaticamente|LOVABLE_API_KEY.*managed automatically/i,
  );
});

test("segredos server-only não possuem variantes VITE documentadas", () => {
  for (const secret of serverOnlySecrets) {
    assert.equal(
      readExampleValue(`VITE_${secret}`),
      null,
      `VITE_${secret} não deve existir: isso exporia o segredo ao navegador`,
    );
  }
});

test("integrações sensíveis permanecem desligadas por padrão", () => {
  for (const flag of disabledByDefaultFlags) {
    assert.equal(readExampleValue(flag), "false", `${flag} deve começar como false`);
  }
});

test("preços comerciais continuam sem valor inventado antes da decisão de lançamento", () => {
  assert.equal(readExampleValue("MERCADO_PAGO_PRO_MONTHLY_BRL"), "");
  assert.equal(readExampleValue("PAYPAL_PRO_MONTHLY_BRL"), "");
  assert.equal(readExampleValue("PEPPER_PRO_MONTHLY_BRL"), "");
});
