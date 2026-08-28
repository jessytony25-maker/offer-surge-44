import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MousePointerClick, Send, Tag, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { OfferCard } from "@/components/offers/OfferCard";
import { EmptyState } from "@/components/EmptyState";
import { useAppState } from "@/lib/app-state";
import { DEMO_BY_MARKETPLACE, DEMO_METRICS, DEMO_OFFERS, DEMO_SERIES } from "@/lib/demo-data";
import { brl, greeting, num, pct } from "@/lib/format";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: `Dashboard — ${BRAND.name}` },
      { name: "description", content: "KPIs de ofertas, cliques, vendas e comissões." },
      { property: "og:title", content: `Dashboard — ${BRAND.name}` },
      { property: "og:description", content: "KPIs de ofertas, cliques, vendas e comissões." },
    ],
  }),
  component: Dashboard,
});

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Dashboard() {
  const { demoMode } = useAppState();

  if (!demoMode) {
    return (
      <AppShell title="Dashboard" description={`${greeting()}! Visão geral da operação`}>
        <EmptyState
          icon={<Tag className="size-6" />}
          title="Nenhum dado ainda"
          description="Conecte um marketplace em Integrações para começar a capturar ofertas reais. Nenhum número é estimado ou inventado."
        />
      </AppShell>
    );
  }

  const m = DEMO_METRICS;

  return (
    <AppShell title="Dashboard" description={`${greeting()}! Visão geral da operação`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Tag} label="Ofertas encontradas" value={num(m.ofertasEncontradas)} hint="7 dias" />
        <Kpi icon={Send} label="Publicadas" value={num(m.ofertasPublicadas)} hint={`${num(m.ofertasAprovadas)} aprovadas`} />
        <Kpi icon={MousePointerClick} label="Cliques" value={num(m.cliques)} hint={`Conversão ${pct(m.conversao)}`} />
        <Kpi icon={Wallet} label="Comissão" value={brl(m.comissao)} hint={`${num(m.vendas)} vendas`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Cliques e comissão por dia</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DEMO_SERIES} margin={{ left: -18, right: 4, top: 4 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="cliques"
                  stroke="var(--color-primary)"
                  fill="url(#g1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Comissão por marketplace</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DEMO_BY_MARKETPLACE} margin={{ left: -18, right: 4, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="marketplace" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="comissao" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <h2 className="mt-6 text-sm font-semibold text-foreground">Melhores ofertas do momento</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {[...DEMO_OFFERS]
          .sort((a, b) => b.score - a.score)
          .map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
      </div>
    </AppShell>
  );
}
