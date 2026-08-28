import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { BRAND } from "@/lib/branding";
import { MARKETPLACE_ADAPTERS } from "@/integrations/marketplaces";
import { CHANNEL_CONNECTORS } from "@/integrations/channels";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: `Integrações — ${BRAND.name}` },
      { name: "description", content: "Conecte marketplaces e canais oficiais de publicação." },
      { property: "og:title", content: `Integrações — ${BRAND.name}` },
      { property: "og:description", content: "Conecte marketplaces e canais oficiais." },
    ],
  }),
  component: Integracoes,
});

function Card({
  name,
  description,
  status,
  onConnect,
}: {
  name: string;
  description: string;
  status: string;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{name}</h3>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {status}
        </span>
      </div>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{description}</p>
      <Button size="sm" variant="outline" className="mt-3 self-start" onClick={onConnect}>
        Configurar
      </Button>
    </div>
  );
}

function Integracoes() {
  const notify = (name: string) =>
    toast.info(
      `${name}: informe as credenciais oficiais do programa de afiliados para ativar a captura.`,
    );

  return (
    <AppShell title="Integrações" description="Marketplaces e canais oficiais">
      <h2 className="text-sm font-semibold text-foreground">Marketplaces</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.values(MARKETPLACE_ADAPTERS).map((a) => (
          <Card
            key={a.slug}
            name={a.name}
            description={a.description}
            status="Aguardando configuração"
            onConnect={() => notify(a.name)}
          />
        ))}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-foreground">Canais de publicação</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.values(CHANNEL_CONNECTORS).map((c) => (
          <Card
            key={c.slug}
            name={c.name}
            description={c.description}
            status="Aguardando configuração"
            onConnect={() => notify(c.name)}
          />
        ))}
      </div>
    </AppShell>
  );
}
