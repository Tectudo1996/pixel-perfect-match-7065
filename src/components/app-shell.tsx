import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Clapperboard,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useProfile } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const primaryNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/radar", label: "Radar de Produtos", icon: Search },
  { to: "/meu-radar", label: "Meu Radar", icon: Target },
  { to: "/favoritos", label: "Favoritos", icon: Bookmark },
  { to: "/estudio", label: "Estúdio", icon: Clapperboard },
] as const;

const accountNav = [
  { to: "/perfil", label: "Perfil", icon: UserRound },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { modo: "entrar" }, replace: true });
  }

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
          <button
            type="button"
            aria-label="Fechar menu"
            className="cursor-pointer lg:hidden"
            onClick={() => setAberto(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <NavGroup items={primaryNav} pathname={pathname} close={() => setAberto(false)} />

          <p className="px-3 pt-6 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Conta
          </p>
          <NavGroup items={accountNav} pathname={pathname} close={() => setAberto(false)} />

          {isAdmin && (
            <>
              <p className="px-3 pt-6 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Administração
              </p>
              <NavLink
                to="/admin"
                label="Painel administrativo"
                icon={ShieldCheck}
                pathname={pathname}
                close={() => setAberto(false)}
              />
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
          <button
            type="button"
            aria-label="Abrir menu"
            className="cursor-pointer"
            onClick={() => setAberto(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold">RadarShop AI</span>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}

type NavItem = {
  to:
    | "/dashboard"
    | "/radar"
    | "/meu-radar"
    | "/favoritos"
    | "/estudio"
    | "/perfil"
    | "/configuracoes";
  label: string;
  icon: typeof LayoutDashboard;
};

function NavGroup({
  items,
  pathname,
  close,
}: {
  items: readonly NavItem[];
  pathname: string;
  close: () => void;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <NavLink key={item.to} {...item} pathname={pathname} close={close} />
      ))}
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  pathname,
  close,
}: NavItem & { pathname: string; close: () => void }) {
  const active = pathname === to || pathname.startsWith(to + "/");

  return (
    <Link
      to={to}
      onClick={close}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "gold-chip font-medium"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
