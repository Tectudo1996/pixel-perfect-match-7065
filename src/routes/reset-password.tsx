import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cloudClient as supabase } from "@/lib/cloud-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RecoveryState = "checking" | "ready" | "missing";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — RadarShop AI" },
      { name: "description", content: "Defina uma nova senha para sua conta RadarShop AI." },
      { property: "og:title", content: "Redefinir senha — RadarShop AI" },
      { property: "og:description", content: "Defina uma nova senha da sua conta." },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setRecoveryState(session ? "ready" : "missing");
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setRecoveryState(!error && data.session ? "ready" : "missing");
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (recoveryState !== "ready") {
      toast.error("O link de redefinição não está mais válido.");
      return;
    }

    if (senha !== confirmacao) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Senha atualizada.");
    navigate({ to: "/dashboard", replace: true });
  }

  if (recoveryState === "checking") {
    return (
      <PageFrame>
        <div className="surface-card flex min-h-48 items-center justify-center p-6">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando link de redefinição
          </span>
        </div>
      </PageFrame>
    );
  }

  if (recoveryState === "missing") {
    return (
      <PageFrame>
        <div className="surface-card p-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <h1 className="mt-4 text-xl font-bold">Link inválido ou expirado</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Este link não possui mais uma sessão válida para alterar a senha. Solicite um novo link
            de recuperação para continuar com segurança.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="gold">
              <Link to="/auth" search={{ modo: "recuperar" }}>
                Solicitar novo link
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/auth" search={{ modo: "entrar" }}>
                Voltar para entrar
              </Link>
            </Button>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <form onSubmit={handleSubmit} className="surface-card w-full space-y-4 p-6">
        <h1 className="text-xl font-bold">Definir nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Escolha uma nova senha para acessar sua conta.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="senha">Nova senha</Label>
          <Input
            id="senha"
            type="password"
            minLength={6}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmacao">Confirmar senha</Label>
          <Input
            id="confirmacao"
            type="password"
            minLength={6}
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="gold" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar senha
        </Button>
      </form>
    </PageFrame>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao site
        </Link>
        {children}
      </div>
    </div>
  );
}
