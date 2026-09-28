import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Link2, Loader2, Save, Settings2, Unplug } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cloudClient as supabase } from "@/lib/cloud-client";
import { useCategories, usePreferences } from "@/hooks/useAuth";
import {
  useConnectTikTokShop,
  useDisconnectTikTokShop,
  useTikTokShopConnection,
} from "@/hooks/useTikTokShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configurações — RadarShop AI" },
      {
        name: "description",
        content: "Ajuste as preferências usadas para personalizar o seu Radar.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: preferences, isLoading: loadingPreferences } = usePreferences();
  const { data: categories = [], isLoading: loadingCategories } = useCategories();
  const {
    data: tiktokShop,
    isLoading: loadingTikTokShop,
    isError: tiktokShopError,
    error: tiktokShopErrorDetail,
  } = useTikTokShopConnection();
  const connectTikTokShop = useConnectTikTokShop();
  const disconnectTikTokShop = useDisconnectTikTokShop();

  const [experienceLevel, setExperienceLevel] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [videoStyle, setVideoStyle] = useState("");
  const [commissionMin, setCommissionMin] = useState("");
  const [commissionMax, setCommissionMax] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    if (params.get("integracao") !== "tiktok-shop") return;

    const status = params.get("status");

    if (status === "connected") {
      toast.success("TikTok Shop conectado com segurança.");
      void queryClient.invalidateQueries({ queryKey: ["tiktok-shop-connection"] });
    } else if (status === "error") {
      toast.error("Não foi possível concluir a conexão com o TikTok Shop.");
    }

    params.delete("integracao");
    params.delete("status");
    const search = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
    );
  }, [queryClient]);

  useEffect(() => {
    if (!preferences || hydrated) return;

    setExperienceLevel(preferences.experience_level ?? "");
    setSelectedCategories(preferences.categories ?? []);
    setGoal(preferences.goal ?? "");
    setVideoStyle(preferences.video_style ?? "");
    setCommissionMin(preferences.commission_min === null ? "" : String(preferences.commission_min));
    setCommissionMax(preferences.commission_max === null ? "" : String(preferences.commission_max));
    setHydrated(true);
  }, [preferences, hydrated]);

  const canSave = useMemo(
    () =>
      hydrated &&
      experienceLevel.length > 0 &&
      selectedCategories.length > 0 &&
      goal.length > 0 &&
      videoStyle.length > 0 &&
      !saving,
    [hydrated, experienceLevel, selectedCategories, goal, videoStyle, saving],
  );

  async function handleConnectTikTokShop() {
    try {
      const result = await connectTikTokShop.mutateAsync();
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a conexão.");
    }
  }

  async function handleDisconnectTikTokShop() {
    if (!window.confirm("Desconectar sua conta do TikTok Shop deste RadarShop?")) return;

    try {
      await disconnectTikTokShop.mutateAsync();
      toast.success("TikTok Shop desconectado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível desconectar o TikTok Shop.",
      );
    }
  }

  function toggleCategory(slug: string) {
    setSelectedCategories((current) =>
      current.includes(slug) ? current.filter((category) => category !== slug) : [...current, slug],
    );
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    const min = parseCurrency(commissionMin);
    const max = parseCurrency(commissionMax);

    if (commissionMin.trim() && min === null) {
      toast.error("Informe uma comissão mínima válida.");
      return;
    }

    if (commissionMax.trim() && max === null) {
      toast.error("Informe uma comissão máxima válida.");
      return;
    }

    if (min !== null && max !== null && min > max) {
      toast.error("A comissão mínima não pode ser maior que a máxima.");
      return;
    }

    setSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Sua sessão expirou. Entre novamente.");

      const { error } = await supabase
        .from("user_preferences")
        .update({
          experience_level: experienceLevel,
          categories: selectedCategories,
          goal,
          video_style: videoStyle,
          commission_min: min,
          commission_max: max,
        })
        .eq("user_id", userData.user.id);

      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["preferences"] }),
        queryClient.invalidateQueries({ queryKey: ["personal-radar"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      ]);

      toast.success("Preferências atualizadas.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar suas preferências.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingPreferences) {
    return (
      <div className="surface-card flex min-h-64 items-center justify-center">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando preferências
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <Settings2 className="h-3.5 w-3.5" /> Personalização
        </span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Configurações</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ajuste os dados que o Meu Radar usa para filtrar e organizar o catálogo.
        </p>
      </section>

      <TikTokShopConnectionCard
        data={tiktokShop}
        loading={loadingTikTokShop}
        error={tiktokShopError}
        errorDetail={tiktokShopErrorDetail}
        connecting={connectTikTokShop.isPending}
        disconnecting={disconnectTikTokShop.isPending}
        onConnect={() => void handleConnectTikTokShop()}
        onDisconnect={() => void handleDisconnectTikTokShop()}
      />

      <form onSubmit={handleSave} className="space-y-5">
        <section className="surface-card p-5 md:p-6">
          <h2 className="text-base font-semibold">Perfil de afiliado</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nível de experiência">
              <select
                value={experienceLevel}
                onChange={(event) => setExperienceLevel(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione</option>
                <option value="iniciante">Iniciante</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </select>
            </Field>

            <Field label="Objetivo principal">
              <select
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione</option>
                <option value="primeira_venda">Fazer minha primeira venda</option>
                <option value="aumentar_vendas">Aumentar minhas vendas</option>
                <option value="novos_produtos">Encontrar produtos novos</option>
                <option value="maior_comissao">Encontrar comissões melhores</option>
              </select>
            </Field>

            <Field label="Estilo de conteúdo">
              <select
                value={videoStyle}
                onChange={(event) => setVideoStyle(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione</option>
                <option value="aparecer">Aparecendo nos vídeos</option>
                <option value="sem_aparecer">Sem aparecer</option>
                <option value="ia">Conteúdo com IA</option>
                <option value="ainda_nao_sei">Ainda não defini</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="surface-card p-5 md:p-6">
          <h2 className="text-base font-semibold">Categorias acompanhadas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O Meu Radar usa essas categorias como filtro real do catálogo.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {loadingCategories ? (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando categorias
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
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
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
          <h2 className="text-base font-semibold">Faixa de comissão</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Valores opcionais em reais por venda. Produtos sem comissão em R$ não entram quando uma
            faixa é definida.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-commission-min">Mínima (R$)</Label>
              <Input
                id="settings-commission-min"
                value={commissionMin}
                onChange={(event) => setCommissionMin(event.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 5,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-commission-max">Máxima (R$)</Label>
              <Input
                id="settings-commission-max"
                value={commissionMax}
                onChange={(event) => setCommissionMax(event.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 50,00"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end pb-6">
          <Button type="submit" variant="gold" size="lg" disabled={!canSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar preferências
          </Button>
        </div>
      </form>
    </div>
  );
}

function TikTokShopConnectionCard({
  data,
  loading,
  error,
  errorDetail,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
}: {
  data: ReturnType<typeof useTikTokShopConnection>["data"];
  loading: boolean;
  error: boolean;
  errorDetail: unknown;
  connecting: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (loading) {
    return (
      <section className="surface-card flex min-h-36 items-center justify-center p-5">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verificando conexão com TikTok Shop
        </span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="surface-card p-5 md:p-6">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold">TikTok Shop</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A integração ainda não está disponível neste ambiente.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {errorDetail instanceof Error
                ? errorDetail.message
                : "Conclua a configuração server-side antes de conectar sua conta."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const connected = data?.connected === true;
  const enabled = data?.enabled === true;
  const configured = data?.configured === true;
  const canConnect = enabled && configured && !connected;
  const statusLabel = connected
    ? "conectado"
    : !enabled
      ? "em preparação"
      : configured
        ? "não conectado"
        : "configuração pendente";

  return (
    <section className="surface-card p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">TikTok Shop</h2>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase">
                {statusLabel}
              </span>
            </div>

            {!enabled ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                A integração oficial está preparada no RadarShop, mas permanece desligada até o
                aplicativo receber acesso no TikTok Shop Partner Center.
              </p>
            ) : !configured ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                A integração foi habilitada, mas a configuração segura do servidor ainda não está
                completa.
              </p>
            ) : (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Conecte sua conta Creator para permitir que o RadarShop use as integrações oficiais
                do TikTok Shop autorizadas para o aplicativo.
              </p>
            )}

            {connected && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>
                  Conectado em:{" "}
                  {data.connectedAt ? dateTimeBR(data.connectedAt) : "data indisponível"}
                </p>
                <p>
                  Escopos concedidos:{" "}
                  {data.grantedScopes.length ? data.grantedScopes.join(", ") : "não informados"}
                </p>
                {data.accessTokenExpiresAt && (
                  <p>Access token expira em: {dateTimeBR(data.accessTokenExpiresAt)}</p>
                )}
              </div>
            )}

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Tokens e App Secret permanecem no servidor e não são exibidos nesta página.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {connected ? (
            <Button type="button" variant="outline" disabled={disconnecting} onClick={onDisconnect}>
              {disconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
              Desconectar
            </Button>
          ) : canConnect ? (
            <Button type="button" variant="gold" disabled={connecting} onClick={onConnect}>
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Conectar TikTok Shop
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function dateTimeBR(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function parseCurrency(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
