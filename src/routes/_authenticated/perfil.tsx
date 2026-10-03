import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, KeyRound, Loader2, Mail, Save, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useAuth";
import { cloudClient as supabase } from "@/lib/cloud-client";

export const Route = createFileRoute("/_authenticated/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meu Perfil — RadarShop AI" },
      { name: "description", content: "Gerencie seus dados de conta e segurança." },
      { property: "og:title", content: "Meu Perfil — RadarShop AI" },
      { property: "og:description", content: "Gerencie seus dados de conta e segurança." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError, error } = useProfile();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const initials = useMemo(() => {
    const source = profile?.full_name?.trim() || profile?.email?.trim() || "R";
    return source.charAt(0).toUpperCase();
  }, [profile?.email, profile?.full_name]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = fullName.trim();

    if (name.length < 2) {
      toast.error("Informe um nome com pelo menos 2 caracteres.");
      return;
    }

    if (name.length > 80) {
      toast.error("O nome pode ter no máximo 80 caracteres.");
      return;
    }

    setSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Sessão não encontrada.");

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userData.user.id,
          full_name: name,
        },
        { onConflict: "id" },
      );

      if (profileError) throw profileError;

      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado.");
    } catch (saveError) {
      console.error("[RadarShop AI] profile save error", saveError);
      toast.error(
        saveError instanceof Error ? saveError.message : "Não foi possível atualizar o perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    const email = profile?.email?.trim();

    if (!email) {
      toast.error("Sua conta não possui um e-mail disponível para redefinição.");
      return;
    }

    setSendingReset(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;
      toast.success("Enviamos o link de redefinição para o seu e-mail.");
    } catch (resetError) {
      console.error("[RadarShop AI] password reset request error", resetError);
      toast.error(
        resetError instanceof Error
          ? resetError.message
          : "Não foi possível enviar o link de redefinição.",
      );
    } finally {
      setSendingReset(false);
    }
  }

  if (isLoading) {
    return (
      <div className="surface-card flex min-h-64 items-center justify-center">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando perfil
        </span>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <section className="surface-card p-6">
        <h1 className="text-xl font-semibold">Não foi possível carregar seu perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "Atualize a página. Se o problema continuar, entre novamente na sua conta."}
        </p>
      </section>
    );
  }

  const joinedAt = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Data indisponível";

  return (
    <div className="space-y-6">
      <section>
        <span className="gold-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
          <UserRound className="h-3.5 w-3.5" />
          Sua conta
        </span>
        <h1 className="mt-3 text-2xl font-bold md:text-3xl">Meu Perfil</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Mantenha seus dados principais atualizados e gerencie o acesso à sua conta.
        </p>
      </section>

      <section className="surface-card p-5 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-xl font-semibold">
            {initials}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {profile.full_name?.trim() || "Usuário RadarShop"}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{profile.email}</span>
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              Conta criada em {joinedAt}
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSave} className="surface-card p-5 md:p-6">
        <div>
          <h2 className="text-base font-semibold">Dados pessoais</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O nome é usado para identificar sua conta dentro do RadarShop.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-full-name">Nome</Label>
            <Input
              id="profile-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={80}
              autoComplete="name"
              placeholder="Seu nome"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-email">E-mail</Label>
            <Input id="profile-email" value={profile.email ?? ""} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              O e-mail é gerenciado pela autenticação da sua conta.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="submit" variant="gold" disabled={saving || fullName.trim().length < 2}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar perfil
          </Button>
        </div>
      </form>

      <section className="surface-card p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              <h2 className="text-base font-semibold">Senha e acesso</h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Envie um link seguro para o e-mail da conta e defina uma nova senha pela página de
              recuperação.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={sendingReset || !profile.email}
            onClick={() => void handlePasswordReset()}
          >
            {sendingReset ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Enviar link
          </Button>
        </div>
      </section>
    </div>
  );
}
