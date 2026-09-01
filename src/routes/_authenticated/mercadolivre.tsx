import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Star,
  ShoppingCart,
  Link2,
  Package,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { resolveProductByUrlFn } from "@/lib/mercadolivre.functions";

export const Route = createFileRoute("/_authenticated/mercadolivre")({
  head: () => ({
    meta: [
      { title: `Mercado Livre — ${BRAND.name}` },
      { name: "description", content: "Busque produtos reais do Mercado Livre e gere links de afiliado." },
    ],
  }),
  component: MercadoLivrePage,
});

type ProductResult = {
  id: string | null;
  externalId: string;
  catalogId: string | null;
  idType: "listing" | "catalog";
  title: string;
  imageUrl: string | null;
  price: number;
  originalPrice: number | null;
  discountPct: number | null;
  rating: number | null;
  salesCount: number | null;
  originalUrl: string;
  affiliateUrl: string | null;
  affiliateStatus: "resolved" | "pending";
  affiliateNote: string;
  freeShipping: boolean;
  category: string | null;
  commissionPct: number;
  commissionValue: number | null;
};

function MercadoLivrePage() {
  const [urlInput, setUrlInput] = useState("");
  const [product, setProduct] = useState<ProductResult | null>(null);
  const [copy, setCopy] = useState("");
  const [apiError, setApiError] = useState<{
    error: string;
    httpStatus?: number | null;
    endpoint?: string;
    step?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const resolveFn = useServerFn(resolveProductByUrlFn);

  const resolveMutation = useMutation({
    mutationFn: (url: string) => resolveFn({ data: { url } }),
    onSuccess: (res) => {
      if (res.ok) {
        setProduct(res.product as ProductResult);
        setCopy(res.copy);
        setApiError(null);
        toast.success("Produto encontrado com dados reais do Mercado Livre!");
      } else {
        setProduct(null);
        setCopy("");
        setApiError({
          error: res.error,
          httpStatus: "httpStatus" in res ? res.httpStatus : undefined,
          endpoint: "endpoint" in res ? res.endpoint : undefined,
          step: "step" in res ? res.step : undefined,
        });
      }
    },
    onError: (e: any) => {
      setProduct(null);
      setCopy("");
      setApiError({ error: e.message || "Erro ao comunicar com o servidor." });
      toast.error("Falha na busca do produto.");
    },
  });

  const handleSearch = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) { toast.error("Cole uma URL do Mercado Livre."); return; }
    setApiError(null);
    setProduct(null);
    setCopy("");
    resolveMutation.mutate(trimmed);
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Copiado!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            Mercado Livre — Busca de Produto
          </h1>
          <p className="text-sm text-muted-foreground">
            Cole a URL de um produto real do Mercado Livre para obter dados, gerar o link de afiliado e a copy para divulgacao.
          </p>
        </div>

        {/* Input de URL */}
        <div className="flex gap-2">
          <Input
            placeholder="https://produto.mercadolivre.com.br/MLB-XXXXXXXX..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="font-mono text-xs h-10"
          />
          <Button
            onClick={handleSearch}
            disabled={resolveMutation.isPending}
            className="h-10 shrink-0"
          >
            {resolveMutation.isPending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            <span className="ml-1.5">{resolveMutation.isPending ? "Buscando..." : "Buscar"}</span>
          </Button>
        </div>

        {/* Instrucao */}
        <div className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2 space-y-1">
          <p className="font-semibold text-foreground">Formatos de URL aceitos:</p>
          <p className="font-mono">https://produto.mercadolivre.com.br/MLB-XXXXXXXX-titulo</p>
          <p className="font-mono">https://www.mercadolivre.com.br/p/MLB12345678</p>
          <p className="mt-1">Requer Access Token OAuth configurado em Integracoes → Mercado Livre.</p>
        </div>

        {/* Erro da API — com detalhes reais */}
        {apiError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1 w-full">
                <p className="text-sm font-semibold text-destructive">Falha ao buscar produto</p>
                <p className="text-xs text-foreground whitespace-pre-wrap">{apiError.error}</p>
                {(apiError.httpStatus || apiError.endpoint) && (
                  <div className="text-[10px] text-muted-foreground font-mono bg-background rounded p-1.5 border border-border space-y-0.5">
                    {apiError.httpStatus != null && <p>HTTP Status: <span className="text-destructive font-bold">{apiError.httpStatus}</span></p>}
                    {apiError.endpoint && <p>Endpoint: {apiError.endpoint}</p>}
                    {apiError.step && <p>Etapa: {apiError.step}</p>}
                    <p>Timestamp: {new Date().toISOString()}</p>
                  </div>
                )}
                {apiError.httpStatus === 403 && (
                  <div className="mt-2 text-xs bg-amber-500/10 border border-amber-500/20 rounded p-2 text-amber-700">
                    <p className="font-semibold">HTTP 403 — Nao e erro de internet.</p>
                    <p>O servidor do Mercado Livre recusou a requisicao. Verifique:</p>
                    <ul className="list-disc list-inside space-y-0.5 mt-1">
                      <li>Access Token OAuth configurado e valido</li>
                      <li>Token nao expirado (validade ~6h — use refresh_token para renovar)</li>
                      <li>O app tem as permissoes necessarias</li>
                    </ul>
                    <Button size="sm" variant="outline" className="mt-2 h-7 text-[11px]" onClick={() => window.location.href = "/integracoes"}>
                      Ir para Integracoes → Mercado Livre
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Card do Produto */}
        {product && (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden space-y-0">
            {/* Imagem + Dados Basicos */}
            <div className="flex gap-4 p-4">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="w-28 h-28 object-contain rounded-lg border border-border shrink-0 bg-muted"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-28 h-28 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0">
                  <Package className="size-8 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 space-y-2 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight line-clamp-3">{product.title}</p>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl font-bold text-emerald-600">{fmt(product.price)}</span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="text-xs text-muted-foreground line-through">{fmt(product.originalPrice)}</span>
                  )}
                  {product.discountPct && product.discountPct > 0 && (
                    <Badge className="bg-red-500 text-white text-[10px] h-5">-{product.discountPct}%</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {product.rating !== null && (
                    <span className="flex items-center gap-1">
                      <Star className="size-3 text-yellow-500 fill-yellow-500" />
                      {product.rating.toFixed(1)}
                    </span>
                  )}
                  {product.salesCount !== null && (
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="size-3" />
                      {product.salesCount.toLocaleString("pt-BR")} vendidos
                    </span>
                  )}
                {product.freeShipping && (
                    <span className="text-emerald-600 font-medium">Frete gratis</span>
                  )}
                </div>

                {/* Badge de Catálogo */}
                {product.idType === "catalog" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-blue-600 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1 w-fit">
                    <Layers className="size-3" />
                    Produto de catálogo · melhor oferta selecionada
                    {product.catalogId && <span className="font-mono opacity-60">({product.catalogId})</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Comissão Estimada */}
            <div className="border-t border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-emerald-600" />
                  Comissão Estimada — ML Afiliados
                </span>
                <span className="text-xs text-muted-foreground">estimativa</span>
              </div>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <span className="text-lg font-bold text-emerald-600">
                  {product.commissionValue !== null
                    ? `R$ ${product.commissionValue.toFixed(2).replace(".", ",")}`
                    : "—"}
                </span>
                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-[11px]">
                  {product.commissionPct}% de comissão
                </Badge>
                <span className="text-[10px] text-muted-foreground">por venda gerada via seu link</span>
              </div>
            </div>

            {/* Status do Link de Afiliado */}
            <div className="border-t border-border px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Link de Afiliado</span>
                {product.affiliateStatus === "resolved" ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="size-3 mr-1" /> Gerado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-600">
                    <AlertTriangle className="size-3 mr-1" /> Pendente
                  </Badge>
                )}
              </div>

              {product.affiliateUrl ? (
                <div className="flex gap-2">
                  <Input
                    value={product.affiliateUrl}
                    readOnly
                    className="font-mono text-[10px] h-8 bg-muted"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0"
                    onClick={() => handleCopyLink(product.affiliateUrl!)}
                  >
                    {copied ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded p-2 space-y-1.5">
                  <p>{product.affiliateNote}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => window.open("https://www.mercadolivre.com.br/afiliados/extensao", "_blank")}
                    >
                      <Link2 className="size-3" />
                      Instalar extensao ML
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1"
                      onClick={() => window.open(product.originalUrl, "_blank")}
                    >
                      <ExternalLink className="size-3" />
                      Abrir produto
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Botoes de Acao */}
            <div className="border-t border-border px-4 py-3 flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => window.open(product.originalUrl, "_blank")}
              >
                <ExternalLink className="size-3.5" />
                Abrir no ML
              </Button>
              {product.affiliateUrl && (
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white"
                  onClick={() => handleCopyLink(product.affiliateUrl!)}
                >
                  <Copy className="size-3.5" />
                  Copiar link afiliado
                </Button>
              )}
            </div>

            {/* Copy de Divulgacao */}
            {copy && (
              <div className="border-t border-border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Copy para Divulgacao</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => handleCopyLink(copy)}
                  >
                    <Copy className="size-3" />
                    Copiar tudo
                  </Button>
                </div>
                <pre className="text-xs text-foreground bg-muted rounded p-3 whitespace-pre-wrap font-sans leading-relaxed select-all border border-border max-h-64 overflow-auto">
                  {copy}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}