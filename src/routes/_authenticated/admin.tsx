import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  FileSpreadsheet,
  FolderCog,
  Loader2,
  PackagePlus,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPlanManagement } from "@/components/admin-plan-management";
import { AdminReadiness } from "@/components/admin-readiness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminCategories,
  useAdminImportDefaults,
  useAdminIngestionRuns,
  useAdminOverview,
  useAdminProducts,
  useAdminUsers,
  useCreateAdminCategory,
  useCreateAdminProduct,
  useDeleteAdminCategory,
  useDeleteAdminProduct,
  useImportAdminProducts,
  useSaveImportDefaults,
  useUpdateAdminCategory,
  useUpdateAdminProduct,
  type AdminCategory,
  type AdminIngestionRun,
  type AdminProduct,
  type AdminProductValues,
} from "@/hooks/useAdmin";
import { useIsAdmin } from "@/hooks/useAuth";
import { parseAdminProductCsv } from "@/lib/admin-csv";
import { cn } from "@/lib/utils";

type AdminTab =
  | "visao"
  | "fontes"
  | "produtos"
  | "categorias"
  | "importacao"
  | "planos"
  | "prontidao";

type ProductForm = {
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  price: string;
  commissionAmount: string;
  commissionPercent: string;
  storeName: string;
  originalUrl: string;
  salesCount: string;
  creatorsCount: string;
  source: string;
};

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel admin — RadarShop AI" },
      {
        name: "description",
        content: "Administração de produtos, categorias, fontes e importações.",
      },
    ],
  }),
  component: AdminPage,
});

function emptyProductForm(defaultSource = ""): ProductForm {
  return {
    name: "",
    description: "",
    imageUrl: "",
    categoryId: "",
    price: "",
    commissionAmount: "",
    commissionPercent: "",
    storeName: "",
    originalUrl: "",
    salesCount: "",
    creatorsCount: "",
    source: defaultSource,
  };
}

