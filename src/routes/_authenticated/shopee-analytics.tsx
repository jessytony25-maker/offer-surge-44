import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ShoppingBag,
  TrendingUp,
  MousePointerClick,
  Wallet,
  Package,
  Calendar,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plug,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { shopeeAnalytics, refreshTopSellers } from "@/lib/shopee.functions";
import { brl, num, pct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/shopee-analytics")({
  head: () => ({
    meta: [
      { title: `Shopee Analytics — ${BRAND.name}` },
      { name: "description", content: "Métricas de cliques, vendas e comissões da Shopee Oficial." },
      { property: "og:title", content: `Shopee Analytics — ${BRAND.name}` },
      { property: "og:description", content: "Métricas de cliques, vendas e comissões da Shopee Oficial." },
    ],
  }),
  component: ShopeeAnalyticsPage,
});

type PeriodMode = "today" | "7days" | "month" | "custom";

function ShopeeAnalyticsPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<PeriodMode>("7days");

  // Date filters
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const monthAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const [customStart, setCustomStart] = useState(sevenDaysAgoStr);
  const [customEnd, setCustomEnd] = useState(todayStr);

  const fetchAnalytics = useServerFn(shopeeAnalytics);
  const syncTopSellers = useServerFn(refreshTopSellers);

  // Calcula startSec e endSec com base no período selecionado
  const { startSec, endSec } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    if (period === "today") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      return { startSec: Math.floor(startOfDay.getTime() / 1000), endSec: now };
    }
    if (period === "7days") {
      return { startSec: now - 7 * 24 * 3600, endSec: now };
    }
    if (period === "month") {
      return { startSec: now - 30 * 24 * 3600, endSec: now };
    }
    // Custom
    const s = Math.floor(new Date(customStart).getTime() / 1000) || (now - 7 * 24 * 3600);
    const e = Math.floor(new Date(customEnd).getTime() / 1000) + 86399 || now;
    return { startSec: s, endSec: e };
  }, [period, customStart, customEnd]);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["shopee-analytics", period, startSec, endSec],
    queryFn: () => fetchAnalytics({ data: { startSec, endSec, period } }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => syncTopSellers(),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["shopee-analytics"] });
      qc.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao sincronizar mais vendidos."),
  });

  const metrics = data ?? {
    connected: false,
    clicks: 0,
    orders: 0,
    items: 0,
    revenue: 0,
    commission: 0,
    conversionRate: 0,
    daily: [],
    topItems: [],
  };

  const periodLabels: Record<PeriodMode, string> = {
    today: "Hoje (Vendas do dia)",
    "7days": "Últimos 7 dias",
    month: "Este Mês (30 dias)",
    custom: "Personalizado",
  };

  return (
    <AppShell
      title="Shopee Analytics"
      description={`Métricas oficiais de conversão, cliques e comissões — ${periodLabels[period]}`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="gap-1.5 text-xs h-8"
          >
            <Sparkles className="size-3.5 text-amber-500" />
            {syncMutation.isPending ? "Atualizando..." : "Sincronizar Mais Vendidos"}
          </Button>

          <Button
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar Dados
          </Button>
        </div>
      }
    >
      {/* STATUS DE CONEXÃO DA SHOPEE */}
      <div className={`mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border p-4 ${
        metrics.connected
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100"
          : "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`flex size-9 items-center justify-center rounded-lg ${
            metrics.connected ? "bg-emerald-500/20 text-emerald-600" : "bg-amber-500/20 text-amber-600"
          }`}>
            {metrics.connected ? <CheckCircle2 className="size-5" /> : <ShoppingBag className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {metrics.connected ? "Shopee Open API Conectada" : "Shopee Não Conectada"}
              </h3>
              <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${
                metrics.connected ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10" : "border-amber-500/40 text-amber-600 bg-amber-500/10"
              }`}>
                {metrics.connected ? "Oficial" : "Inativo"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {metrics.connected
                ? "Sincronização em tempo real ativa com seu App ID e Senha da API (Secret)."
                : "Para visualizar seus dados oficiais de afiliado, conecte seu App ID + Senha da API na aba Integrações."}
            </p>
          </div>
        </div>

        {!metrics.connected && (
          <Button size="sm" variant="outline" asChild className="gap-1.5 shrink-0 text-xs">
            <Link to="/integracoes">
              <Plug className="size-3.5" />
              Conectar Shopee
            </Link>
          </Button>
        )}
      </div>

      {/* SELETOR DE PERÍODO */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={period === "today" ? "default" : "outline"}
            onClick={() => setPeriod("today")}
            className="text-xs h-8"
          >
            Hoje (Vendas do dia)
          </Button>
          <Button
            size="sm"
            variant={period === "7days" ? "default" : "outline"}
            onClick={() => setPeriod("7days")}
            className="text-xs h-8"
          >
            Últimos 7 dias
          </Button>
          <Button
            size="sm"
            variant={period === "month" ? "default" : "outline"}
            onClick={() => setPeriod("month")}
            className="text-xs h-8"
          >
            Este Mês (30 dias)
          </Button>
          <Button
            size="sm"
            variant={period === "custom" ? "default" : "outline"}
            onClick={() => setPeriod("custom")}
            className="text-xs h-8 gap-1.5"
          >
            <Calendar className="size-3.5" />
            Personalizado
          </Button>
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">De:</span>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Até:</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
          </div>
        )}
      </div>

      {/* CARDS DE KPIS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Vendas / Pedidos</span>
            <ShoppingBag className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-xl font-bold text-foreground">{num(metrics.orders)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">pedidos aprovados</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Cliques</span>
            <MousePointerClick className="size-4 text-sky-500" />
          </div>
          <p className="mt-2 text-xl font-bold text-foreground">{num(metrics.clicks)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">acessos nos links</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Itens Vendidos</span>
            <Package className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-xl font-bold text-foreground">{num(metrics.items)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">unidades de produtos</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Faturamento</span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-xl font-bold text-foreground">{brl(metrics.revenue)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">valor bruto vendido</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Comissão Gerada</span>
            <Wallet className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-xl font-bold text-foreground text-emerald-600 dark:text-emerald-400">
            {brl(metrics.commission)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">ganho líquido estimado</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Taxa Conversão</span>
            <Sparkles className="size-4 text-purple-500" />
          </div>
          <p className="mt-2 text-xl font-bold text-foreground">{pct(metrics.conversionRate)}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">cliques → vendas</p>
        </div>
      </div>

      {/* GRÁFICOS RECHARTS */}
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* Gráfico 1: Vendas e Comissão */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Comissão e Vendas Diárias (Shopee)</h3>
            <Badge variant="outline" className="text-[10px]">R$ / Dia</Badge>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.daily} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="shopeeComm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} fontSize={10} />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    name === "commission" ? brl(val) : val,
                    name === "commission" ? "Comissão" : name === "orders" ? "Pedidos" : name,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="commission"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#shopeeComm)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Cliques por dia */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Cliques vs Pedidos por Dia</h3>
            <Badge variant="outline" className="text-[10px]">Engajamento</Badge>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.daily} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} fontSize={10} />
                <Tooltip />
                <Bar dataKey="clicks" name="Cliques" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="orders" name="Pedidos" fill="var(--color-success, #10b981)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TABELA DE PRODUTOS MAIS VENDIDOS */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Produtos Mais Vendidos e Convertidos</h3>
            <p className="text-xs text-muted-foreground">Itens da Shopee que mais geraram comissão e pedidos no período</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {metrics.topItems.length} produtos em alta
          </Badge>
        </div>

        {metrics.topItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhuma conversão de produto registrada no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Loja Parceira</th>
                  <th className="px-4 py-3 font-medium text-center">Unidades</th>
                  <th className="px-4 py-3 font-medium text-right">Faturamento</th>
                  <th className="px-4 py-3 font-medium text-right">Comissão</th>
                  <th className="px-4 py-3 font-medium text-center">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {metrics.topItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="size-10 rounded-lg object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-lg bg-muted border border-border shrink-0">
                            <ShoppingBag className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 max-w-sm">
                          <p className="font-semibold text-foreground truncate">{item.name}</p>
                          {item.itemId && <p className="text-[10px] font-mono text-muted-foreground">ID: {item.itemId}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.shop || "Shopee"}</td>
                    <td className="px-4 py-3 text-center font-bold text-foreground">{item.qty} un</td>
                    <td className="px-4 py-3 text-right font-medium text-muted-foreground">{brl(item.revenue)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {brl(item.commission)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button size="icon" variant="ghost" className="size-7" asChild>
                        <a href={item.link || "https://shopee.com.br"} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
