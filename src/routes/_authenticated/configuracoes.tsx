import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { BRAND } from "@/lib/branding";
import { DEFAULT_WEIGHTS } from "@/lib/offer-score";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: `Configurações — ${BRAND.name}` },
      { name: "description", content: "Preferências da conta e pesos do Oferta Score." },
      { property: "og:title", content: `Configurações — ${BRAND.name}` },
      { property: "og:description", content: "Preferências da conta e pesos do Oferta Score." },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const { user } = useAuth();

  return (
    <AppShell title="Configurações" description="Conta e pesos do Oferta Score">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">{user?.email ?? "—"}</p>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Pesos do Oferta Score</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fatores usados no cálculo. Fatores sem dado real são ignorados e a nota é normalizada.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(DEFAULT_WEIGHTS).map(([factor, weight]) => (
              <div key={factor} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {factor}
                </p>
                <p className="text-sm font-semibold text-foreground">{weight}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
