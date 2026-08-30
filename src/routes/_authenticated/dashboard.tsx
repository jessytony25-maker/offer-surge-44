import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import {
  MousePointerClick,
  Send,
  Tag,
  Wallet,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { OfferCard } from "@/components/offers/OfferCard";
import { EmptyState } from "@/components/EmptyState";
import { useAppState } from "@/lib/app-state";
import { DEMO_BY_MARKETPLACE, DEMO_METRICS, DEMO_OFFERS, DEMO_SERIES } from "@/lib/demo-data";
import { brl, greeting, num, pct } from "@/lib/format";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getWhatsAppMetrics } from "@/lib/whatsapp/whatsapp.functions";

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
  const getMetricsFn = useServerFn(getWhatsAppMetrics);

  const { data: waMetrics } = useQuery({
    queryKey: ["whatsapp-metrics"],
    queryFn: () => getMetricsFn(),
  });

  const m = DEMO_METRICS;
  const isWaConnected = waMetrics?.connected ?? false;

  return (
    <AppShell title="Dashboard" description={`${greeting()}! Visão geral da operação`}>
      {/* KPIS PRINCIPAIS */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Tag} label="Ofertas encontradas" value={num(m.ofertasEncontradas)} hint="7 dias" />
        <Kpi icon={Send} label="Publicadas" value={num(m.ofertasPublicadas)} hint={`${num(m.ofertasAprovadas)} aprovadas`} />
        <Kpi icon={MousePointerClick} label="Cliques" value={num(m.cliques)} hint={`Conversão ${pct(m.conversao)}`} />
        <Kpi icon={Wallet} label="Comissão" value={brl(m.comissao)} hint={`${num(m.vendas)} vendas`} />
      </div>

      {/* CARD DO WHATSAPP CONNECTOR */}
      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">WhatsApp Connector</h2>
              <p className="text-xs text-muted-foreground">Status do canal de publicação e fila de disparos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs font-semibold ${
                isWaConnected
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {isWaConnected ? "🟢 Conectado" : "🔴 Desconectado"}
            </Badge>

            <Button size="sm" variant="outline" asChild className="h-7 text-xs gap-1">
              <Link to="/whatsapp/conexoes">
                Gerenciar WhatsApp
                <ChevronRight className="size-3" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
          <div className="rounded-lg bg-muted/40 p-2.5">
            <span className="text-[11px] text-muted-foreground">Grupos Ativos</span>
            <p className="mt-1 text-base font-bold text-foreground">{waMetrics?.activeGroups ?? 4}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <span className="text-[11px] text-muted-foreground">Publicações Hoje</span>
            <p className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
              {waMetrics?.sentToday ?? 37}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <span className="text-[11px] text-muted-foreground">Pendentes na Fila</span>
            <p className="mt-1 text-base font-bold text-amber-600 dark:text-amber-400">
              {waMetrics?.pending ?? 8}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <span className="text-[11px] text-muted-foreground">Falhas / Bloqueios</span>
            <p className="mt-1 text-base font-bold text-destructive">
              {waMetrics?.failed ?? 1}
            </p>
          </div>
        </div>
      </div>

      {/* GRÁFICOS */}
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
