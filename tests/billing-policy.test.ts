import assert from "node:assert/strict";
import test from "node:test";

import {
  canSwitchBillingGateway,
  normalizeBillingProvider,
  normalizeExternalCheckoutUrl,
  normalizePayPalStatus,
  normalizePublicUrl,
  readPositiveMoney,
} from "../src/lib/billing-policy.ts";

test("status do PayPal é normalizado para o vocabulário interno", () => {
  assert.equal(normalizePayPalStatus("ACTIVE"), "authorized");
  assert.equal(normalizePayPalStatus("SUSPENDED"), "paused");
  assert.equal(normalizePayPalStatus("CANCELLED"), "canceled");
  assert.equal(normalizePayPalStatus("EXPIRED"), "canceled");
  assert.equal(normalizePayPalStatus("APPROVED"), "pending");
  assert.equal(normalizePayPalStatus("APPROVAL_PENDING"), "pending");
  assert.equal(normalizePayPalStatus("SOMETHING_NEW"), "something_new");
  assert.equal(normalizePayPalStatus(undefined), "unknown");
});

test("somente gateways suportados são aceitos", () => {
  assert.equal(normalizeBillingProvider("mercado_pago"), "mercado_pago");
  assert.equal(normalizeBillingProvider("paypal"), "paypal");
  assert.equal(normalizeBillingProvider("pepper"), "pepper");
  assert.equal(normalizeBillingProvider("stripe"), null);
  assert.equal(normalizeBillingProvider(""), null);
  assert.equal(normalizeBillingProvider(null), null);
});

test("troca de gateway só é liberada quando o fluxo anterior terminou", () => {
  assert.equal(canSwitchBillingGateway(null, "paypal"), true);

  assert.equal(
    canSwitchBillingGateway(
      {
        billing_provider: "paypal",
        billing_external_id: "sub_1",
        billing_status: "active",
      },
      "paypal",
    ),
    true,
  );

  for (const status of ["canceled", "cancelled", "expired", "inactive", "CANCELED"]) {
    assert.equal(
      canSwitchBillingGateway(
        {
          billing_provider: "mercado_pago",
          billing_external_id: "sub_1",
          billing_status: status,
        },
        "paypal",
      ),
      true,
      status,
    );
  }

  for (const status of ["active", "authorized", "pending", "paused", null]) {
    assert.equal(
      canSwitchBillingGateway(
        {
          billing_provider: "mercado_pago",
          billing_external_id: "sub_1",
          billing_status: status,
        },
        "paypal",
      ),
      false,
      String(status),
    );
  }
});

test("checkout externo só aceita HTTPS", () => {
  assert.equal(
    normalizeExternalCheckoutUrl("https://checkout.example.com/pay?id=1"),
    "https://checkout.example.com/pay?id=1",
  );
  assert.equal(normalizeExternalCheckoutUrl("http://checkout.example.com/pay"), null);
  assert.equal(normalizeExternalCheckoutUrl("javascript:alert(1)"), null);
  assert.equal(normalizeExternalCheckoutUrl("nao-e-url"), null);
});

test("URL pública exige HTTPS, exceto desenvolvimento local", () => {
  assert.equal(normalizePublicUrl("https://radar.example.com/app"), "https://radar.example.com");
  assert.equal(normalizePublicUrl("http://radar.example.com"), null);
  assert.equal(normalizePublicUrl("http://localhost:3000/app"), "http://localhost:3000");
  assert.equal(normalizePublicUrl("http://127.0.0.1:5173"), "http://127.0.0.1:5173");
  assert.equal(normalizePublicUrl("nao-e-url"), null);
});

test("preço positivo aceita vírgula e arredonda para centavos", () => {
  assert.equal(readPositiveMoney("29,90"), 29.9);
  assert.equal(readPositiveMoney("10.999"), 11);
  assert.equal(readPositiveMoney("0"), null);
  assert.equal(readPositiveMoney("-1"), null);
  assert.equal(readPositiveMoney("abc"), null);
  assert.equal(readPositiveMoney(undefined), null);
});
