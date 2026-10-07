import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Json, Tables, TablesUpdate } from "@/integrations/supabase/types";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type AdminCategory = Tables<"categories">;
export type AdminIngestionRun = Tables<"ingestion_runs">;

type ProductCategory = {
  name: string;
  slug: string;
};

type ProductQueryRow = Tables<"products"> & {
  categories: ProductCategory | ProductCategory[] | null;
};

export type AdminProduct = Tables<"products"> & {
  category: ProductCategory | null;
};

export type AdminUser = {
  id: string;
  fullName: string | null;
  createdAt: string;
  roles: string[];
};

export type AdminOverview = {
  usersCount: number;
  productsCount: number;
  categoriesCount: number;
  sources: Array<{ source: string; count: number; latestDataAt: string | null }>;
};

export type AdminProductValues = {
  name: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  price: number | null;
  commission_amount: number | null;
  commission_percent: number | null;
  store_name: string | null;
  original_url: string | null;
  sales_count: number | null;
  creators_count: number | null;
  source: string;
};

export type AdminImportProduct = AdminProductValues & {
  collected_at: string;
};

export type ImportDefaults = {
  defaultSource: string;
};

async function requireAdmin() {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!userData.user) throw new Error("Sua sessão expirou. Entre novamente.");

  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) throw roleError;
  if (!role) throw new Error("Acesso administrativo necessário.");

  return userData.user.id;
}

function normalizeCategory(value: ProductCategory | ProductCategory[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function invalidateAdminQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-ingestion-runs"] }),
    queryClient.invalidateQueries({ queryKey: ["categories"] }),
    queryClient.invalidateQueries({ queryKey: ["product-radar"] }),
    queryClient.invalidateQueries({ queryKey: ["personal-radar"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
  ]);
}

export function useAdminOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-overview"],
    enabled,
    queryFn: async (): Promise<AdminOverview> => {
      await requireAdmin();

      const [users, products, categories, sourceRows] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("products").select("source,data_updated_at"),
      ]);

      const errors = [users.error, products.error, categories.error, sourceRows.error].filter(
        Boolean,
      );
      if (errors.length) throw errors[0];

      const sourceCounts = new Map<string, { count: number; latestDataAt: string | null }>();

      for (const row of sourceRows.data ?? []) {
        const source = row.source?.trim() || "não informada";
        const current = sourceCounts.get(source) ?? { count: 0, latestDataAt: null };
        const latestDataAt =
          !current.latestDataAt || row.data_updated_at > current.latestDataAt
            ? row.data_updated_at
            : current.latestDataAt;

        sourceCounts.set(source, {
          count: current.count + 1,
          latestDataAt,
        });
      }

      const sources = Array.from(sourceCounts.entries())
        .map(([source, values]) => ({ source, ...values }))
        .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

      return {
        usersCount: users.count ?? 0,
        productsCount: products.count ?? 0,
        categoriesCount: categories.count ?? 0,
        sources,
      };
    },
    staleTime: 30_000,
  });
}

export function useAdminIngestionRuns(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-ingestion-runs"],
    enabled,
    queryFn: async (): Promise<AdminIngestionRun[]> => {
      await requireAdmin();

      const { data, error } = await supabase
        .from("ingestion_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 20_000,
  });
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-users"],
    enabled,
    queryFn: async (): Promise<AdminUser[]> => {
      await requireAdmin();

      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id,full_name,created_at").order("created_at", {
          ascending: false,
        }),
        supabase.from("user_roles").select("user_id,role"),
      ]);

      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;

      const rolesByUser = new Map<string, string[]>();

      for (const role of roles.data ?? []) {
        const current = rolesByUser.get(role.user_id) ?? [];
        current.push(role.role);
        rolesByUser.set(role.user_id, current);
      }

      return (profiles.data ?? []).map((profile) => ({
        id: profile.id,
        fullName: profile.full_name,
        createdAt: profile.created_at,
        roles: rolesByUser.get(profile.id) ?? [],
      }));
    },
    staleTime: 30_000,
  });
}

export function useAdminProducts(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-products"],
    enabled,
    queryFn: async (): Promise<AdminProduct[]> => {
      await requireAdmin();

      const { data, error } = await supabase
        .from("products")
        .select(
          "id,name,description,image_url,category_id,price,commission_amount,commission_percent,store_name,original_url,sales_count,creators_count,source,is_demo,identified_at,data_updated_at,created_at,created_by,categories(name,slug)",
        )
        .order("data_updated_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      return ((data ?? []) as ProductQueryRow[]).map(({ categories, ...product }) => ({
        ...product,
        category: normalizeCategory(categories),
      }));
    },
    staleTime: 20_000,
  });
}

export function useAdminCategories(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-categories"],
    enabled,
    queryFn: async (): Promise<AdminCategory[]> => {
      await requireAdmin();

      const { data, error } = await supabase.from("categories").select("*").order("name");

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useAdminImportDefaults(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-settings", "import-defaults"],
    enabled,
    queryFn: async (): Promise<ImportDefaults> => {
      await requireAdmin();

      const { data, error } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "import_defaults")
        .maybeSingle();

      if (error) throw error;

      const value = data?.value;
      const defaultSource =
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof value["default_source"] === "string"
          ? value["default_source"]
          : "";

      return { defaultSource };
    },
  });
}

export function useSaveImportDefaults() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (defaultSource: string) => {
      await requireAdmin();

      const value: Json = { default_source: defaultSource.trim() };

      const { error } = await supabase
        .from("admin_settings")
        .upsert({ key: "import_defaults", value }, { onConflict: "key" });

      if (error) throw error;
    },
    onSuccess: () => invalidateAdminQueries(queryClient),
  });
}

