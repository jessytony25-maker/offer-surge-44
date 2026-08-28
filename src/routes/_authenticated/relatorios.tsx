import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { useAppState } from "@/lib/app-state";
import { DEMO_BY_CATEGORY, DEMO_BY_GROUP, DEMO_SERIES } from "@/lib/demo-data";
import { brl, num } from "@/lib/format";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: `Relatórios — ${BRAND.name}` },
      { name: "description", content: "Desempenho por grupo, marketplace e categoria." },
      { property: "og:title", content: `Relatórios — ${BRAND.name}` },
      { property: "og:description", content: "Desempenho por grupo, marketplace e categoria." },
    ],
  }),
  component: Relatorios,
});

function Relatorios() {
  const { demoMode } = useAppState();

  if (!demoMode) {
    return (
      <AppShell title="Relatórios" description="Desempenho da operação">
        <EmptyState
          icon={<BarChart3 className="size-6" />}
          title="Sem dados para exibir"
          description="Os relatórios aparecem assim que houver cliques e conversões registrados."
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Relatórios" description="Desempenho da operação">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Comissão por dia</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={DEMO_SERIES} margin={{ left: -18, right: 4, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="comissao"
                  stroke="var(--color-success)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Comissão por categoria</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DEMO_BY_CATEGORY} margin={{ left: -18, right: 4, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="categoria" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="valor" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
          Desempenho por grupo
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Grupo</th>
                <th className="px-4 py-2 font-medium">Publicações</th>
                <th className="px-4 py-2 font-medium">Cliques</th>
                <th className="px-4 py-2 font-medium">Vendas</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_BY_GROUP.map((row) => (
                <tr key={row.grupo} className="border-t border-border">
                  <td className="px-4 py-2 font-medium text-foreground">{row.grupo}</td>
                  <td className="px-4 py-2 text-muted-foreground">{num(row.publicacoes)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{num(row.cliques)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{num(row.vendas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          Total demonstrativo de comissão: {brl(3240.5)}
        </p>
      </div>
    </AppShell>
  );
}
