export const brl = (value: number | null | undefined) =>
  value === null || value === undefined
    ? null
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));

export const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? null : `${Number(value).toFixed(1).replace(".", ",")}%`;

export const dateBR = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : null;

export const num = (value: number | null | undefined) =>
  value === null || value === undefined ? null : new Intl.NumberFormat("pt-BR").format(value);

/** Valor não disponível: nunca inventar números. */
export const NA = "Não disponível";
