export const money = (value: number | null | undefined, currency = "BRL") => {
  if (value === null || value === undefined) return null;

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.trim().toUpperCase() || "BRL",
    }).format(Number(value));
  } catch {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(Number(value));
  }
};

export const brl = (value: number | null | undefined) => money(value, "BRL");

export const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? null : `${Number(value).toFixed(1).replace(".", ",")}%`;

export const dateBR = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : null;

export const num = (value: number | null | undefined) =>
  value === null || value === undefined ? null : new Intl.NumberFormat("pt-BR").format(value);

/** Valor não disponível: nunca inventar números. */
export const NA = "Não disponível";
