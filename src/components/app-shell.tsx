import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Radar,
  LayoutDashboard,
  Heart,
  Wand2,
  User,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useProfile } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/radar", label: "Radar de Produtos", icon: Radar },
  { to: "/meu-radar", label: "Meu Radar", icon: Target },
  { to: "/favoritos", label: "Favoritos", icon: Heart },
  { to: "/estudio", label: "Estúdio de Conteúdo", icon: Wand2 },
] as const;

const conta = [
  { to: "/perfil", label: "Meu Perfil", icon: User },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const { data: isAdmin } = useIsAdmin();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { modo: "entrar" }, replace: true });
  }

  const item = (to: string, label: string, Icon: typeof Radar) => {
    const ativo = pathname === to || pathname.startsWith(to + "/");
    return (
      <Link
        key={to}
        to={to}
        onClick={() => setAberto(false)}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
          ativo
            ? "gold-chip font-medium"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-sidebar transition-transform lg:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Radar className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="text-sm font-bold tracking-tight">RadarShop AI</span>
          </Link>
          <button className="cursor-pointer lg:hidden" onClick={() => setAberto(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((n) => item(n.to, n.label, n.icon))}
          <p className="px-3 pt-5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Conta
          </p>
          {conta.map((n) => item(n.to, n.label, n.icon))}
          {isAdmin && (
            <>
              <p className="px-3 pt-5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Administração
              </p>
              {item("/admin", "Painel admin", Shield)}
            </>
          )}
        </nav>
        <div className="border-t border-border p-3">
          <div className="truncate px-3 pb-2 text-xs text-muted-foreground">{profile?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={sair}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      {aberto && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
          onClick={() => setAberto(false)}
        />
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur lg:hidden">
          <button className="cursor-pointer" onClick={() => setAberto(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold">RadarShop AI</span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
