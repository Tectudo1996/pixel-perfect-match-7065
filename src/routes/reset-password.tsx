import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cloudClient as supabase } from "@/lib/cloud-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — RadarShop AI" },
      { name: "description", content: "Defina uma nova senha para sua conta RadarShop AI." },
      { property: "og:title", content: "Redefinir senha — RadarShop AI" },
      { property: "og:description", content: "Defina uma nova senha da sua conta." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="surface-card w-full max-w-md space-y-4 p-6">
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
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="gold" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar senha
        </Button>
      </form>
    </div>
  );
}
