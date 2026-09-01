import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Tag,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { OfferCard, type RealOffer } from "@/components/offers/OfferCard";
import { BRAND } from "@/lib/branding";
import { Input } from "@/components/ui/input";
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
import { resolveProductByUrlFn } from "@/lib/mercadolivre.functions";


export const Route = createFileRoute("/_authenticated/ofertas")({
  head: () => ({
    meta: [
      { title: `Ofertas — ${BRAND.name}` },
      { name: "description", content: "Ofertas reais sincronizadas com links de afiliados oficiais." },
    ],
  }),
  component: Ofertas,
});

const MARKETPLACES = [
  { value: "todos", label: "Todos" },
  { value: "shopee", label: "Shopee" },
  { value: "mercadolivre", label: "Mercado Livre" },
  { value: "amazon", label: "Amazon" },
  { value: "shein", label: "SHEIN" },
];

type SyncResult = {
  marketplace: string;
  ok: boolean;
  message?: string;
  imported?: number;
  total?: number;
};

function Ofertas() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [marketplace, setMarketplace] = useState("todos");
  const [sortBy, setSortBy] = useState<"score" | "discount" | "price" | "updated">("score");
  const [lastSyncResults, setLastSyncResults] = useState<SyncResult[]>([]);

  const syncFn = useServerFn(syncMarketplace);
  const resolveMeliFn = useServerFn(resolveProductByUrlFn);

  // Estado do painel "Adicionar produto ML"
  const [meliUrl, setMeliUrl] = useState("");
  const [meliResult, setMeliResult] = useState<{
    ok: boolean;
    title?: string;
    affiliateUrl?: string | null;
    error?: string;
  } | null>(null);

  const resolveMeliMutation = useMutation({
    mutationFn: (url: string) => resolveMeliFn({ data: { url } }),
    onSuccess: (res) => {
      if (res.ok && "product" in res) {
        const p = res.product as any;
        setMeliResult({ ok: true, title: p.title, affiliateUrl: p.affiliateUrl });
        toast.success(`Produto adicionado: "${p.title}"`);
        setMeliUrl("");
        qc.invalidateQueries({ queryKey: ["offers", "real"] });
        refetch();
      } else {
        const errMsg = "error" in res ? (res as any).error : "Erro desconhecido";
        setMeliResult({ ok: false, error: errMsg });
        toast.error(errMsg ?? "Erro ao processar o link do Mercado Livre.");
      }
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Erro ao comunicar com o servidor.";
      setMeliResult({ ok: false, error: msg });
      toast.error(msg);
    },
  });


  // ═══════════════════════════════════════════════════
  // BUSCA DE DADOS REAIS — SEM DEMO DATA
  // ═══════════════════════════════════════════════════
  const { data: offers = [], isLoading, refetch, isRefetching } = useQuery<RealOffer[]>({
    queryKey: ["offers", "real"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select(
          "id, title, image_url, marketplace, price, previous_price, discount_pct, rating, sales_count, coupon, commission, commission_pct, free_shipping, available, original_url, affiliate_url, score, status, updated_at",
        )
        .order("score", { ascending: false })
        .limit(200);

      if (error) {
        throw new Error(`Erro ao buscar ofertas: ${error.message}`);
      }

      if (!data || data.length === 0) return [];

      return data.map((o): RealOffer => ({
        id: o.id,
        title: o.title,
        imageUrl: o.image_url,
        marketplace: o.marketplace || "shopee",
        price: o.price || 0,
        previousPrice: o.previous_price,
        discountPct: o.discount_pct,
        rating: o.rating,
        ratingCount: o.sales_count ? o.sales_count * 2 : null,
        salesCount: o.sales_count,
        coupon: o.coupon,
        commission: o.commission,
        commissionPct: o.commission_pct,
        freeShipping: o.free_shipping ?? false,
        available: o.available ?? true,
        originalUrl: o.original_url,
        affiliateUrl: o.affiliate_url,
        score: o.score,
        status: o.status,
        updatedAt: o.updated_at,
      }));
    },
  });

  // ═══════════════════════════════════════════════════
  // SINCRONIZAÇÃO REAL — VERIFICA INTEGRAÇÕES CONECTADAS
  // ═══════════════════════════════════════════════════
  const syncMutation = useMutation({
    mutationFn: async (targetMarketplace: string) => {
      const results: SyncResult[] = [];

      // Verifica quais marketplaces estão conectados
      const { data: connections } = await supabase
        .from("marketplace_connections")
        .select("marketplace, status");

      const connected = (connections ?? [])
        .filter((c) => c.status === "connected")
        .map((c) => c.marketplace as string);

      if (connected.length === 0) {
        toast.warning(
          "Nenhum marketplace conectado. Configure suas integrações antes de sincronizar.",
          { duration: 5000 },
        );
        return results;
      }

      // Determina quais sincronizar
      const toSync =
        targetMarketplace !== "todos"
          ? [targetMarketplace]
          : connected;

      // Sincroniza cada marketplace sequencialmente
      for (const mkt of toSync) {
        try {
          const res = await syncFn({
            data: { marketplace: mkt as "shopee" | "mercadolivre" | "amazon" | "shein" },
          });
          results.push({
            marketplace: mkt,
            ok: res.ok,
            message: res.message,
            imported: res.imported,
            total: res.total,
          });
        } catch (err: any) {
          results.push({
            marketplace: mkt,
            ok: false,
            message: err.message || "Erro desconhecido",
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setLastSyncResults(results);

      const ok = results.filter((r) => r.ok);
      const fail = results.filter((r) => !r.ok);
      const totalImported = ok.reduce((sum, r) => sum + (r.imported ?? 0), 0);
      const totalFound = ok.reduce((sum, r) => sum + (r.total ?? 0), 0);

      if (ok.length > 0) {
        toast.success(
          `${ok.length} marketplace(s) sincronizados! ${totalFound} encontrados, ${totalImported} importados.`,
          { duration: 6000 },
        );
      }
      if (fail.length > 0) {
        toast.error(
          `${fail.length} marketplace(s) com erro: ${fail.map((r) => r.marketplace).join(", ")}`,
          { duration: 6000 },
        );
      }

      qc.invalidateQueries({ queryKey: ["offers"] });
      refetch();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar ofertas."),
  });

  // ═══════════════════════════════════════════════════
  // FILTRAGEM E ORDENAÇÃO (APENAS DADOS REAIS)
  // ═══════════════════════════════════════════════════
  const filtered = useMemo(() => {
    return offers
      .filter((o) => {
        const matchMkt = marketplace === "todos" || o.marketplace === marketplace;
        const matchQ =
          !q.trim() || o.title.toLowerCase().includes(q.trim().toLowerCase());
        return matchMkt && matchQ;
      })
      .sort((a, b) => {
        if (sortBy === "score") return (b.score ?? 0) - (a.score ?? 0);
        if (sortBy === "discount") return (b.discountPct ?? 0) - (a.discountPct ?? 0);
        if (sortBy === "price") return (a.price ?? 0) - (b.price ?? 0);
        if (sortBy === "updated")
          return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
        return 0;
      });
  }, [offers, marketplace, q, sortBy]);

  // Estatísticas rápidas
  const statsAffiliate = filtered.filter(
    (o) => o.affiliateUrl && o.affiliateUrl !== o.originalUrl,
  ).length;
  const statsMissing = filtered.filter((o) => !o.affiliateUrl).length;

  // ═══════════════════════════════════════════════════
  // BARRA DE AÇÕES
  // ═══════════════════════════════════════════════════
  const actions = (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        size="sm"
        onClick={() => syncMutation.mutate(marketplace)}
        disabled={syncMutation.isPending}
        className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <Sparkles className={`size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
        {syncMutation.isPending ? "Sincronizando..." : "Sincronizar agora"}
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
      title="Ofertas"
      description="Produtos sincronizados com links de afiliados oficiais — apenas dados reais"
      actions={actions}
    >
      {/* RESULTADO DA ÚLTIMA SINCRONIZAÇÃO */}
      {lastSyncResults.length > 0 && (
        <div className="mb-4 rounded-xl border border-border bg-card p-3 flex flex-wrap gap-2 text-xs">
          <span className="font-semibold text-foreground">Última sincronização:</span>
          {lastSyncResults.map((r) => (
            <span
              key={r.marketplace}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                r.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {r.ok ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <AlertCircle className="size-3" />
              )}
              {r.marketplace}
              {r.ok
                ? `: ${r.total ?? 0} encontrados / ${r.imported ?? 0} importados`
                : `: ${r.message}`}
            </span>
          ))}
        </div>
      )}

      {/* PAINEL — ADICIONAR PRODUTO DO MERCADO LIVRE */}
      <div className="mb-4 rounded-xl border border-yellow-500/25 bg-yellow-500/5 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="size-3.5 text-yellow-600 shrink-0" />
          <span className="text-xs font-semibold text-foreground">Adicionar produto do Mercado Livre</span>
          <span className="text-[10px] text-muted-foreground">· cole o link de afiliado ou URL do produto</span>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="https://www.mercadolivre.com.br/... ou link gerado pelo ML Afiliados"
            value={meliUrl}
            onChange={(e) => { setMeliUrl(e.target.value); setMeliResult(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && meliUrl.trim() && !resolveMeliMutation.isPending) {
                resolveMeliMutation.mutate(meliUrl.trim());
              }
            }}
            className="h-9 text-xs font-mono flex-1"
            disabled={resolveMeliMutation.isPending}
          />
          <Button
            size="sm"
            className="h-9 text-xs gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white shrink-0"
            disabled={!meliUrl.trim() || resolveMeliMutation.isPending}
            onClick={() => resolveMeliMutation.mutate(meliUrl.trim())}
          >
            {resolveMeliMutation.isPending ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <ShoppingCart className="size-3.5" />
            )}
            {resolveMeliMutation.isPending ? "Processando..." : "Adicionar"}
          </Button>
        </div>

        {/* Feedback inline */}
        {meliResult && (
          <div className={`flex items-start gap-2 rounded px-2.5 py-2 text-[11px] ${
            meliResult.ok
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          }`}>
            {meliResult.ok ? (
              <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
            )}
            <span className="break-all">
              {meliResult.ok
                ? `✅ "${meliResult.title}" adicionado à lista de Ofertas.${meliResult.affiliateUrl ? " Link de afiliado gerado com matt_word e matt_tool." : ""}`
                : meliResult.error}
            </span>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Aceita URLs com <code className="font-mono">item_id</code>, <code className="font-mono">wid</code>, links diretos MLB-... e links gerados pela extensão do ML Afiliados.
        </p>
      </div>

      {/* FILTROS */}

      <div className="mb-5 rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
        {/* Busca textual */}
        <Input
          placeholder="Buscar por nome do produto..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 text-xs w-56 shrink-0"
        />

        {/* Filtro de marketplace — BOTÕES */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {MARKETPLACES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMarketplace(m.value)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                marketplace === m.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:border-primary/50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Ordenação */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-9 text-xs w-44 shrink-0">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Maior Oferta Score</SelectItem>
            <SelectItem value="discount">Maior Desconto</SelectItem>
            <SelectItem value="price">Menor Preço</SelectItem>
            <SelectItem value="updated">Mais recente</SelectItem>
          </SelectContent>
        </Select>

        {/* Estatísticas */}
        {filtered.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShoppingCart className="size-3" />
              {filtered.length} ofertas
            </span>
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="size-3" />
              {statsAffiliate} com afiliado
            </span>
            {statsMissing > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="size-3" />
                {statsMissing} sem afiliado
              </span>
            )}
          </div>
        )}
      </div>

      {/* CONTEÚDO */}
      {isLoading ? (
        <div className="py-16 text-center space-y-2">
          <RefreshCw className="mx-auto size-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando ofertas...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-5 text-center">
          <Tag className="size-12 text-muted-foreground/40" />
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">
              {offers.length === 0
                ? "Nenhuma oferta encontrada"
                : "Nenhuma oferta corresponde aos filtros"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {offers.length === 0
                ? "Sincronize suas integrações para importar ofertas reais com links de afiliados."
                : "Tente remover filtros ou alterar o marketplace selecionado."}
            </p>
          </div>
          {offers.length === 0 && (
            <Button
              onClick={() => syncMutation.mutate("todos")}
              disabled={syncMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Sparkles className="size-4" />
              {syncMutation.isPending ? "Sincronizando..." : "Sincronizar agora"}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
