import { Link, useRouterState } from "@tanstack/react-router";
import {
  QrCode,
  Users,
  Send,
  Settings,
  FileText,
  MessageSquare,
} from "lucide-react";

export function WhatsAppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/whatsapp/conexoes", label: "Conexões", icon: QrCode },
    { to: "/whatsapp/grupos", label: "Meus grupos", icon: Users },
    { to: "/whatsapp/publicacoes", label: "Publicações", icon: Send },
    { to: "/whatsapp/configuracoes", label: "Configurações", icon: Settings },
    { to: "/whatsapp/logs", label: "Logs", icon: FileText },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3 mb-6">
      {tabs.map(({ to, label, icon: Icon }) => {
        const isActive = pathname === to || (to === "/whatsapp/conexoes" && pathname === "/whatsapp");
        return (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              isActive
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
