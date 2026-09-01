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
import {
  syncMarketplace,
  saveAmazonProductOfferFn,
  seedAmazonCuratedOffersFn,
  deleteAmazonOfferFn,
} from "@/lib/integrations.functions";
import { resolveProductByUrlFn, searchMeliProductsFn } from "@/lib/mercadolivre.functions";
import {
  Search,
  Compass,
  ExternalLink,
  Layers,
  ArrowRight,
  Plus,
  Package,
  Check,
  Trash2,
  Edit3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

const MELI_SUGGESTIONS = [
  { label: "Lavadora de Alta Pressão", icon: "⚡", query: "lavadora de alta pressao" },
  { label: "Fone Bluetooth", icon: "🎧", query: "fone bluetooth" },
  { label: "Celular", icon: "📱", query: "celular smartphone" },
  { label: "Air Fryer", icon: "🍳", query: "air fryer fritadeira" },
  { label: "Tênis", icon: "👟", query: "tenis esportivo" },
  { label: "Beleza", icon: "💄", query: "perfume beleza" },
  { label: "Informática", icon: "💻", query: "notebook informatica" },
  { label: "Ferramentas", icon: "🛠️", query: "parafusadeira ferramentas" },
  { label: "Casa e Cozinha", icon: "🏠", query: "casa e cozinha" },
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
  const searchMeliFn = useServerFn(searchMeliProductsFn);
  const saveAmazonFn = useServerFn(saveAmazonProductOfferFn);
  const seedAmazonFn = useServerFn(seedAmazonCuratedOffersFn);
  const deleteAmazonFn = useServerFn(deleteAmazonOfferFn);

  // Estado do catálogo / busca de produtos do Mercado Livre
  const [meliSearchKeyword, setMeliSearchKeyword] = useState("");
  const [meliActiveTerm, setMeliActiveTerm] = useState("");
  const [meliOffset, setMeliOffset] = useState(0);
  const [meliTotalFound, setMeliTotalFound] = useState(0);
  const [showMeliManualUrl, setShowMeliManualUrl] = useState(false);

  // Estado do painel auxiliar "Adicionar produto avulso por URL"
  const [meliUrl, setMeliUrl] = useState("");
  const [meliResult, setMeliResult] = useState<{
    ok: boolean;
    title?: string;
    affiliateUrl?: string | null;
    error?: string;
  } | null>(null);

  // Estados do Modal / Catálogo da Amazon
  const [showAmazonModal, setShowAmazonModal] = useState(false);
  const [amazonAsinOrUrl, setAmazonAsinOrUrl] = useState("");
  const [amazonTitle, setAmazonTitle] = useState("");
  const [amazonImageUrl, setAmazonImageUrl] = useState("");
  const [amazonPrice, setAmazonPrice] = useState("");
  const [amazonPreviousPrice, setAmazonPreviousPrice] = useState("");
  const [amazonFreeShipping, setAmazonFreeShipping] = useState(true);
  const [editingOfferId, setEditingOfferId] = useState<string | undefined>(undefined);

  // Extração reativa do ASIN
  const extractedAmazonAsin = useMemo(() => {
    const clean = amazonAsinOrUrl.trim();
    const match = clean.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|([B0-9][A-Z0-9]{9})/i);
    return match ? (match[1] || match[2] || match[3]).toUpperCase() : "";
  }, [amazonAsinOrUrl]);

  // Mutation para salvar produto Amazon no catálogo
  const saveAmazonMutation = useMutation({
    mutationFn: async () => {
      const priceNum = parseFloat(amazonPrice.replace(",", "."));
      if (isNaN(priceNum) || priceNum <= 0) {
        throw new Error("Informe um preço válido maior que zero.");
      }
      const prevPriceNum = amazonPreviousPrice
        ? parseFloat(amazonPreviousPrice.replace(",", "."))
        : null;

      return saveAmazonFn({
        data: {
          asinOrUrl: amazonAsinOrUrl,
          title: amazonTitle,
          imageUrl: amazonImageUrl || undefined,
          price: priceNum,
          previousPrice: prevPriceNum && !isNaN(prevPriceNum) ? prevPriceNum : null,
          freeShipping: amazonFreeShipping,
          offerId: editingOfferId,
        },
      });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message || "Produto adicionado ao Catálogo Amazon com sucesso!");
        setShowAmazonModal(false);
        setAmazonAsinOrUrl("");
        setAmazonTitle("");
        setAmazonImageUrl("");
        setAmazonPrice("");
        setAmazonPreviousPrice("");
        setEditingOfferId(undefined);
        qc.invalidateQueries({ queryKey: ["offers", "real"] });
        refetch();
      } else {
        toast.error(res.error || "Erro ao salvar produto Amazon.");
      }
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erro ao comunicar com o servidor.");
    },
  });

  // Mutation para importar Top Achadinhos Amazon com 1 clique
  const seedAmazonMutation = useMutation({
    mutationFn: () => seedAmazonFn({ data: {} }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message || "Top Achadinhos da Amazon importados com sucesso!");
        qc.invalidateQueries({ queryKey: ["offers", "real"] });
        refetch();
      }
    },
    onError: (e: any) => {
      toast.error(e?.message || "Erro ao importar achadinhos da Amazon.");
    },
  });


  // Mutation para buscar no catálogo do Mercado Livre (busca real + auto-save em offers)
  const searchMeliMutation = useMutation({
    mutationFn: async (params: { keyword: string; offset?: number; limit?: number }) => {
      const res = await searchMeliFn({
        data: {
          keyword: params.keyword,
          offset: params.offset ?? 0,
          limit: params.limit ?? 20,
          saveToOffers: true,
        },
      });
      return { res, vars: params };
    },
    onSuccess: ({ res, vars }) => {
      if (res.ok && "results" in res) {
        const count = res.results?.length ?? 0;
        const total = (res as any).paging?.total ?? count;
        setMeliTotalFound(total);
        setMeliOffset(vars.offset ?? 0);
        setMeliActiveTerm(vars.keyword);
        toast.success(`${count} produtos reais encontrados e sincronizados nas Ofertas!`);
        qc.invalidateQueries({ queryKey: ["offers", "real"] });
        refetch();
      } else {
        const errMsg = "error" in res ? (res as any).error : "Erro na busca";
        toast.error(errMsg || "Erro ao buscar produtos no Mercado Livre.");
      }
    },
    onError: (e: any) => {
      toast.error(e?.message || "Falha ao conectar com o catálogo do Mercado Livre.");
    },
  });

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

  const handleMeliSearch = (keywordToSearch?: string, newOffset: number = 0) => {
    const term = (keywordToSearch || meliSearchKeyword).trim();
    if (!term) {
      toast.warning("Digite um termo para buscar produtos no Mercado Livre.");
      return;
    }
    if (keywordToSearch) {
      setMeliSearchKeyword(keywordToSearch);
    }
    searchMeliMutation.mutate({ keyword: term, offset: newOffset, limit: 20 });
  };



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

      {/* PAINEL — CATÁLOGO E BUSCA MERCADO LIVRE */}
      {(marketplace === "todos" || marketplace === "mercadolivre") && (
        <div className="mb-5 rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-card to-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-yellow-500/20 p-1.5 text-yellow-700">
                <ShoppingBag className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Catálogo Oficial do Mercado Livre
                  <Badge variant="outline" className="text-[10px] font-normal border-yellow-500/40 bg-yellow-500/10 text-yellow-700">
                    API Real + Extensão Chrome
                  </Badge>
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Busque milhares de produtos reais, adicione às ofertas e gere links via extensão oficial com seus IDs (<span className="font-mono text-yellow-700">matt_word=jessycursos</span>).
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={() => setShowMeliManualUrl(!showMeliManualUrl)}
            >
              <Link2 className="size-3.5 mr-1" />
              {showMeliManualUrl ? "Ocultar URL avulsa" : "Colar URL avulsa"}
            </Button>
          </div>

          {/* Barra de Busca de Catálogo */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos no catálogo ML (ex: lavadora de alta pressão, celular, fone bluetooth, air fryer...)"
                value={meliSearchKeyword}
                onChange={(e) => setMeliSearchKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && meliSearchKeyword.trim() && !searchMeliMutation.isPending) {
                    handleMeliSearch();
                  }
                }}
                className="h-10 pl-9 text-xs bg-background/80"
                disabled={searchMeliMutation.isPending}
              />
            </div>
            <Button
              size="sm"
              className="h-10 px-4 text-xs font-semibold gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white shrink-0 shadow-sm"
              disabled={!meliSearchKeyword.trim() || searchMeliMutation.isPending}
              onClick={() => handleMeliSearch()}
            >
              {searchMeliMutation.isPending ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Search className="size-3.5" />
              )}
              {searchMeliMutation.isPending ? "Buscando..." : "Buscar no ML"}
            </Button>
          </div>

          {/* Categorias Populares / Sugestões rápidas com 1 clique */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Compass className="size-3 text-yellow-600" />
              <span>Sugestões de busca populares:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MELI_SUGGESTIONS.map((sug) => (
                <button
                  key={sug.query}
                  onClick={() => handleMeliSearch(sug.query, 0)}
                  disabled={searchMeliMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card/70 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-yellow-500/50 hover:bg-yellow-500/10 transition-colors disabled:opacity-50"
                >
                  <span>{sug.icon}</span>
                  <span>{sug.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status da busca ativa e botão de Carregar Mais */}
          {meliActiveTerm && (
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/60 text-xs">
              <div className="text-muted-foreground text-[11px]">
                Termo ativo: <strong className="text-foreground">"{meliActiveTerm}"</strong>
                {meliTotalFound > 0 && (
                  <span> · Total no catálogo ML: ~{meliTotalFound.toLocaleString("pt-BR")} produtos</span>
                )}
              </div>
              {meliTotalFound > meliOffset + 20 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] gap-1 border-yellow-500/30 hover:bg-yellow-500/10 text-yellow-700"
                  disabled={searchMeliMutation.isPending}
                  onClick={() => handleMeliSearch(meliActiveTerm, meliOffset + 20)}
                >
                  {searchMeliMutation.isPending ? (
                    <RefreshCw className="size-3 animate-spin" />
                  ) : (
                    <ArrowRight className="size-3" />
                  )}
                  Carregar mais produtos (+20)
                </Button>
              )}
            </div>
          )}

          {/* Painel opcional para colar URL avulsa */}
          {showMeliManualUrl && (
            <div className="pt-3 border-t border-border/70 space-y-2">
              <div className="flex items-center gap-2">
                <Link2 className="size-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Importar por link/URL individual</span>
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
                  className="h-9 text-xs font-mono flex-1 bg-background/80"
                  disabled={resolveMeliMutation.isPending}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs gap-1.5 shrink-0"
                  disabled={!meliUrl.trim() || resolveMeliMutation.isPending}
                  onClick={() => resolveMeliMutation.mutate(meliUrl.trim())}
                >
                  {resolveMeliMutation.isPending ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  {resolveMeliMutation.isPending ? "Processando..." : "Importar URL"}
                </Button>
              </div>

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
                      ? `✅ "${meliResult.title}" adicionado às Ofertas!`
                      : meliResult.error}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Guia informativo da extensão Chrome */}
          <div className="rounded-lg bg-background/60 border border-border/60 p-2.5 flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-base leading-none">💡</span>
            <div>
              <strong className="text-foreground font-medium">Fluxo de divulgação com a extensão do Chrome:</strong> Ao clicar no botão de link externo em qualquer card de oferta, o produto original abre no Mercado Livre. A <strong>extensão oficial do Mercado Livre Afiliados</strong> instalada no seu navegador reconhece a página e gera o link de afiliado com seus IDs configurados (<code className="font-mono text-yellow-700 bg-yellow-500/10 px-1 py-0.5 rounded">matt_word=jessycursos</code> e <code className="font-mono text-yellow-700 bg-yellow-500/10 px-1 py-0.5 rounded">matt_tool=64193262</code>).
            </div>
          </div>
        </div>
      )}

      {/* PAINEL — CATÁLOGO DE ACHADINHOS AMAZON */}
      {(marketplace === "todos" || marketplace === "amazon") && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/20 p-1.5 text-amber-700">
                <Package className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Catálogo de Achadinhos Amazon
                  <Badge variant="outline" className="text-[10px] font-normal border-amber-500/40 bg-amber-500/10 text-amber-700 font-mono">
                    tag=achadinh07203-20
                  </Badge>
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Produtos cadastrados no catálogo com links de afiliados oficiais gerados automaticamente pelo sistema.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-amber-500/30 hover:bg-amber-500/10 text-amber-700"
                disabled={seedAmazonMutation.isPending}
                onClick={() => seedAmazonMutation.mutate()}
              >
                {seedAmazonMutation.isPending ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {seedAmazonMutation.isPending ? "Importando..." : "Importar Top Achadinhos Amazon"}
              </Button>

              <Button
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                onClick={() => {
                  setEditingOfferId(undefined);
                  setAmazonAsinOrUrl("");
                  setAmazonTitle("");
                  setAmazonImageUrl("");
                  setAmazonPrice("");
                  setAmazonPreviousPrice("");
                  setShowAmazonModal(true);
                }}
              >
                <Plus className="size-3.5" />
                Adicionar produto Amazon
              </Button>
            </div>
          </div>

          {/* Guia informativo de afiliação Amazon */}
          <div className="rounded-lg bg-background/60 border border-border/60 p-2.5 flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-base leading-none">🔗</span>
            <div>
              <strong className="text-foreground font-medium">Geração Automática de Links:</strong> Cada produto da Amazon no catálogo gera automaticamente a URL oficial de afiliado (<code className="font-mono text-amber-700 bg-amber-500/10 px-1 py-0.5 rounded">https://www.amazon.com.br/dp/ASIN?tag=achadinh07203-20</code>). O botão <strong>"Abrir na Amazon"</strong> direciona diretamente para o anúncio no marketplace.
            </div>
          </div>
        </div>
      )}

      {/* MODAL / DIALOG — ADICIONAR / EDITAR PRODUTO AMAZON */}
      <Dialog open={showAmazonModal} onOpenChange={setShowAmazonModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="size-4 text-amber-600" />
              {editingOfferId ? "Editar Produto Amazon" : "Adicionar Produto ao Catálogo Amazon"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* URL ou ASIN */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">URL da Amazon ou ASIN do Produto *</Label>
              <Input
                placeholder="Ex: B09B8V1LZ3 ou https://www.amazon.com.br/dp/B09B8V1LZ3..."
                value={amazonAsinOrUrl}
                onChange={(e) => setAmazonAsinOrUrl(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              {extractedAmazonAsin && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  <Check className="size-3 shrink-0" />
                  <span>ASIN Detectado: <strong className="font-mono">{extractedAmazonAsin}</strong></span>
                  <span className="text-muted-foreground">· Link com tag: achadinh07203-20</span>
                </div>
              )}
            </div>

            {/* Título */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Título / Nome do Produto *</Label>
              <Input
                placeholder="Ex: Echo Dot 5ª Geração | Smart Speaker com Alexa"
                value={amazonTitle}
                onChange={(e) => setAmazonTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Imagem */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">URL da Imagem do Produto (Opcional)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="https://m.media-amazon.com/images/I/..."
                  value={amazonImageUrl}
                  onChange={(e) => setAmazonImageUrl(e.target.value)}
                  className="h-8 text-xs flex-1 font-mono text-[11px]"
                />
                {amazonImageUrl && (
                  <img
                    src={amazonImageUrl}
                    alt="Preview"
                    className="size-8 rounded border object-cover shrink-0 bg-muted"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
              </div>
            </div>

            {/* Preços */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Preço Atual (R$) *</Label>
                <Input
                  placeholder="Ex: 299,00"
                  value={amazonPrice}
                  onChange={(e) => setAmazonPrice(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Preço Original / De (R$)</Label>
                <Input
                  placeholder="Ex: 379,00 (opcional)"
                  value={amazonPreviousPrice}
                  onChange={(e) => setAmazonPreviousPrice(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Checkbox Frete Grátis */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="amazon-free-shipping"
                checked={amazonFreeShipping}
                onChange={(e) => setAmazonFreeShipping(e.target.checked)}
                className="rounded border-border text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="amazon-free-shipping" className="text-xs text-foreground cursor-pointer select-none">
                Destaque com Frete Grátis
              </label>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAmazonModal(false)}
              disabled={saveAmazonMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={
                !amazonAsinOrUrl.trim() ||
                !amazonTitle.trim() ||
                !amazonPrice.trim() ||
                saveAmazonMutation.isPending
              }
              onClick={() => saveAmazonMutation.mutate()}
            >
              {saveAmazonMutation.isPending ? (
                <RefreshCw className="size-3.5 animate-spin mr-1" />
              ) : (
                <Check className="size-3.5 mr-1" />
              )}
              {saveAmazonMutation.isPending ? "Salvando..." : "Salvar no Catálogo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



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
