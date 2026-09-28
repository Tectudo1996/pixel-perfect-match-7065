import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Clapperboard,
  FilePenLine,
  Loader2,
  PackageOpen,
  Plus,
  Save,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useContentProjects,
  useCreateContentProject,
  useDeleteContentProject,
  useGenerateStudioContent,
  useStudioProducts,
  useUpdateContentProject,
  type ContentProject,
  type ContentProjectValues,
} from "@/hooks/useContentStudio";
import { usePlanUsage } from "@/hooks/usePlanUsage";

type StudioSearch = {
  produto?: string;
};

type StudioForm = {
  productId: string;
  title: string;
  targetAudience: string;
  videoType: string;
  durationSeconds: string;
  tone: string;
  script: string;
  caption: string;
  hashtags: string;
  aiPrompt: string;
  status: "rascunho" | "pronto";
};

export const Route = createFileRoute("/_authenticated/estudio")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    produto: typeof search["produto"] === "string" ? search["produto"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Estúdio de Conteúdo — RadarShop AI" },
      {
        name: "description",
        content: "Crie, salve e organize projetos de conteúdo para os produtos do seu Radar.",
      },
    ],
  }),
  component: ContentStudioPage,
});

function emptyForm(productId = ""): StudioForm {
  return {
    productId,
    title: "",
    targetAudience: "",
    videoType: "",
    durationSeconds: "",
    tone: "",
    script: "",
    caption: "",
    hashtags: "",
    aiPrompt: "",
    status: "rascunho",
  };
}

