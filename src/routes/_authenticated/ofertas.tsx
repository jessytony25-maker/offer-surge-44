import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { OfferCard } from "@/components/offers/OfferCard";
import { EmptyState } from "@/components/EmptyState";
import { useAppState } from "@/lib/app-state";
import { DEMO_OFFERS } from "@/lib/demo-data";
import { BRAND } from "@/lib/branding";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/ofertas")({
  head: () => ({
    meta: [
      { title: `Ofertas — ${BRAND.name}` },
      { name: "description", content: "Fila de ofertas capturadas com Oferta Score e filtros." },
      { property: "og:title", content: `Ofertas — ${BRAND.name}` },
      { property: "og:description", content: "Fila de ofertas capturadas com Oferta Score." },
    ],
  }),
  component: Ofertas,
});

function Ofertas() {
  const { demoMode } = useAppState();
  const [q, setQ] = useState("");
  const [marketplace, setMarketplace] = useState("todos");
  const [minScore, setMinScore] = useState(0);

  const offers = useMemo(() => {
    if (!demoMode) return [];
    return DEMO_OFFERS.filter(
      (o) =>
        o.score >= minScore &&
        (marketplace === "todos" || o.marketplace === marketplace) &&
        o.title.toLowerCase().includes(q.trim().toLowerCase()),
    ).sort((a, b) => b.score - a.score);
  }, [demoMode, q, marketplace, minScore]);

  return (
    <AppShell title="Ofertas" description="Capturadas, pontuadas e prontas para publicar">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
        <Input placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={marketplace} onValueChange={setMarketplace}>
          <SelectTrigger>
            <SelectValue placeholder="Marketplace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os marketplaces</SelectItem>
            <SelectItem value="shopee">Shopee</SelectItem>
            <SelectItem value="mercadolivre">Mercado Livre</SelectItem>
            <SelectItem value="amazon">Amazon</SelectItem>
            <SelectItem value="shein">SHEIN</SelectItem>
          </SelectContent>
        </Select>
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Score mínimo: {minScore}</p>
          <Slider
            value={[minScore]}
            onValueChange={([v]) => setMinScore(v ?? 0)}
            max={100}
            step={5}
          />
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Tag className="size-6" />}
            title="Nenhuma oferta encontrada"
            description={
              demoMode
                ? "Ajuste os filtros para ver mais resultados."
                : "Conecte um marketplace em Integrações para começar a capturar ofertas reais."
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
