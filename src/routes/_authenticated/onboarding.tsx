import { useMemo, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Radar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { modo: "entrar" } });

    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("onboarding_completed")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (preferences?.onboarding_completed) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Primeiros passos — RadarShop AI" },
      {
        name: "description",
        content: "Configure suas preferências para personalizar o RadarShop AI.",
      },
    ],
  }),
  component: OnboardingPage,
});

const niveis = [
  { value: "iniciante", label: "Iniciante", description: "Ainda estou começando no TikTok Shop." },
  {
    value: "intermediario",
    label: "Intermediário",
    description: "Já publico e quero melhorar meus resultados.",
  },
  { value: "avancado", label: "Avançado", description: "Já tenho rotina e experiência com vendas." },
];

const objetivos = [
  { value: "primeira_venda", label: "Fazer minha primeira venda" },
  { value: "aumentar_vendas", label: "Aumentar minhas vendas" },
  { value: "novos_produtos", label: "Encontrar produtos novos" },
  { value: "maior_comissao", label: "Encontrar comissões melhores" },
];

const estilos = [
  { value: "aparecer", label: "Aparecendo nos vídeos" },
  { value: "sem_aparecer", label: "Sem aparecer" },
  { value: "ia", label: "Conteúdo com IA" },
  { value: "ainda_nao_sei", label: "Ainda não defini" },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const [experienceLevel, setExperienceLevel] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [videoStyle, setVideoStyle] = useState("");
  const [commissionMin, setCommissionMin] = useState("");
  const [commissionMax, setCommissionMax] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(
    () =>
      experienceLevel.length > 0 &&
      selectedCategories.length > 0 &&
      goal.length > 0 &&
      videoStyle.length > 0 &&
      !saving,
    [experienceLevel, selectedCategories, goal, videoStyle, saving],
  );

  function toggleCategory(slug: string) {
    setSelectedCategories((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const min = commissionMin.trim() === "" ? null : Number(commissionMin.replace(",", "."));
    const max = commissionMax.trim() === "" ? null : Number(commissionMax.replace(",", "."));

    if (min !== null && (!Number.isFinite(min) || min < 0)) {
      toast.error("Informe uma comissão mínima válida.");
      return;
    }

    if (max !== null && (!Number.isFinite(max) || max < 0)) {
      toast.error("Informe uma comissão máxima válida.");
      return;
    }

    if (min !== null && max !== null && min > max) {
      toast.error("A comissão mínima não pode ser maior que a máxima.");
      return;
    }

    setSaving(true);

    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth", search: { modo: "entrar" }, replace: true });
        return;
      }

      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: data.user.id,
          experience_level: experienceLevel,
          categories: selectedCategories,
          goal,
          video_style: videoStyle,
          commission_min: min,
          commission_max: max,
          onboarding_completed: true,
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      toast.success("Preferências salvas. Seu Radar está preparado.");
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar suas preferências.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 md:py-12">
        <div className="mb-8">
          <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" /> Configuração inicial
          </span>
          <div className="mt-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Radar className="h-5 w-5 text-primary-foreground" />
            </span>
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">Vamos configurar o seu Radar</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Essas respostas serão usadas para personalizar filtros e recomendações. Você poderá
                alterar tudo depois nas configurações.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="surface-card p-5 md:p-6">
            <h2 className="text-base font-semibold">1. Qual é o seu nível hoje?</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {niveis.map((item) => (
                <ChoiceCard
                  key={item.value}
                  selected={experienceLevel === item.value}
                  onClick={() => setExperienceLevel(item.value)}
                  title={item.label}
                  description={item.description}
                />
              ))}
            </div>
          </section>

          <section className="surface-card p-5 md:p-6">
            <h2 className="text-base font-semibold">2. Quais categorias você quer acompanhar?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Selecione uma ou mais categorias.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {loadingCategories ? (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando categorias
                </span>
              ) : (
                categories.map((category) => {
                  const selected = selectedCategories.includes(category.slug);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.slug)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors",
                        selected
                          ? "border-gold bg-gold-soft text-gold-foreground"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                      {category.name}
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="surface-card p-5 md:p-6">
            <h2 className="text-base font-semibold">3. Qual é o seu principal objetivo?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {objetivos.map((item) => (
                <ChoiceCard
                  key={item.value}
                  selected={goal === item.value}
                  onClick={() => setGoal(item.value)}
                  title={item.label}
                />
              ))}
            </div>
          </section>

          <section className="surface-card p-5 md:p-6">
            <h2 className="text-base font-semibold">4. Como você pretende produzir os vídeos?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {estilos.map((item) => (
                <ChoiceCard
                  key={item.value}
                  selected={videoStyle === item.value}
                  onClick={() => setVideoStyle(item.value)}
                  title={item.label}
                />
              ))}
            </div>
          </section>

          <section className="surface-card p-5 md:p-6">
            <h2 className="text-base font-semibold">5. Faixa de comissão desejada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Opcional. Informe valores em reais por venda.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="commission-min">Mínima (R$)</Label>
                <Input
                  id="commission-min"
                  inputMode="decimal"
                  placeholder="Ex.: 5,00"
                  value={commissionMin}
                  onChange={(event) => setCommissionMin(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commission-max">Máxima (R$)</Label>
                <Input
                  id="commission-max"
                  inputMode="decimal"
                  placeholder="Ex.: 50,00"
                  value={commissionMax}
                  onChange={(event) => setCommissionMax(event.target.value)}
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end pb-6">
            <Button type="submit" variant="gold" size="lg" disabled={!canSubmit}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar e abrir meu painel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border p-4 text-left transition-all",
        selected
          ? "border-gold bg-gold-soft shadow-soft"
          : "border-border bg-surface hover:border-muted-foreground/30",
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-gold bg-gold text-gold-foreground" : "border-border",
          )}
        >
          {selected && <Check className="h-3 w-3" />}
        </span>
      </span>
      {description && <span className="mt-1.5 block text-xs text-muted-foreground">{description}</span>}
    </button>
  );
}
