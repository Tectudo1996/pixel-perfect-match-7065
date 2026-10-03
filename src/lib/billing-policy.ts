export type BillingProvider = "mercado_pago" | "paypal" | "pepper";

export type ExistingBillingLink = {
  billing_provider: string | null;
  billing_external_id: string | null;
  billing_status: string | null;
};

const TERMINAL_BILLING_STATUSES = new Set(["canceled", "cancelled", "expired", "inactive"]);

export function normalizePayPalStatus(status: string | undefined) {
  if (status === "ACTIVE") return "authorized";
  if (status === "SUSPENDED") return "paused";
  if (status === "CANCELLED" || status === "EXPIRED") return "canceled";
  if (status === "APPROVED" || status === "APPROVAL_PENDING") return "pending";
  return status?.toLowerCase() || "unknown";
}

export function normalizeBillingProvider(value: string | null | undefined): BillingProvider | null {
  return value === "mercado_pago" || value === "paypal" || value === "pepper" ? value : null;
}

export function canSwitchBillingGateway(
  existing: ExistingBillingLink | null,
  requestedProvider: BillingProvider,
) {
  if (!existing?.billing_provider || existing.billing_provider === requestedProvider) {
    return true;
  }

  if (
    existing.billing_status &&
    TERMINAL_BILLING_STATUSES.has(existing.billing_status.toLowerCase())
  ) {
    return true;
  }

  return false;
}

export function normalizeExternalCheckoutUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function readPositiveMoney(value: string | undefined) {
  if (!value) return null;

  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

export function normalizePublicUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    if (url.protocol !== "https:" && !local) return null;

    return url.origin;
  } catch {
    return null;
  }
}