function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("visao");
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const enabled = isAdmin === true;
  const { data: overview, isLoading: overviewLoading } = useAdminOverview(enabled);
  const { data: users = [], isLoading: usersLoading } = useAdminUsers(enabled);
  const { data: products = [], isLoading: productsLoading } = useAdminProducts(enabled);
  const { data: categories = [], isLoading: categoriesLoading } = useAdminCategories(enabled);
  const { data: importDefaults } = useAdminImportDefaults(enabled);
  const {
    data: ingestionRuns = [],
    isLoading: ingestionRunsLoading,
    isError: ingestionRunsError,
  } = useAdminIngestionRuns(enabled);

  if (adminLoading) {
    return <AdminLoading />;
  }

  if (!isAdmin) {
    return (
      <div className="surface-card flex min-h-72 flex-col items-center justify-center p-8 text-center">
        <ShieldAlert className="h-7 w-7 text-muted-foreground" />
        <h1 className="mt-3 text-base font-semibold">Acesso administrativo necessário</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Esta área é protegida por role. Usuários comuns não podem administrar o catálogo.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dashboard">Voltar ao Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <ShieldCheck className="h-3.5 w-3.5" /> Administração
        </span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Painel administrativo</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Gerencie dados reais do RadarShop AI sem misturar credenciais privadas no navegador.
        </p>
      </section>

      <nav className="flex flex-wrap gap-2">
        <TabButton active={tab === "visao"} onClick={() => setTab("visao")}>
          Visão geral
        </TabButton>
        <TabButton active={tab === "fontes"} onClick={() => setTab("fontes")}>
          Fontes
        </TabButton>
        <TabButton active={tab === "produtos"} onClick={() => setTab("produtos")}>
          Produtos
        </TabButton>
        <TabButton active={tab === "categorias"} onClick={() => setTab("categorias")}>
          Categorias
        </TabButton>
        <TabButton active={tab === "importacao"} onClick={() => setTab("importacao")}>
          Importação CSV
        </TabButton>
        <TabButton active={tab === "planos"} onClick={() => setTab("planos")}>
          Planos
        </TabButton>
        <TabButton active={tab === "prontidao"} onClick={() => setTab("prontidao")}>
          Prontidão
        </TabButton>
      </nav>

      {tab === "visao" && (
        <OverviewTab
          overview={overview}
          overviewLoading={overviewLoading}
          users={users}
          usersLoading={usersLoading}
        />
      )}

      {tab === "fontes" && (
        <SourcesTab
          overview={overview}
          runs={ingestionRuns}
          loading={overviewLoading || ingestionRunsLoading}
          historyError={ingestionRunsError}
        />
      )}

      {tab === "produtos" && (
        <ProductsTab
          products={products}
          productsLoading={productsLoading}
          categories={categories}
          defaultSource={importDefaults?.defaultSource ?? ""}
        />
      )}

      {tab === "categorias" && (
        <CategoriesTab categories={categories} loading={categoriesLoading} />
      )}

      {tab === "importacao" && (
        <ImportTab categories={categories} defaultSource={importDefaults?.defaultSource ?? ""} />
      )}

      {tab === "planos" && <AdminPlanManagement enabled={enabled} />}

      {tab === "prontidao" && <AdminReadiness enabled={enabled} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-gold bg-gold-soft text-gold-foreground"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SourcesTab({
  overview,
  runs,
  loading,
  historyError,
}: {
  overview: ReturnType<typeof useAdminOverview>["data"];
  runs: AdminIngestionRun[];
  loading: boolean;
  historyError: boolean;
}) {
  const sourceNames = new Set<string>();

  for (const source of overview?.sources ?? []) sourceNames.add(source.source);
  for (const run of runs) sourceNames.add(run.source);

  const latestRunBySource = new Map<string, AdminIngestionRun>();
  for (const run of runs) {
    if (!latestRunBySource.has(run.source)) latestRunBySource.set(run.source, run);
  }

  const sources = Array.from(sourceNames)
    .map((source) => {
      const catalog = overview?.sources.find((item) => item.source === source);
      return {
        source,
        count: catalog?.count ?? 0,
        latestDataAt: catalog?.latestDataAt ?? null,
        latestRun: latestRunBySource.get(source) ?? null,
      };
    })
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  return (
    <div className="space-y-5">
      <section className="surface-card p-5 md:p-6">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <h2 className="text-base font-semibold">Saúde das fontes de dados</h2>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Acompanhe quando cada fonte atualizou o catálogo e o resultado das últimas ingestões.
          O histórico não interfere na importação caso a observabilidade esteja indisponível.
        </p>
      </section>

      {historyError && (
        <section className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium">Histórico de ingestão indisponível</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifique se a migration 0006 foi aplicada. O catálogo continua funcionando
            independentemente deste histórico.
          </p>
        </section>
      )}

      {loading ? (
        <div className="surface-card h-40 animate-pulse" />
      ) : sources.length ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((item) => (
            <article key={item.source} className="surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.source}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.count.toLocaleString("pt-BR")} produtos no catálogo
                  </p>
                </div>
                {item.latestRun && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase">
                    {ingestionStatusLabel(item.latestRun.status)}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <p>
                  Dados mais recentes:{" "}
                  {item.latestDataAt ? dateTimeBR(item.latestDataAt) : "sem dados"}
                </p>
                <p>
                  Última ingestão:{" "}
                  {item.latestRun ? dateTimeBR(item.latestRun.started_at) : "não registrada"}
                </p>
                {item.latestRun && (
                  <p>
                    Canal: {ingestionChannelLabel(item.latestRun.channel)} · recebidos{" "}
                    {item.latestRun.accepted_count} · inseridos {item.latestRun.inserted_count} ·
                    atualizados {item.latestRun.updated_count}
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="surface-card p-6 text-sm text-muted-foreground">
          Nenhuma fonte com produtos ou execuções registradas.
        </div>
      )}

      <section className="surface-card p-5">
        <h2 className="text-base font-semibold">Execuções recentes</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Últimas importações recebidas pela API de ingestão ou pelo CSV administrativo.
        </p>

        {runs.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Fonte</th>
                  <th className="pb-2 font-medium">Canal</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Recebidos</th>
                  <th className="pb-2 font-medium">Inseridos</th>
                  <th className="pb-2 font-medium">Atualizados</th>
                  <th className="pb-2 font-medium">Início</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.slice(0, 30).map((run) => (
                  <tr key={run.id}>
                    <td className="max-w-52 truncate py-2.5 font-medium">{run.source}</td>
                    <td className="py-2.5">{ingestionChannelLabel(run.channel)}</td>
                    <td className="py-2.5">{ingestionStatusLabel(run.status)}</td>
                    <td className="py-2.5">{run.accepted_count}</td>
                    <td className="py-2.5">{run.inserted_count}</td>
                    <td className="py-2.5">{run.updated_count}</td>
                    <td className="py-2.5">{dateTimeBR(run.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
        )}
      </section>
    </div>
  );
}

function ingestionStatusLabel(status: string) {
  if (status === "succeeded") return "sucesso";
  if (status === "failed") return "erro";
  return "em andamento";
}

function ingestionChannelLabel(channel: string) {
  return channel === "csv" ? "CSV" : "API";
}

function OverviewTab({
  overview,
  overviewLoading,
  users,
  usersLoading,
}: {
  overview: ReturnType<typeof useAdminOverview>["data"];
  overviewLoading: boolean;
  users: ReturnType<typeof useAdminUsers>["data"] extends infer T ? NonNullable<T> : never;
  usersLoading: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetric label="Usuários" value={overview?.usersCount} loading={overviewLoading} />
        <AdminMetric label="Produtos" value={overview?.productsCount} loading={overviewLoading} />
        <AdminMetric
          label="Categorias"
          value={overview?.categoriesCount}
          loading={overviewLoading}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="text-base font-semibold">Fontes registradas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Contagem baseada no campo de origem salvo em cada produto.
          </p>

          <div className="mt-4 space-y-2">
            {overviewLoading ? (
              <div className="h-20 animate-pulse rounded-md bg-muted" />
            ) : overview?.sources.length ? (
              overview.sources.map((item) => (
                <div
                  key={item.source}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="truncate">{item.source}</span>
                  <span className="text-xs text-muted-foreground">{item.count} produtos</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma fonte registrada.</p>
            )}
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4" />
            <h2 className="text-base font-semibold">Usuários e roles</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Roles são exibidas para auditoria. Novos cadastros continuam entrando apenas como user.
          </p>

          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {usersLoading ? (
              <div className="h-24 animate-pulse rounded-md bg-muted" />
            ) : users.length ? (
              users.map((user) => (
                <div key={user.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {user.fullName || "Usuário sem nome"}
                      </p>
                      <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                        {user.id}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full border border-border px-2 py-0.5 text-[10px]"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Cadastro em {dateTimeBR(user.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminMetric({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-muted" />
      ) : (
        <p className="mt-1 text-2xl font-bold">{(value ?? 0).toLocaleString("pt-BR")}</p>
      )}
    </div>
  );
}

function ProductsTab({
  products,
  productsLoading,
  categories,
  defaultSource,
}: {
  products: AdminProduct[];
  productsLoading: boolean;
  categories: AdminCategory[];
  defaultSource: string;
}) {
  const createProduct = useCreateAdminProduct();
  const updateProduct = useUpdateAdminProduct();
  const deleteProduct = useDeleteAdminProduct();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(() => emptyProductForm(defaultSource));

  useEffect(() => {
    if (!editingId && !form.source && defaultSource) {
      setForm((current) => ({ ...current, source: defaultSource }));
    }
  }, [defaultSource, editingId, form.source]);

  const saving = createProduct.isPending || updateProduct.isPending;
  const canSave = useMemo(
    () => form.name.trim().length > 0 && form.source.trim().length > 0 && !saving,
    [form.name, form.source, saving],
  );

  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyProductForm(defaultSource));
  }

  function startEdit(product: AdminProduct) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description ?? "",
      imageUrl: product.image_url ?? "",
      categoryId: product.category_id ?? "",
      price: product.price === null ? "" : String(product.price),
      commissionAmount: product.commission_amount === null ? "" : String(product.commission_amount),
      commissionPercent:
        product.commission_percent === null ? "" : String(product.commission_percent),
      storeName: product.store_name ?? "",
      originalUrl: product.original_url ?? "",
      salesCount: product.sales_count === null ? "" : String(product.sales_count),
      creatorsCount: product.creators_count === null ? "" : String(product.creators_count),
      source: product.source,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    const values = validateProductForm(form);

    if (!values) return;

    try {
      if (editingId) {
        await updateProduct.mutateAsync({ id: editingId, values });
        toast.success("Produto atualizado.");
      } else {
        await createProduct.mutateAsync(values);
        toast.success("Produto criado.");
      }

      startNew();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    }
  }

  async function handleDelete(product: AdminProduct) {
    if (!window.confirm('Excluir "' + product.name + '" do catálogo?')) return;

    try {
      await deleteProduct.mutateAsync(product.id);

      if (editingId === product.id) startNew();

      toast.success("Produto excluído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o produto.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <form onSubmit={handleSave} className="surface-card p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              {editingId ? "Editar produto" : "Cadastrar produto"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Campos vazios permanecem indisponíveis no Radar; nenhum dado é inventado.
            </p>
          </div>
          {editingId && (
            <Button type="button" variant="outline" size="sm" onClick={startNew}>
              Novo
            </Button>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nome" htmlFor="admin-product-name">
            <Input
              id="admin-product-name"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          </Field>

          <Field label="Categoria" htmlFor="admin-product-category">
            <select
              id="admin-product-category"
              value={form.categoryId}
              onChange={(event) => setField("categoryId", event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Preço (R$)" htmlFor="admin-product-price">
            <Input
              id="admin-product-price"
              inputMode="decimal"
              value={form.price}
              onChange={(event) => setField("price", event.target.value)}
            />
          </Field>

          <Field label="Comissão (R$)" htmlFor="admin-product-commission">
            <Input
              id="admin-product-commission"
              inputMode="decimal"
              value={form.commissionAmount}
              onChange={(event) => setField("commissionAmount", event.target.value)}
            />
          </Field>

          <Field label="Comissão (%)" htmlFor="admin-product-percent">
            <Input
              id="admin-product-percent"
              inputMode="decimal"
              value={form.commissionPercent}
              onChange={(event) => setField("commissionPercent", event.target.value)}
            />
          </Field>

          <Field label="Loja" htmlFor="admin-product-store">
            <Input
              id="admin-product-store"
              value={form.storeName}
              onChange={(event) => setField("storeName", event.target.value)}
            />
          </Field>

          <Field label="Vendas informadas" htmlFor="admin-product-sales">
            <Input
              id="admin-product-sales"
              inputMode="numeric"
              value={form.salesCount}
              onChange={(event) => setField("salesCount", event.target.value)}
            />
          </Field>

          <Field label="Criadores informados" htmlFor="admin-product-creators">
            <Input
              id="admin-product-creators"
              inputMode="numeric"
              value={form.creatorsCount}
              onChange={(event) => setField("creatorsCount", event.target.value)}
            />
          </Field>

          <Field label="Fonte" htmlFor="admin-product-source">
            <Input
              id="admin-product-source"
              value={form.source}
              onChange={(event) => setField("source", event.target.value)}
              placeholder="Ex.: export_tiktok_shop"
            />
          </Field>

          <Field label="URL original" htmlFor="admin-product-url">
            <Input
              id="admin-product-url"
              value={form.originalUrl}
              onChange={(event) => setField("originalUrl", event.target.value)}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="URL da imagem" htmlFor="admin-product-image">
              <Input
                id="admin-product-image"
                value={form.imageUrl}
                onChange={(event) => setField("imageUrl", event.target.value)}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Descrição" htmlFor="admin-product-description">
              <Textarea
                id="admin-product-description"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                className="min-h-28"
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {editingId && (
            <Button type="button" variant="outline" onClick={startNew}>
              Cancelar
            </Button>
          )}
          <Button type="submit" variant="gold" disabled={!canSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editingId ? "Salvar alterações" : "Cadastrar produto"}
          </Button>
        </div>
      </form>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Produtos recentes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Até 100 itens, ordenados pela última atualização.
          </p>
        </div>

        {productsLoading ? (
          <div className="surface-card h-40 animate-pulse" />
        ) : products.length ? (
          <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
            {products.map((product) => (
              <article key={product.id} className="surface-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{product.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.category?.name ?? "Sem categoria"} · {product.source}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Atualizado em {dateTimeBR(product.data_updated_at)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(product)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleteProduct.isPending}
                      onClick={() => void handleDelete(product)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="surface-card p-6 text-sm text-muted-foreground">
            Nenhum produto cadastrado.
          </div>
        )}
      </section>
    </div>
  );
}

function CategoriesTab({ categories, loading }: { categories: AdminCategory[]; loading: boolean }) {
  const createCategory = useCreateAdminCategory();
  const updateCategory = useUpdateAdminCategory();
  const deleteCategory = useDeleteAdminCategory();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const saving = createCategory.isPending || updateCategory.isPending;

  function reset() {
    setEditingId(null);
    setName("");
    setSlug("");
  }

  function startEdit(category: AdminCategory) {
    setEditingId(category.id);
    setName(category.name);
    setSlug(category.slug);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanSlug = slugify(slug || name);

    if (!cleanName || !cleanSlug) {
      toast.error("Informe nome e slug da categoria.");
      return;
    }

    try {
      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, name: cleanName, slug: cleanSlug });
        toast.success("Categoria atualizada.");
      } else {
        await createCategory.mutateAsync({ name: cleanName, slug: cleanSlug });
        toast.success("Categoria criada.");
      }

      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a categoria.");
    }
  }

  async function handleDelete(category: AdminCategory) {
    if (!window.confirm('Excluir a categoria "' + category.name + '"?')) return;

    try {
      await deleteCategory.mutateAsync(category.id);

      if (editingId === category.id) reset();

      toast.success("Categoria excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a categoria.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <form onSubmit={handleSubmit} className="surface-card p-5">
        <div className="flex items-center gap-2">
          <FolderCog className="h-4 w-4" />
          <h2 className="text-base font-semibold">
            {editingId ? "Editar categoria" : "Nova categoria"}
          </h2>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Nome" htmlFor="admin-category-name">
            <Input
              id="admin-category-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!editingId) setSlug(slugify(event.target.value));
              }}
            />
          </Field>

          <Field label="Slug" htmlFor="admin-category-slug">
            <Input
              id="admin-category-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="ex.: beleza"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {editingId && (
            <Button type="button" variant="outline" onClick={reset}>
              Cancelar
            </Button>
          )}
          <Button type="submit" variant="gold" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </form>

      <section className="surface-card p-5">
        <h2 className="text-base font-semibold">Categorias do catálogo</h2>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{category.name}</p>
                  <p className="text-xs text-muted-foreground">{category.slug}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(category)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleteCategory.isPending}
                    onClick={() => void handleDelete(category)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ImportTab({
  categories,
  defaultSource,
}: {
  categories: AdminCategory[];
  defaultSource: string;
}) {
  const saveDefaults = useSaveImportDefaults();
  const importProducts = useImportAdminProducts();

  const [source, setSource] = useState(defaultSource);
  const [rawCsv, setRawCsv] = useState("");

  useEffect(() => {
    setSource(defaultSource);
  }, [defaultSource]);

  const preview = useMemo(
    () => (rawCsv ? parseAdminProductCsv(rawCsv, categories, source) : null),
    [rawCsv, categories, source],
  );

  const invalidRows = preview?.rows.filter((row) => row.errors.length > 0) ?? [];
  const validRows = preview?.rows.filter((row) => row.values !== null) ?? [];
  const canImport =
    Boolean(preview) &&
    preview!.fatalErrors.length === 0 &&
    invalidRows.length === 0 &&
    validRows.length > 0 &&
    !importProducts.isPending;

  async function handleFile(file: File | undefined) {
    if (!file) {
      setRawCsv("");
      return;
    }

    try {
      setRawCsv(await file.text());
    } catch {
      toast.error("Não foi possível ler o arquivo CSV.");
    }
  }

  async function handleSaveSource() {
    try {
      await saveDefaults.mutateAsync(source);
      toast.success("Fonte padrão salva.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a configuração.",
      );
    }
  }

  async function handleImport() {
    if (!preview || !canImport) return;

    const rows = preview.rows
      .map((row) => row.values)
      .filter((value): value is NonNullable<typeof value> => value !== null);

    try {
      const imported = await importProducts.mutateAsync(rows);
      toast.success(imported + " produtos importados.");
      setRawCsv("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A importação falhou.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="surface-card p-5 md:p-6">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          <h2 className="text-base font-semibold">Importação administrativa por CSV</h2>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Use dados obtidos legitimamente. O sistema valida cada linha antes de gravar e não
          preenche métricas ausentes com números inventados.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <Field label="Fonte padrão" htmlFor="admin-default-source">
            <Input
              id="admin-default-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Ex.: export_tiktok_shop"
            />
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              disabled={saveDefaults.isPending}
              onClick={() => void handleSaveSource()}
            >
              {saveDefaults.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar fonte
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <Label htmlFor="admin-csv-file">Arquivo CSV</Label>
          <Input
            id="admin-csv-file"
            type="file"
            accept=".csv,text/csv"
            className="mt-1.5"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Colunas aceitas: name/nome, category_slug/categoria, price/preco,
            commission_amount/comissao, commission_percent/comissao_percentual, store_name/loja,
            original_url/url, sales_count/vendas, creators_count/criadores, source/fonte,
            collected_at/data_coleta, image_url/imagem e description/descricao.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-secondary/30 p-4">
        <p className="text-sm font-medium">Integrações futuras</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          APIs oficiais ou provedores comerciais poderão substituir o CSV. Segredos e chaves
          privadas deverão permanecer no servidor; esta tela não solicita nem armazena credenciais
          sensíveis.
        </p>
      </section>

      {preview && (
        <section className="surface-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Validação do arquivo</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Delimitador detectado: {preview.delimiter === ";" ? "ponto e vírgula" : "vírgula"} ·{" "}
                {validRows.length} válidas · {invalidRows.length} com erro
              </p>
            </div>
            <Button
              type="button"
              variant="gold"
              disabled={!canImport}
              onClick={() => void handleImport()}
            >
              {importProducts.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackagePlus className="h-4 w-4" />
              )}
              Importar produtos
            </Button>
          </div>

          {preview.fatalErrors.length > 0 && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              {preview.fatalErrors.map((error) => (
                <p key={error} className="text-xs text-destructive">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Linha</th>
                  <th className="pb-2 font-medium">Produto</th>
                  <th className="pb-2 font-medium">Fonte</th>
                  <th className="pb-2 font-medium">Validação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.rows.slice(0, 30).map((row) => (
                  <tr key={row.line}>
                    <td className="py-2.5">{row.line}</td>
                    <td className="max-w-64 truncate py-2.5">{row.name || "—"}</td>
                    <td className="max-w-48 truncate py-2.5">{row.source || "—"}</td>
                    <td className="py-2.5">
                      {row.errors.length ? (
                        <span className="text-destructive">{row.errors.join(" ")}</span>
                      ) : (
                        <span className="text-muted-foreground">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.rows.length > 30 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Mostrando as primeiras 30 de {preview.rows.length} linhas.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function validateProductForm(form: ProductForm): AdminProductValues | null {
  const name = form.name.trim();
  const source = form.source.trim();

  if (!name) {
    toast.error("Informe o nome do produto.");
    return null;
  }

  if (!source) {
    toast.error("Informe a fonte dos dados.");
    return null;
  }

  const price = parseOptionalNumber(form.price, "Preço");
  if (price === undefined) return null;

  const commissionAmount = parseOptionalNumber(form.commissionAmount, "Comissão");
  if (commissionAmount === undefined) return null;

  const commissionPercent = parseOptionalNumber(form.commissionPercent, "Comissão percentual", 100);
  if (commissionPercent === undefined) return null;

  const salesCount = parseOptionalInteger(form.salesCount, "Vendas");
  if (salesCount === undefined) return null;

  const creatorsCount = parseOptionalInteger(form.creatorsCount, "Criadores");
  if (creatorsCount === undefined) return null;

  const originalUrl = nullableText(form.originalUrl);
  const imageUrl = nullableText(form.imageUrl);

  if (originalUrl && !isHttpUrl(originalUrl)) {
    toast.error("A URL original precisa começar com http:// ou https://.");
    return null;
  }

  if (imageUrl && !isHttpUrl(imageUrl)) {
    toast.error("A URL da imagem precisa começar com http:// ou https://.");
    return null;
  }

  return {
    name,
    description: nullableText(form.description),
    image_url: imageUrl,
    category_id: form.categoryId || null,
    price,
    commission_amount: commissionAmount,
    commission_percent: commissionPercent,
    store_name: nullableText(form.storeName),
    original_url: originalUrl,
    sales_count: salesCount,
    creators_count: creatorsCount,
    source,
  };
}

function parseOptionalNumber(value: string, label: string, max?: number) {
  if (!value.trim()) return null;

  const parsed = Number(value.trim().replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0) {
    toast.error(label + " inválido.");
    return undefined;
  }

  if (max !== undefined && parsed > max) {
    toast.error(label + " deve ser no máximo " + max + ".");
    return undefined;
  }

  return parsed;
}

function parseOptionalInteger(value: string, label: string) {
  const parsed = parseOptionalNumber(value, label);

  if (parsed === undefined || parsed === null) return parsed;

  if (!Number.isInteger(parsed)) {
    toast.error(label + " precisa ser inteiro.");
    return undefined;
  }

  return parsed;
}

function nullableText(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dateTimeBR(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminLoading() {
  return (
    <div className="surface-card flex min-h-72 items-center justify-center">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando acesso administrativo
      </span>
    </div>
  );
}