function ContentStudioPage() {
  const { produto } = Route.useSearch();
  const {
    data: products = [],
    isLoading: productsLoading,
    isError: productsError,
  } = useStudioProducts();
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsQueryError,
  } = useContentProjects();
  const createProject = useCreateContentProject();
  const updateProject = useUpdateContentProject();
  const deleteProject = useDeleteContentProject();
  const generateContent = useGenerateStudioContent();
  const { data: planUsage } = usePlanUsage();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudioForm>(() => emptyForm());
  const [aiStrategyNotes, setAiStrategyNotes] = useState("");
  const [appliedSearchProduct, setAppliedSearchProduct] = useState<string | null>(null);

  useEffect(() => {
    if (!produto || productsLoading || editingId || appliedSearchProduct === produto) {
      return;
    }

    if (products.some((product) => product.id === produto)) {
      setForm((current) => ({
        ...current,
        productId: current.productId || produto,
      }));
    }

    setAppliedSearchProduct(produto);
  }, [produto, products, productsLoading, editingId, appliedSearchProduct]);

  const saving = createProject.isPending || updateProject.isPending;
  const aiLimitReached = Boolean(planUsage?.enforcementEnabled && planUsage.remaining <= 0);
  const canSave = useMemo(
    () => form.productId.length > 0 && form.title.trim().length > 0 && !saving,
    [form.productId, form.title, saving],
  );

  function setField<K extends keyof StudioForm>(key: K, value: StudioForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    const preselectedProduct =
      produto && products.some((product) => product.id === produto) ? produto : "";

    setEditingId(null);
    setAiStrategyNotes("");
    setForm(emptyForm(preselectedProduct));
  }

  function startEdit(project: ContentProject) {
    setEditingId(project.id);
    setAiStrategyNotes("");
    setForm({
      productId: project.product_id ?? "",
      title: project.title,
      targetAudience: project.target_audience ?? "",
      videoType: project.video_type ?? "",
      durationSeconds: project.duration_seconds === null ? "" : String(project.duration_seconds),
      tone: project.tone ?? "",
      script: project.script ?? "",
      caption: project.caption ?? "",
      hashtags: project.hashtags ?? "",
      aiPrompt: project.ai_prompt ?? "",
      status: project.status === "pronto" ? "pronto" : "rascunho",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleGenerateContent() {
    if (!form.productId) {
      toast.error("Selecione um produto antes de gerar com IA.");
      return;
    }

    const duration = form.durationSeconds.trim() ? Number(form.durationSeconds) : null;

    if (duration !== null && (!Number.isInteger(duration) || duration <= 0 || duration > 180)) {
      toast.error("A duração precisa ser um número inteiro entre 1 e 180 segundos.");
      return;
    }

    const hasExistingContent = Boolean(
      form.script.trim() || form.caption.trim() || form.hashtags.trim() || form.aiPrompt.trim(),
    );

    if (
      hasExistingContent &&
      !window.confirm(
        "A nova geração substituirá roteiro, legenda, hashtags e prompt audiovisual atuais. Continuar?",
      )
    ) {
      return;
    }

    try {
      const response = await generateContent.mutateAsync({
        productId: form.productId,
        targetAudience: nullableText(form.targetAudience),
        videoType: nullableText(form.videoType),
        durationSeconds: duration,
        tone: nullableText(form.tone),
      });
      const generated = response.content;

      setForm((current) => ({
        ...current,
        title: current.title.trim() || generated.title,
        targetAudience: current.targetAudience.trim() || generated.target_audience,
        videoType: current.videoType.trim() || generated.video_type,
        durationSeconds: current.durationSeconds.trim()
          ? current.durationSeconds
          : String(generated.duration_seconds),
        tone: current.tone.trim() || generated.tone,
        script: generated.script,
        caption: generated.caption,
        hashtags: generated.hashtags,
        aiPrompt: generated.ai_prompt,
      }));
      setAiStrategyNotes(generated.strategy_notes);
      toast.success("Conteúdo gerado. Revise antes de salvar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o conteúdo.");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const duration = form.durationSeconds.trim() ? Number(form.durationSeconds) : null;

    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
      toast.error("A duração precisa ser um número inteiro maior que zero.");
      return;
    }

    if (!form.productId) {
      toast.error("Selecione um produto para o projeto.");
      return;
    }

    if (!form.title.trim()) {
      toast.error("Informe um título para o projeto.");
      return;
    }

    const values: ContentProjectValues = {
      product_id: form.productId,
      title: form.title.trim(),
      target_audience: nullableText(form.targetAudience),
      video_type: nullableText(form.videoType),
      duration_seconds: duration,
      tone: nullableText(form.tone),
      script: nullableText(form.script),
      caption: nullableText(form.caption),
      hashtags: nullableText(form.hashtags),
      ai_prompt: nullableText(form.aiPrompt),
      status: form.status,
    };

    try {
      if (editingId) {
        await updateProject.mutateAsync({ id: editingId, values });
        toast.success("Projeto atualizado.");
      } else {
        await createProject.mutateAsync(values);
        toast.success("Projeto criado.");
      }

      startNew();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o projeto.");
    }
  }

  async function handleDelete(project: ContentProject) {
    const confirmed = window.confirm(
      'Excluir o projeto "' + project.title + '"? Esta ação não pode ser desfeita.',
    );

    if (!confirmed) return;

    try {
      await deleteProject.mutateAsync(project.id);

      if (editingId === project.id) {
        startNew();
      }

      toast.success("Projeto excluído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o projeto.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <Clapperboard className="h-3.5 w-3.5" /> Estúdio + IA
          </span>
          <h1 className="mt-3 text-2xl font-bold md:text-3xl">Estúdio de Conteúdo</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Transforme um produto do Radar em um projeto organizado com público, formato, roteiro,
            legenda, hashtags e prompt audiovisual.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={startNew}>
          <Plus className="h-4 w-4" />
          Novo projeto
        </Button>
      </section>

      <section className="rounded-lg border border-gold/30 bg-gold-soft/50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" /> IA personalizada pelo contexto real
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          A geração usa o produto selecionado, suas preferências, projetos anteriores, histórico do
          produto e itens da mesma categoria. A chave do provedor fica somente no servidor. O
          resultado sempre volta para revisão antes de você salvar.
        </p>
        {planUsage && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gold/20 pt-3 text-xs">
            <span className="text-muted-foreground">
              Plano {planUsage.plan === "pro" ? "Pro" : "Grátis"} · {planUsage.used}/
              {planUsage.limit} gerações no período
            </span>
            <Link to="/plano" className="font-medium hover:underline">
              Ver plano e uso
            </Link>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="surface-card p-5 md:p-6">
            <div className="flex items-center gap-2">
              <FilePenLine className="h-4 w-4" />
              <h2 className="text-base font-semibold">
                {editingId ? "Editar projeto" : "Novo projeto"}
              </h2>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Produto" htmlFor="studio-product">
                <select
                  id="studio-product"
                  value={form.productId}
                  disabled={productsLoading || productsError}
                  onChange={(event) => setField("productId", event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">
                    {productsLoading ? "Carregando produtos..." : "Selecione um produto"}
                  </option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                      {product.store_name ? " — " + product.store_name : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status" htmlFor="studio-status">
                <select
                  id="studio-status"
                  value={form.status}
                  onChange={(event) =>
                    setField("status", event.target.value === "pronto" ? "pronto" : "rascunho")
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="pronto">Pronto</option>
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Título do projeto" htmlFor="studio-title">
                  <Input
                    id="studio-title"
                    value={form.title}
                    onChange={(event) => setField("title", event.target.value)}
                    placeholder="Ex.: Vídeo de teste — produto principal"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="surface-card p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Direção do conteúdo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Defina o que quiser manualmente; campos vazios podem ser completados pela IA.
                </p>
              </div>
              <Button
                type="button"
                variant="gold"
                disabled={!form.productId || generateContent.isPending || aiLimitReached}
                onClick={() => void handleGenerateContent()}
              >
                {generateContent.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <WandSparkles className="h-4 w-4" />
                )}
                {aiLimitReached ? "Limite atingido" : "Gerar com IA"}
              </Button>
            </div>

            {aiStrategyNotes && (
              <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3">
                <p className="text-xs font-semibold">Estratégia sugerida pela IA</p>
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                  {aiStrategyNotes}
                </p>
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Público-alvo" htmlFor="studio-audience">
                <Input
                  id="studio-audience"
                  value={form.targetAudience}
                  onChange={(event) => setField("targetAudience", event.target.value)}
                  placeholder="Ex.: mulheres de 20 a 35 anos"
                />
              </Field>

              <Field label="Tipo de vídeo" htmlFor="studio-video-type">
                <Input
                  id="studio-video-type"
                  value={form.videoType}
                  onChange={(event) => setField("videoType", event.target.value)}
                  placeholder="Ex.: demonstração, POV, review"
                />
              </Field>

              <Field label="Duração em segundos" htmlFor="studio-duration">
                <Input
                  id="studio-duration"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={form.durationSeconds}
                  onChange={(event) => setField("durationSeconds", event.target.value)}
                  placeholder="Ex.: 15"
                />
              </Field>

              <Field label="Tom / estilo" htmlFor="studio-tone">
                <Input
                  id="studio-tone"
                  value={form.tone}
                  onChange={(event) => setField("tone", event.target.value)}
                  placeholder="Ex.: direto, natural, curioso"
                />
              </Field>
            </div>
          </section>

          <section className="surface-card p-5 md:p-6">
            <h2 className="text-base font-semibold">Peças do projeto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Salve o material completo e volte para editar quando quiser.
            </p>

            <div className="mt-4 space-y-4">
              <Field label="Roteiro" htmlFor="studio-script">
                <Textarea
                  id="studio-script"
                  value={form.script}
                  onChange={(event) => setField("script", event.target.value)}
                  placeholder="Estrutura, falas, cenas e chamadas para ação."
                  className="min-h-40"
                />
              </Field>

              <Field label="Legenda" htmlFor="studio-caption">
                <Textarea
                  id="studio-caption"
                  value={form.caption}
                  onChange={(event) => setField("caption", event.target.value)}
                  placeholder="Legenda preparada para a publicação."
                  className="min-h-24"
                />
              </Field>

              <Field label="Hashtags" htmlFor="studio-hashtags">
                <Textarea
                  id="studio-hashtags"
                  value={form.hashtags}
                  onChange={(event) => setField("hashtags", event.target.value)}
                  placeholder="#achadinhos #tiktokshop"
                  className="min-h-20"
                />
              </Field>

              <Field label="Prompt audiovisual" htmlFor="studio-prompt">
                <Textarea
                  id="studio-prompt"
                  value={form.aiPrompt}
                  onChange={(event) => setField("aiPrompt", event.target.value)}
                  placeholder="Prompt para imagem, vídeo, movimento ou ferramenta de IA."
                  className="min-h-32"
                />
              </Field>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2 pb-4">
            {editingId && (
              <Button type="button" variant="outline" onClick={startNew}>
                Cancelar edição
              </Button>
            )}
            <Button type="submit" variant="gold" disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? "Salvar alterações" : "Criar projeto"}
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          <section>
            <h2 className="text-base font-semibold">Meus projetos</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {projectsLoading
                ? "Carregando projetos..."
                : projects.length === 1
                  ? "1 projeto salvo"
                  : projects.length + " projetos salvos"}
            </p>
          </section>

          {productsError && (
            <div className="surface-card p-4 text-sm text-muted-foreground">
              Não foi possível carregar o catálogo. O formulário ficará disponível novamente quando
              a conexão com os produtos for restabelecida.
            </div>
          )}

          {projectsError ? (
            <div className="surface-card p-5">
              <p className="text-sm font-semibold">Não foi possível carregar os projetos</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {projectsQueryError instanceof Error
                  ? projectsQueryError.message
                  : "Tente novamente em alguns instantes."}
              </p>
            </div>
          ) : projectsLoading ? (
            <ProjectListSkeleton />
          ) : projects.length ? (
            <div className="space-y-3">
              {projects.map((project) => (
                <article key={project.id} className="surface-card overflow-hidden">
                  <div className="flex gap-3 p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {project.product?.image_url ? (
                        <img
                          src={project.product.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PackageOpen className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold">{project.title}</h3>
                        <span
                          className={
                            project.status === "pronto"
                              ? "gold-chip rounded-full px-2 py-0.5 text-[11px] font-medium"
                              : "rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                          }
                        >
                          {project.status === "pronto" ? "Pronto" : "Rascunho"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {project.product?.name ?? "Produto não disponível"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Atualizado em {dateTimeBR(project.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(project)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleteProject.isPending}
                      onClick={() => void handleDelete(project)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="surface-card flex flex-col items-center p-7 text-center">
              <Clapperboard className="h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">Nenhum projeto criado ainda</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Escolha um produto e salve o primeiro roteiro no Estúdio.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/radar">Escolher produto no Radar</Link>
              </Button>
            </div>
          )}
        </aside>
      </div>
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

function nullableText(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function dateTimeBR(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function ProjectListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="surface-card p-4">
          <div className="flex gap-3">
            <div className="h-14 w-14 animate-pulse rounded-md bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
