import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Radar, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Modo = "entrar" | "criar" | "recuperar";
type PostAuthDestination = "/onboarding" | "/dashboard";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { modo: Modo } => {
    const m = search["modo"];
    return { modo: m === "criar" || m === "recuperar" ? (m as Modo) : "entrar" };
  },
  head: () => ({
    meta: [
      { title: "Entrar — RadarShop AI" },
      { name: "description", content: "Acesse sua conta RadarShop AI e abra o radar de produtos." },
      { property: "og:title", content: "Entrar — RadarShop AI" },
      { property: "og:description", content: "Acesse sua conta RadarShop AI." },
    ],
  }),
  component: AuthPage,
});

async function getPostAuthDestination(): Promise<PostAuthDestination> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "/onboarding";

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("onboarding_completed")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return preferences?.onboarding_completed ? "/dashboard" : "/onboarding";
}

function AuthPage() {
  const { modo } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || !active) return;
      const destination = await getPostAuthDestination();
      if (active) navigate({ to: destination, replace: true });
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  const setModo = (m: Modo) => navigate({ to: "/auth", search: { modo: m } });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        navigate({ to: await getPostAuthDestination(), replace: true });
      } else if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?modo=entrar`,
            data: { full_name: nome },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/onboarding", replace: true });
        } else {
          toast.success("Confira seu e-mail para confirmar o cadastro.");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de redefinição para o seu e-mail.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth?modo=entrar`,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: await getPostAuthDestination(), replace: true });
  }

  const titulos: Record<Modo, string> = {
    entrar: "Entrar na sua conta",
    criar: "Criar sua conta",
    recuperar: "Recuperar senha",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao site
        </Link>

        <div className="surface-card p-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Radar className="h-5 w-5 text-primary-foreground" />
          </span>
          <h1 className="mt-5 text-xl font-bold">{titulos[modo]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {modo === "recuperar"
              ? "Informe seu e-mail para receber o link de redefinição."
              : "Plataforma de inteligência para afiliados do TikTok Shop."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {modo === "criar" && (
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                required
              />
            </div>
            {modo !== "recuperar" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="senha">Senha</Label>
                  {modo === "entrar" && (
                    <button
                      type="button"
                      onClick={() => setModo("recuperar")}
                      className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input
                  id="senha"
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            )}

            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {modo === "entrar" ? "Entrar" : modo === "criar" ? "Criar conta" : "Enviar link"}
            </Button>
          </form>

          {modo !== "recuperar" && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> ou{" "}
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                disabled={loading}
              >
                Continuar com Google
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {modo === "criar" ? (
              <>
                Já tem conta?{" "}
                <button
                  onClick={() => setModo("entrar")}
                  className="cursor-pointer font-medium text-foreground hover:underline"
                >
                  Entrar
                </button>
              </>
            ) : (
              <>
                Ainda não tem conta?{" "}
                <button
                  onClick={() => setModo("criar")}
                  className="cursor-pointer font-medium text-foreground hover:underline"
                >
                  Criar conta
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
