import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tag, Sparkles, RefreshCw, Filter, ArrowUpDown, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { OfferCard } from "@/components/offers/OfferCard";
import { EmptyState } from "@/components/EmptyState";
import { useAppState } from "@/lib/app-state";
import { DEMO_OFFERS, type DemoOffer } from "@/lib/demo-data";
import { BRAND } from "@/lib/branding";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { syncMarketplace } from "@/lib/integrations.functions";

export const Route = createFileRoute("/_authenticated/ofertas")({
  head: () => ({
    meta: [
      { title: `Ofertas e Mais Vendidos — ${BRAND.name}` },
      { name: "description", content: "Produtos mais vendidos e ofertas capturadas com Links de Afiliados Oficiais." },
      { property: "og:title", content: `Ofertas e Mais Vendidos — ${BRAND.name}` },
      { property: "og:description", content: "Produtos mais vendidos e ofertas com links de afiliados." },
    ],
  }),
  component: Ofertas,
});

function Ofertas() {
  const qc = useQueryClient();
  const { demoMode } = useAppState();
  const [q, setQ] = useState("");
  const [marketplace, setMarketplace] = useState("todos");
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<"score" | "discount" | "commission" | "price">("score");

  const syncMarketplaceFn = useServerFn(syncMarketplace);

  // Busca ofertas do Supabase
  const { data: dbOffers = [], isLoading, refetch, isRefetching } = useQuery<DemoOffer[]>({
    queryKey: ["offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .order("score", { ascending: false });

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((o) => ({
        id: o.id,
        title: o.title,
        image: o.image_url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
        marketplace: o.marketplace || "shopee",
        category: "geral",
        previousPrice: o.previous_price || (o.price ? Math.round(o.price * (1 + (o.discount_pct || 20) / 100) * 100) / 100 : 0),
        price: o.price || 0,
        discountPct: o.discount_pct || 0,
        rating: o.rating || 4.8,
        ratingCount: (o.sales_count || 100) * 2,
        salesCount: o.sales_count || 0,
        coupon: o.coupon || null,
        commission: o.commission || 0,
        commissionPct: o.commission_pct || 10,
        freeShipping: o.free_shipping ?? true,
        available: o.available ?? true,
        originalUrl: o.original_url || "https://shopee.com.br",
        affiliateUrl: o.affiliate_url || o.original_url,
        score: o.score || 80,
        status: o.status as DemoOffer["status"],
      }));
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (targetMarketplace?: string) => {
      const market = targetMarketplace && targetMarketplace !== "todos" ? targetMarketplace : "shopee";
      return syncMarketplaceFn({ data: { marketplace: market as any } });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message || "Ofertas sincronizadas com sucesso!");
      } else {
        toast.error(res.message || "Não foi possível sincronizar ofertas.");
      }
      refetch();
      qc.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao sincronizar ofertas."),
  });

  // Combina ofertas do banco de dados com ofertas demo se houver
  const allAvailableOffers = useMemo(() => {
    if (dbOffers.length > 0) {
      return dbOffers;
    }
    return demoMode ? DEMO_OFFERS : [];
  }, [dbOffers, demoMode]);

  const filteredOffers = useMemo(() => {
    return allAvailableOffers
      .filter((o) => {
        const matchesScore = o.score >= minScore;
        const matchesMarketplace = marketplace === "todos" || o.marketplace === marketplace;
        const matchesQuery = !q.trim() || o.title.toLowerCase().includes(q.trim().toLowerCase());
        return matchesScore && matchesMarketplace && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === "score") return b.score - a.score;
        if (sortBy === "discount") return b.discountPct - a.discountPct;
        if (sortBy === "commission") return b.commission - a.commission;
        if (sortBy === "price") return a.price - b.price;
        return 0;
      });
  }, [allAvailableOffers, q, marketplace, minScore, sortBy]);

  const actions = (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={() => syncMutation.mutate(marketplace)}
        disabled={syncMutation.isPending}
        className="gap-1.5 text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white"
      >
        <Sparkles className="size-3.5" />
        {syncMutation.isPending ? "Sincronizando..." : "↻ Sincronizar Ofertas Oficiais"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => refetch()}
        disabled={isLoading || isRefetching}
        className="gap-1.5 text-xs h-8"
      >
        <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
        Atualizar
      </Button>
    </div>
  );

  return (
    <AppShell
      title="Ofertas & Sugestões"
      description="Levantamento contínuo dos produtos mais vendidos com Links de Afiliados Oficiais e Oferta Score"
      actions={actions}
    >
      {/* BARRA DE FILTROS E PESQUISA */}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4 mb-5">
        <div className="sm:col-span-1">
          <Input
            placeholder="Buscar produto por nome..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        <div>
          <Select value={marketplace} onValueChange={setMarketplace}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Marketplace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Marketplaces</SelectItem>
              <SelectItem value="shopee">Shopee (Open API)</SelectItem>
              <SelectItem value="mercadolivre">Mercado Livre (MLB)</SelectItem>
              <SelectItem value="amazon">Amazon (Associados)</SelectItem>
              <SelectItem value="shein">SHEIN (Afiliados)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Maior Oferta Score</SelectItem>
              <SelectItem value="discount">Maior Desconto (%)</SelectItem>
              <SelectItem value="commission">Maior Comissão (R$)</SelectItem>
              <SelectItem value="price">Menor Preço</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col justify-center gap-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Score Mínimo:</span>
            <strong className="text-foreground">{minScore} pts</strong>
          </div>
          <Slider
            value={[minScore]}
            min={0}
            max={90}
            step={5}
            onValueChange={(v) => setMinScore(v[0] || 0)}
            className="py-1"
          />
        </div>
      </div>

      {/* RESULTADOS */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Carregando ofertas...</p>
      ) : filteredOffers.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Nenhuma oferta encontrada"
          description={
            dbOffers.length === 0
              ? "Conecte suas contas na aba Integrações e clique em 'Sincronizar Ofertas Oficiais' para carregar produtos com link de afiliado."
              : "Nenhuma oferta corresponde aos filtros selecionados."
          }
          action={
            dbOffers.length === 0 ? (
              <Button
                size="sm"
                onClick={() => syncMutation.mutate("shopee")}
                disabled={syncMutation.isPending}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Sparkles className="size-3.5" />
                Sincronizar Ofertas Agora
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredOffers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
