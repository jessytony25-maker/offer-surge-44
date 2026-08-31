import React, { useMemo } from "react";
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
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { OfferCard } from "@/components/offers/OfferCard";
import { EmptyState } from "@/components/EmptyState";
import { brl, greeting, num, pct } from "@/lib/format";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getWhatsAppMetrics } from "@/lib/whatsapp/whatsapp.functions";
import { getDashboardStats } from "@/lib/dashboard.functions";
import { listIntegrations } from "@/lib/integrations.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: `Dashboard — ${BRAND.name}` },
      { name: "description", content: "KPIs de ofertas, cliques, vendas e comissões reais." },
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
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
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
  const getMetricsFn = useServerFn(getWhatsAppMetrics);
  const getStatsFn = useServerFn(getDashboardStats);

  const { data: waMetrics } = useQuery({
    queryKey: ["whatsapp-metrics"],
    queryFn: () => getMetricsFn(),
  });

  const { data: realStats, isLoading } = useQuery({
    queryKey: ["dashboard-stats-real"],
    queryFn: () => getStatsFn(),
  });

  const getIntegrationsFn = useServerFn(listIntegrations);

  const { data: integrations } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => getIntegrationsFn(),
  });

  const isWaConnected = waMetrics?.connected ?? false;

  // Usa exclusivamente dados Reais
  const stats = useMemo(() => {
    if (!realStats) {
      return {
        ofertasEncontradas: 0,
        ofertasPublicadas: 0,
        cliques: 0,
        comissao: 0,
        vendas: 0,
        conversao: 0,
        byMarketplace: [],
        series: [],
        topOffers: [],
      };
    }
    return realStats;
  }, [realStats]);

  if (isLoading) {
    return (
      <AppShell title="Dashboard" description={`${greeting()}! Carregando dados...`}>
        <div className="py-16 text-center">
          <div className="size-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-sm text-muted-foreground">Carregando painel real...</p>
        </div>
      </AppShell>
    );
  }

  // Se não houver dados reais disponíveis no catálogo de ofertas e publicações
  const hasRealData = stats.ofertasEncontradas > 0 || stats.cliques > 0 || stats.ofertasPublicadas > 0;

  return (
    <AppShell title="Dashboard" description={`${greeting()}! Visão geral da sua operação (Dados Reais)`}>
      
      {!hasRealData ? (
        <div className="py-12">
          <EmptyState
            icon={<Tag className="size-6 text-muted-foreground/60" />}
            title="Nenhum dado real disponível ainda"
            description="Sincronize suas integrações conectadas para importar produtos e ofertas reais para o catálogo."
            action={
              <Button size="sm" asChild className="gap-1.5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link to="/integracoes">
                  <Sparkles className="size-3.5" />
                  Conectar e Sincronizar
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* KPIS PRINCIPAIS */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Tag} label="Ofertas capturadas" value={num(stats.ofertasEncontradas)} hint="Total no catálogo" />
            <Kpi icon={Send} label="Ofertas Publicadas" value={num(stats.ofertasPublicadas)} hint="Telegram + WhatsApp" />
            <Kpi icon={MousePointerClick} label="Cliques nos links" value={num(stats.cliques)} hint={`Conversão ${pct(stats.conversao)}`} />
            <Kpi icon={Wallet} label="Comissão Estimada" value={brl(stats.comissao)} hint={`${num(stats.vendas)} vendas`} />
          </div>

          {/* CARD DO WHATSAPP CONNECTOR */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                  <MessageSquare className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">WhatsApp Multi-Device / Gateway</h2>
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
                <p className="mt-1 text-base font-bold text-foreground">{waMetrics?.activeGroups ?? 0}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-[11px] text-muted-foreground">Publicações Hoje</span>
                <p className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {waMetrics?.sentToday ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-[11px] text-muted-foreground">Pendentes na Fila</span>
                <p className="mt-1 text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
                  {waMetrics?.pending ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-[11px] text-muted-foreground">Falhas / Bloqueios</span>
                <p className="mt-1 text-base font-bold text-destructive font-mono">
                  {waMetrics?.failed ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* CARD DOS MARKETPLACES */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Conectores de Marketplace</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Estado e capacidade real de importação e conversão de ofertas</p>
              </div>
              <Button size="sm" variant="outline" asChild className="h-7 text-xs gap-1">
                <Link to="/integracoes">
                  Gerenciar Conexões
                  <ChevronRight className="size-3" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-xs">
              {["shopee", "mercadolivre", "amazon", "shein"].map((mktSlug) => {
                const mkt = integrations?.marketplaces?.find((m) => m.provider === mktSlug);
                const isMktConnected = mkt?.status === "connected" || mkt?.status === "limited";
                
                let label = "Não configurado";
                let badgeColor = "border-border bg-muted text-muted-foreground";

                if (isMktConnected) {
                  if (mktSlug === "amazon") {
                    const hasKeys = mkt?.filledKeys?.includes("api_key") && mkt?.filledKeys?.includes("api_secret");
                    if (hasKeys) {
                      label = "Busca automática ativa";
                      badgeColor = "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 font-semibold";
                    } else {
                      label = "Conversão manual ativa";
                      badgeColor = "border-amber-500/40 bg-amber-500/10 text-amber-600 font-semibold";
                    }
                  } else {
                    label = "Conectado";
                    badgeColor = "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 font-semibold";
                  }
                } else if (mkt?.status === "error") {
                  label = "Erro na Conexão";
                  badgeColor = "border-destructive/40 bg-destructive/10 text-destructive font-semibold";
                }

                return (
                  <div key={mktSlug} className="rounded-lg bg-muted/40 p-2.5 space-y-1.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-foreground uppercase">{mktSlug}</span>
                    </div>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 justify-center ${badgeColor}`}>
                      {label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GRÁFICOS */}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Desempenho diário de cliques e comissão</h2>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.series} margin={{ left: -18, right: 4, top: 4 }}>
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

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Comissão acumulada por marketplace</h2>
              <div className="mt-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byMarketplace} margin={{ left: -18, right: 4, top: 4 }}>
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

          {/* MELHORES OFERTAS */}
          <h2 className="mt-6 text-sm font-semibold text-foreground">Melhores ofertas com maior pontuação</h2>
          {stats.topOffers.length === 0 ? (
            <div className="mt-3 py-10 rounded-xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center text-center p-6 text-sm">
              <p className="text-muted-foreground">Nenhuma oferta com pontuação relevante no momento.</p>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {stats.topOffers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} />
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
