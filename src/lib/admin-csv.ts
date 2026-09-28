import type { AdminCategory, AdminImportProduct } from "@/hooks/useAdmin";

type CanonicalHeader =
  | "name"
  | "description"
  | "image_url"
  | "category_slug"
  | "price"
  | "commission_amount"
  | "commission_percent"
  | "store_name"
  | "original_url"
  | "sales_count"
  | "creators_count"
  | "source"
  | "collected_at";

export type CsvPreviewRow = {
  line: number;
  name: string;
  source: string;
  errors: string[];
  values: AdminImportProduct | null;
};

export type CsvImportPreview = {
  delimiter: "," | ";";
  fatalErrors: string[];
  rows: CsvPreviewRow[];
};

const HEADER_ALIASES: Record<string, CanonicalHeader> = {
  name: "name",
  nome: "name",
  description: "description",
  descricao: "description",
  image_url: "image_url",
  imagem: "image_url",
  category_slug: "category_slug",
  categoria_slug: "category_slug",
  categoria: "category_slug",
  price: "price",
  preco: "price",
  commission_amount: "commission_amount",
  comissao: "commission_amount",
  commission_percent: "commission_percent",
  comissao_percentual: "commission_percent",
  store_name: "store_name",
  loja: "store_name",
  original_url: "original_url",
  url: "original_url",
  sales_count: "sales_count",
  vendas: "sales_count",
  creators_count: "creators_count",
  criadores: "creators_count",
  source: "source",
  fonte: "source",
  collected_at: "collected_at",
  coletado_em: "collected_at",
  data_coleta: "collected_at",
};

export function parseAdminProductCsv(
  input: string,
  categories: AdminCategory[],
  defaultSource: string,
): CsvImportPreview {
  const text = input.replace(/^\uFEFF/, "").trim();
  const delimiter = detectDelimiter(text);

  if (!text) {
    return {
      delimiter,
      fatalErrors: ["O arquivo CSV está vazio."],
      rows: [],
    };
  }

  const rawRows = parseDelimited(text, delimiter);

  if (rawRows.length < 2) {
    return {
      delimiter,
      fatalErrors: ["O CSV precisa ter um cabeçalho e pelo menos uma linha de produto."],
      rows: [],
    };
  }

  const headerRow = rawRows[0];

  if (!headerRow) {
    return {
      delimiter,
      fatalErrors: ["O CSV não contém um cabeçalho válido."],
      rows: [],
    };
  }

  const headers = headerRow.map((header) => HEADER_ALIASES[normalizeHeader(header)] ?? null);
  const fatalErrors: string[] = [];

  if (!headers.includes("name")) {
    fatalErrors.push('O cabeçalho precisa conter "name" ou "nome".');
  }

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));
  const rows = rawRows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row, index) =>
      validateRow(row, headers, index + 2, categoryBySlug, defaultSource.trim()),
    );

  if (rows.length > 500) {
    fatalErrors.push("Importe no máximo 500 produtos por arquivo.");
  }

  return { delimiter, fatalErrors, rows };
}

function validateRow(
  cells: string[],
  headers: Array<CanonicalHeader | null>,
  line: number,
  categoryBySlug: Map<string, string>,
  defaultSource: string,
): CsvPreviewRow {
  const data = new Map<CanonicalHeader, string>();

  headers.forEach((header, index) => {
    if (header) data.set(header, (cells[index] ?? "").trim());
  });

  const errors: string[] = [];
  const name = data.get("name")?.trim() ?? "";
  const source = data.get("source")?.trim() || defaultSource;

  if (!name) errors.push("Nome obrigatório.");
  if (!source) errors.push("Fonte obrigatória no CSV ou nas configurações.");

  const categorySlug = data.get("category_slug")?.trim() ?? "";
  const categoryId = categorySlug ? (categoryBySlug.get(categorySlug) ?? null) : null;

  if (categorySlug && !categoryId) {
    errors.push('Categoria "' + categorySlug + '" não existe.');
  }

  const price = parseDecimal(data.get("price"), "Preço", errors);
  const commissionAmount = parseDecimal(data.get("commission_amount"), "Comissão em R$", errors);
  const commissionPercent = parseDecimal(
    data.get("commission_percent"),
    "Comissão percentual",
    errors,
    100,
  );
  const salesCount = parseInteger(data.get("sales_count"), "Vendas", errors);
  const creatorsCount = parseInteger(data.get("creators_count"), "Criadores", errors);
  const originalUrl = nullableText(data.get("original_url"));
  const imageUrl = nullableText(data.get("image_url"));

  if (originalUrl && !isHttpUrl(originalUrl)) {
    errors.push("URL original inválida.");
  }

  if (imageUrl && !isHttpUrl(imageUrl)) {
    errors.push("URL da imagem inválida.");
  }

  const collectedAt = parseDate(data.get("collected_at"), errors);

  const values: AdminImportProduct | null =
    errors.length === 0
      ? {
          name,
          description: nullableText(data.get("description")),
          image_url: imageUrl,
          category_id: categoryId,
          price,
          commission_amount: commissionAmount,
          commission_percent: commissionPercent,
          store_name: nullableText(data.get("store_name")),
          original_url: originalUrl,
          sales_count: salesCount,
          creators_count: creatorsCount,
          source,
          collected_at: collectedAt,
        }
      : null;

  return { line, name, source, errors, values };
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function nullableText(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function parseDecimal(raw: string | undefined, label: string, errors: string[], max?: number) {
  if (!raw?.trim()) return null;

  const cleaned = raw.trim().replace(/R\$/gi, "").replace(/%/g, "").replace(/\s/g, "");
  let normalized = cleaned;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const value = Number(normalized);

  if (!Number.isFinite(value) || value < 0) {
    errors.push(label + " inválido.");
    return null;
  }

  if (max !== undefined && value > max) {
    errors.push(label + " deve ser no máximo " + max + ".");
    return null;
  }

  return value;
}

function parseInteger(raw: string | undefined, label: string, errors: string[]) {
  if (!raw?.trim()) return null;

  const value = parseDecimal(raw, label, errors);

  if (value === null) return null;

  if (!Number.isInteger(value)) {
    errors.push(label + " precisa ser inteiro.");
    return null;
  }

  return value;
}

function parseDate(raw: string | undefined, errors: string[]) {
  if (!raw?.trim()) return new Date().toISOString();

  const value = raw.trim();
  const brazilian = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brazilian) {
    const date = new Date(
      Date.UTC(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1])),
    );

    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    errors.push("Data de coleta inválida.");
    return new Date().toISOString();
  }

  return date.toISOString();
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return countDelimiter(firstLine, ";") > countDelimiter(firstLine, ",") ? ";" : ",";
}

function countDelimiter(line: string, delimiter: "," | ";") {
  let count = 0;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      count += 1;
    }
  }

  return count;
}

function parseDelimited(text: string, delimiter: "," | ";") {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);

  return rows;
}
