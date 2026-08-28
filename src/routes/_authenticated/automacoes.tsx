import { createFileRoute } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({
    meta: [
      { title: `Automações — ${BRAND.name}` },
      { name: "description", content: "Regras automáticas de captura, filtro e publicação." },
      { property: "og:title", content: `Automações — ${BRAND.name}` },
      { property: "og:description", content: "Regras automáticas de captura e publicação." },
    ],
  }),
  component: Automacoes,
});

const STEPS = [
  {
    title: "1. Gatilho",
    text: "Nova oferta capturada, queda de preço detectada ou horário agendado.",
  },
  {
    title: "2. Filtros",
    text: "Score mínimo, faixa de preço, desconto mínimo, categoria, marketplace e palavras bloqueadas.",
  },
  {
    title: "3. Ação",
    text: "Gerar copy pelo template, encurtar link de afiliado e enfileirar para os grupos escolhidos.",
  },
  {
    title: "4. Limites",
    text: "Intervalo entre envios, limite diário por grupo e janela de horário permitida.",
  },
];

function Automacoes() {
  return (
    <AppShell title="Automações" description="Da captura à publicação, sem trabalho manual">
      <div className="grid gap-3 md:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">{s.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <EmptyState
          icon={<Zap className="size-6" />}
          title="Nenhuma automação ativa"
          description="Cadastre um grupo e conecte um marketplace oficial para criar sua primeira regra de publicação automática."
        />
      </div>
    </AppShell>
  );
}
