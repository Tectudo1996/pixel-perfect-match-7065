import { useState } from "react";
import { AlertTriangle, Download, ExternalLink, Globe2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { AdminCategory } from "@/hooks/useAdmin";
import {
  useAdminScraperImport,
  useAdminScraperPreview,
  type AdminScraperInput,
  type AdminScraperPreview,
} from "@/hooks/useAdminScraper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminScraper({
  categories,
  defaultSource,
}: {
  categories: AdminCategory[];
  defaultSource: string;
}) {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState(defaultSource);
  const [categorySlug, setCategorySlug] = useState("");
  const [preview, setPreview] = useState<AdminScraperPreview | null>(null);

  const previewMutation = useAdminScraperPreview();
  const importMutation = useAdminScraperImport();

  const input: AdminScraperInput = { url, source, categorySlug };

  async function handlePreview() {
    if (!url.trim()) {
      toast.error("Cole a URL pública de uma página de produto.");
      return;
    }

    try {
      const response = await previewMutation.mutateAsync(input);
      setPreview(response.preview);
      if (!source.trim()) setSource(response.preview.source);
      toast.success("Página analisada. Revise os dados antes de importar.");
    } catch (error) {
      setPreview(null);
      toast.error(error instanceof Error ? error.message : "Não foi possível analisar a página.");
    }
  }

  async function handleImport() {
    if (!preview) return;

    try {
      const response = await importMutation.mutateAsync(input);
      setPreview(response.preview);
      const inserted = response.result?.inserted ?? 0;
      const updated = response.result?.updated ?? 0;

      toast.success(
        inserted
          ? "Produto importado para o catálogo."
          : updated
            ? "Produto existente atualizado com a nova coleta."
            : "Coleta concluída.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar o produto.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="surface-card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
            <Globe2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Raspagem de página pública</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Cole uma página pública de produto. O Radar tenta ler JSON-LD e metadados da própria
              página e mostra uma prévia antes de gravar qualquer coisa no catálogo.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-muted/35 p-4">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Use somente páginas públicas que você esteja autorizado a coletar. O scraper não envia
              cookies, não faz login, não resolve CAPTCHA e não tenta contornar bloqueios, 403, 429
              ou regras do robots.txt.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-scraper-url">URL pública do produto</Label>
            <Input
              id="admin-scraper-url"
              type="url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setPreview(null);
              }}
              placeholder="https://exemplo.com/produto/..."
              autoComplete="url"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="admin-scraper-source">Nome da fonte</Label>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Será salva com o prefixo <span className="font-mono">scraper:</span> para não ser
                confundida com API oficial.
              </p>
              <Input
                id="admin-scraper-source"
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  setPreview(null);
                }}
                placeholder="Ex.: TikTok Shop público"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-scraper-category">Categoria</Label>
              <select
                id="admin-scraper-category"
                value={categorySlug}
                onChange={(event) => {
                  setCategorySlug(event.target.value);
                  setPreview(null);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Sem categoria definida</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Button
              type="button"
              variant="gold"
              onClick={() => void handlePreview()}
              disabled={previewMutation.isPending || importMutation.isPending}
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe2 className="h-4 w-4" />
              )}
              Analisar página
            </Button>
          </div>
        </div>
      </section>

      {preview && (
        <section className="surface-card overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Prévia da coleta
            </p>
            <h3 className="mt-1 text-lg font-semibold">{preview.name}</h3>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[180px_1fr]">
            <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
              {preview.imageUrl ? (
                <img
                  src={preview.imageUrl}
                  alt=""
                  className="aspect-square h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center text-xs text-muted-foreground">
                  Sem imagem
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewItem
                  label="Preço encontrado"
                  value={
                    preview.price !== null
                      ? formatPrice(preview.price, preview.currency)
                      : "Não informado"
                  }
                />
                <PreviewItem
                  label="Preço que será importado"
                  value={
                    preview.importPrice !== null
                      ? formatPrice(preview.importPrice, "BRL")
                      : "Não será importado"
                  }
                />
                <PreviewItem label="Loja / marca" value={preview.storeName ?? "Não informado"} />
                <PreviewItem
                  label="Extração"
                  value={preview.extraction === "json-ld" ? "JSON-LD estruturado" : "Metadados"}
                />
                <PreviewItem label="Fonte" value={preview.source} />
                <PreviewItem
                  label="Categoria"
                  value={
                    categories.find((category) => category.slug === preview.categorySlug)?.name ??
                    "Sem categoria"
                  }
                />
              </div>

              {preview.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Descrição</p>
                  <p className="mt-1 line-clamp-4 text-sm leading-relaxed">{preview.description}</p>
                </div>
              )}

              <a
                href={preview.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{preview.originalUrl}</span>
              </a>

              {preview.warnings.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-semibold">Observações da coleta</p>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                    {preview.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="gold"
                  onClick={() => void handleImport()}
                  disabled={importMutation.isPending || previewMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Importar para o catálogo
                </Button>
                <Button type="button" variant="outline" onClick={() => setPreview(null)}>
                  Limpar prévia
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function formatPrice(value: number, currency: string | null) {
  if (!currency) return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ${currency}`;
  }
}
