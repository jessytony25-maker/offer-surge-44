import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Tag,
  Users,
  Zap,
  Plug,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  ListChecks,
  ShoppingBag,
  MessageSquare,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/branding";
import { useAppState } from "@/lib/app-state";
import { DemoBadge } from "@/components/DemoBadge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ofertas", label: "Ofertas", icon: Tag },
  { to: "/whatsapp/conexoes", label: "WhatsApp", icon: MessageSquare },
  { to: "/shopee-analytics", label: "Shopee Analytics", icon: ShoppingBag },
  { to: "/grupos", label: "Grupos", icon: Users },
  { to: "/fila", label: "Fila", icon: ListChecks },
  { to: "/automacoes", label: "Automações", icon: Zap },
  { to: "/integracoes", label: "Integrações", icon: Plug },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || (to === "/whatsapp/conexoes" && pathname.startsWith("/whatsapp"));
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        {BRAND.shortName}
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-foreground">{BRAND.name}</p>
        <p className="text-[11px] text-muted-foreground">{BRAND.tagline}</p>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { demoMode } = useAppState();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between border-r border-border bg-card px-4 py-5 lg:flex">
        <div className="space-y-6">
          <BrandMark />
          <NavList />
        </div>
        <Button variant="ghost" className="justify-start gap-3" onClick={signOut}>
          <LogOut className="size-4" /> Sair
        </Button>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-4">
                <div className="mb-6">
                  <BrandMark />
                </div>
                <NavList onNavigate={() => setOpen(false)} />
                <Button
                  variant="ghost"
                  className="mt-6 w-full justify-start gap-3"
                  onClick={signOut}
                >
                  <LogOut className="size-4" /> Sair
                </Button>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
                  {title}
                </h1>
                {demoMode ? <DemoBadge /> : null}
              </div>
              {description ? (
                <p className="truncate text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions}
          </div>
        </header>

        <main className="px-4 py-5 pb-16 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
