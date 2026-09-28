import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { aiContentResponseSchema, type AiContentRequest } from "@/lib/ai-content-schema";
import { cloudClient as supabase } from "@/lib/cloud-client";

export type StudioProduct = Pick<Tables<"products">, "id" | "name" | "image_url" | "store_name">;

export type ContentProject = Tables<"content_projects"> & {
  product: StudioProduct | null;
};

export type ContentProjectValues = {
  product_id: string | null;
  title: string;
  target_audience: string | null;
  video_type: string | null;
  duration_seconds: number | null;
  tone: string | null;
  script: string | null;
  caption: string | null;
  hashtags: string | null;
  ai_prompt: string | null;
  status: string;
};

type ProjectQueryRow = Tables<"content_projects"> & {
  products: StudioProduct | StudioProduct[] | null;
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Sua sessão expirou. Entre novamente.");

  return data.user.id;
}

function normalizeProduct(value: StudioProduct | StudioProduct[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function invalidateStudioQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["content-projects"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
  ]);
}

export function useStudioProducts() {
  return useQuery({
    queryKey: ["studio-products"],
    queryFn: async (): Promise<StudioProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,image_url,store_name")
        .order("data_updated_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useContentProjects() {
  return useQuery({
    queryKey: ["content-projects"],
    queryFn: async (): Promise<ContentProject[]> => {
      const userId = await requireUserId();

      const { data, error } = await supabase
        .from("content_projects")
        .select(
          "id,user_id,product_id,title,target_audience,video_type,duration_seconds,tone,script,caption,hashtags,ai_prompt,status,created_at,updated_at,products(id,name,image_url,store_name)",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      return ((data ?? []) as ProjectQueryRow[]).map(({ products, ...project }) => ({
        ...project,
        product: normalizeProduct(products),
      }));
    },
    staleTime: 20_000,
  });
}

export function useCreateContentProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: ContentProjectValues) => {
      const userId = await requireUserId();

      const { error } = await supabase.from("content_projects").insert({
        ...values,
        user_id: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => invalidateStudioQueries(queryClient),
  });
}

export function useUpdateContentProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ContentProjectValues }) => {
      const userId = await requireUserId();

      const { error } = await supabase
        .from("content_projects")
        .update(values)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => invalidateStudioQueries(queryClient),
  });
}

export function useDeleteContentProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const userId = await requireUserId();

      const { error } = await supabase
        .from("content_projects")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => invalidateStudioQueries(queryClient),
  });
}


export function useGenerateStudioContent() {
  return useMutation({
    mutationFn: async (input: AiContentRequest) => {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      const response = await fetch("/api/ai-content", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && typeof payload.error === "string"
            ? payload.error
            : "Não foi possível gerar o conteúdo agora.";
        throw new Error(message);
      }

      return aiContentResponseSchema.parse(payload);
    },
  });
}