export function useCreateAdminProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: AdminProductValues) => {
      const userId = await requireAdmin();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("products")
        .insert({
          ...values,
          created_by: userId,
          identified_at: now,
          data_updated_at: now,
          is_demo: false,
        })
        .select("id,price,commission_amount,sales_count,creators_count,source,data_updated_at")
        .single();

      if (error) throw error;

      const { error: historyError } = await supabase.from("product_metrics_history").insert({
        product_id: data.id,
        price: data.price,
        commission_amount: data.commission_amount,
        sales_count: data.sales_count,
        creators_count: data.creators_count,
        source: data.source,
        recorded_at: data.data_updated_at,
      });

      if (historyError) {
        await supabase.from("products").delete().eq("id", data.id);
        throw historyError;
      }
    },
    onSuccess: () => invalidateAdminQueries(queryClient),
  });
}

export function useUpdateAdminProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: AdminProductValues }) => {
      await requireAdmin();

      const { error } = await supabase
        .from("products")
        .update({ ...values, data_updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => invalidateAdminQueries(queryClient),
  });
}

export function useDeleteAdminProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await requireAdmin();

      const { error } = await supabase.from("products").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => invalidateAdminQueries(queryClient),
  });
}

export function useCreateAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, slug }: { name: string; slug: string }) => {
      await requireAdmin();

      const { error } = await supabase.from("categories").insert({ name, slug });

      if (error) throw error;
    },
    onSuccess: () => invalidateAdminQueries(queryClient),
  });
}

export function useUpdateAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, slug }: { id: string; name: string; slug: string }) => {
      await requireAdmin();

      const { error } = await supabase.from("categories").update({ name, slug }).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => invalidateAdminQueries(queryClient),
  });
}

export function useDeleteAdminCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await requireAdmin();

      const { error } = await supabase.from("categories").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => invalidateAdminQueries(queryClient),
  });
}

export function useImportAdminProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: AdminImportProduct[]) => {
      const userId = await requireAdmin();
      const rowsBySource = new Map<string, AdminImportProduct[]>();

      for (const row of rows) {
        const source = row.source.trim() || "admin_csv";
        const current = rowsBySource.get(source) ?? [];
        current.push(row);
        rowsBySource.set(source, current);
      }

      let imported = 0;

      for (const [source, sourceRows] of rowsBySource) {
        const collectedAt =
          sourceRows
            .map((row) => row.collected_at)
            .sort()
            .at(-1) ?? new Date().toISOString();
        const runId = await startAdminIngestionRun({
          source,
          acceptedCount: sourceRows.length,
          collectedAt,
          userId,
        });
        let sourceImported = 0;

        try {
          for (let index = 0; index < sourceRows.length; index += 100) {
            const batch = sourceRows.slice(index, index + 100);
            const inserts = batch.map(({ collected_at, ...row }) => ({
              ...row,
              created_by: userId,
              identified_at: collected_at,
              data_updated_at: collected_at,
              is_demo: false,
            }));

            const { data, error } = await supabase
              .from("products")
              .insert(inserts)
              .select(
                "id,price,commission_amount,sales_count,creators_count,source,data_updated_at",
              );

            if (error) throw error;

            const inserted = data ?? [];
            const historyRows = inserted.map((product) => ({
              product_id: product.id,
              price: product.price,
              commission_amount: product.commission_amount,
              sales_count: product.sales_count,
              creators_count: product.creators_count,
              source: product.source,
              recorded_at: product.data_updated_at,
            }));

            if (historyRows.length) {
              const { error: historyError } = await supabase
                .from("product_metrics_history")
                .insert(historyRows);

              if (historyError) {
                const ids = inserted.map((product) => product.id);
                await supabase.from("products").delete().in("id", ids);
                throw historyError;
              }
            }

            sourceImported += inserted.length;
            imported += inserted.length;
          }

          await finishAdminIngestionRun(runId, {
            status: "succeeded",
            inserted_count: sourceImported,
            snapshot_count: sourceImported,
          });
        } catch (error) {
          await finishAdminIngestionRun(runId, {
            status: "failed",
            error_code: "CSV_IMPORT_FAILED",
            error_message: "A importação CSV falhou antes de concluir todos os itens.",
          });
          throw error;
        }
      }

      return imported;
    },
    onSuccess: () => invalidateAdminQueries(queryClient),
  });
}

async function startAdminIngestionRun({
  source,
  acceptedCount,
  collectedAt,
  userId,
}: {
  source: string;
  acceptedCount: number;
  collectedAt: string;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("ingestion_runs")
    .insert({
      source,
      channel: "csv",
      accepted_count: acceptedCount,
      collected_at: collectedAt,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[RadarShop AI] histórico de importação indisponível", error.message);
    return null;
  }

  return data.id;
}

async function finishAdminIngestionRun(id: string | null, values: TablesUpdate<"ingestion_runs">) {
  if (!id) return;

  const { error } = await supabase
    .from("ingestion_runs")
    .update({
      ...values,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.warn("[RadarShop AI] histórico de importação não pôde ser atualizado", error.message);
  }
}

export type FastmossSyncResult = {
  ok: true;
  provider: "fastmoss";
  region: string;
  source: string;
  received: number;
  accepted: number;
  inserted: number;
  updated: number;
  metric_snapshots: number;
};

export function useSyncFastmossTop100() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<FastmossSyncResult> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

      const response = await fetch("/api/integrations/products", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "fastmoss", region: "BR", pageSize: 100, sort: "day7_gmv" }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (FastmossSyncResult & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Não foi possível sincronizar com a FastMoss agora.");
      }
      return payload;
    },
    onSuccess: () => invalidateAdminQueries(queryClient),
  });
}
