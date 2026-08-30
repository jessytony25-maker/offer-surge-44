import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: `Relatórios — ${BRAND.name}` },
      { name: "description", content: "Desempenho por grupo, marketplace e categoria." },
    ],
  }),
  component: Relatorios,
});

function Relatorios() {
  return (
    <AppShell title="Relatórios" description="Desempenho real da sua operação">
      <EmptyState
        icon={<BarChart3 className="size-6 text-muted-foreground/60" />}
        title="Nenhum dado real disponível ainda"
        description="Os relatórios reais serão preenchidos assim que houver cliques e conversões registradas nos seus links de afiliados em produção."
      />
    </AppShell>
  );
}
