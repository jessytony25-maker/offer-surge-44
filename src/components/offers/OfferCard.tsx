import {
  Copy,
  ExternalLink,
  Star,
  Ticket,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Link2,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { brl, num, rating as fmtRating, dateTime } from "@/lib/format";
import { scoreLabel, scoreTone } from "@/lib/offer-score";
import { generateCopy } from "@/lib/copy-generator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublishDialog } from "@/components/offers/PublishDialog";

export interface RealOffer {
  id: string;
  title: string;
  imageUrl?: string | null;
  marketplace: string;
  price: number;
  previousPrice?: number | null;
  discountPct?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  salesCount?: number | null;
  coupon?: string | null;
  commission?: number | null;
  commissionPct?: number | null;
  freeShipping?: boolean;
  available?: boolean;
  originalUrl?: string | null;
  affiliateUrl?: string | null;
  score?: number | null;
  status?: string | null;
  updatedAt?: string | null;
}

const TONE: Record<string, string> = {
  hot: "bg-success/15 text-success border-success/30",
  good: "bg-primary/10 text-primary border-primary/25",
  regular: "bg-accent/15 text-accent-foreground border-accent/30",
  low: "bg-muted text-muted-foreground border-border",
};

const MARKETPLACE_LABEL: Record<string, string> = {
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
  amazon: "Amazon",
  shein: "SHEIN",
};

const MARKETPLACE_COLOR: Record<string, string> = {
  shopee: "border-orange-500/30 bg-orange-500/10 text-orange-600",
  mercadolivre: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
  amazon: "border-amber-600/30 bg-amber-600/10 text-amber-700",
  shein: "border-pink-500/30 bg-pink-500/10 text-pink-600",
};

export function OfferCard({ offer }: { offer: RealOffer }) {
  const score = offer.score ?? 0;
  const tone = TONE[scoreTone(score)] ?? TONE["low"];

  // Prioridade de navegação:
  // Para o Mercado Livre, abrimos a URL ORIGINAL do produto para que a extensão oficial do Chrome
  // gere o link de afiliado no navegador com matt_word e matt_tool.
  // Para outros marketplaces com links encurtados/oficiais (ex: Shopee), usamos o affiliateUrl.
  const isMeli = offer.marketplace === "mercadolivre";
  const hasAffiliate =
    Boolean(offer.affiliateUrl) && offer.affiliateUrl !== offer.originalUrl;
  const targetLink = isMeli
    ? (offer.originalUrl || offer.affiliateUrl || "#")
    : (offer.affiliateUrl || offer.originalUrl || "#");
  const affiliateStatus = hasAffiliate ? "active" : isMeli ? "same" : offer.affiliateUrl ? "same" : "missing";


  const message = generateCopy(
    {
      title: offer.title,
      marketplace: offer.marketplace,
      price: offer.price,
      previousPrice: offer.previousPrice ?? undefined,
      discountPct: offer.discountPct ?? undefined,
      rating: offer.rating ?? undefined,
      salesCount: offer.salesCount ?? undefined,
      coupon: offer.coupon ?? undefined,
      link: targetLink,
    },
    { style: "promocional", length: "medio", emojis: true, detail: 4 },
  );

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Copy copiada com link de afiliado!");
    } catch {
      toast.error("Não foi possível copiar a mensagem");
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      {/* IMAGEM */}
      <div className="relative bg-muted/30">
        <img
          src={offer.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"}
          alt={offer.title}
          loading="lazy"
          className="h-44 w-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400";
          }}
        />
        {/* Badge marketplace */}
        <span
          className={`absolute top-2 left-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
            MARKETPLACE_COLOR[offer.marketplace] ?? "border-border bg-muted text-muted-foreground"
          }`}
        >
          {MARKETPLACE_LABEL[offer.marketplace] ?? offer.marketplace}
        </span>
        {/* Oferta Score */}
        {score > 0 && (
          <span
            className={`absolute top-2 right-2 rounded-md border px-2 py-0.5 text-xs font-bold ${tone}`}
            title={scoreLabel(score)}
          >
            {score}
          </span>
        )}
      </div>

      {/* CONTEÚDO */}
      <div className="flex flex-1 flex-col p-3 space-y-2">
        {/* Título */}
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground leading-snug">
          {offer.title}
        </h3>

        {/* Preços */}
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-foreground">{brl(offer.price)}</span>
          {offer.previousPrice && offer.previousPrice > offer.price && (
            <>
              <span className="text-xs text-muted-foreground line-through">
                {brl(offer.previousPrice)}
              </span>
              {offer.discountPct && offer.discountPct > 0 && (
                <span className="rounded bg-success/15 px-1.5 py-0.5 text-[11px] font-bold text-success">
                  -{offer.discountPct}%
                </span>
              )}
            </>
          )}
        </div>

        {/* Metadados */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {offer.rating != null && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3 text-amber-500" />
              {fmtRating(offer.rating)}
              {offer.ratingCount != null && ` (${num(offer.ratingCount)})`}
            </span>
          )}
          {offer.commission != null && offer.commission > 0 && (
            <span className="font-medium text-emerald-600">
              +{brl(offer.commission)} comissão
            </span>
          )}
          {offer.freeShipping && (
            <span className="inline-flex items-center gap-0.5 text-sky-600">
              <Truck className="size-3" /> Frete grátis
            </span>
          )}
          {offer.coupon && (
            <span className="inline-flex items-center gap-0.5 text-purple-600 font-mono font-bold">
              <Ticket className="size-3" /> {offer.coupon}
            </span>
          )}
        </div>

        {/* SEÇÃO DE LINKS — mostrar ambos claramente */}
        <div className="rounded-lg border border-border bg-muted/30 p-2 space-y-1.5 text-[11px]">
          {/* Link original */}
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="size-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Original:</span>
            <a
              href={offer.originalUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className="truncate text-primary hover:underline"
            >
              {offer.originalUrl
                ? new URL(offer.originalUrl).hostname
                : "—"}
            </a>
          </div>

          {/* Link de afiliado */}
          <div className="flex items-center gap-1.5">
            <Link2 className="size-3 shrink-0" />
            <span className="text-muted-foreground">Afiliado:</span>
            {affiliateStatus === "active" ? (
              <a
                href={offer.affiliateUrl!}
                target="_blank"
                rel="noreferrer"
                className="truncate text-emerald-600 font-semibold hover:underline flex items-center gap-0.5"
              >
                <CheckCircle2 className="size-3 shrink-0" />
                Link ativo
              </a>
            ) : affiliateStatus === "same" ? (
              <span className="text-amber-600 flex items-center gap-0.5">
                <AlertTriangle className="size-3 shrink-0" />
                Mesmo que original
              </span>
            ) : (
              <span className="text-destructive flex items-center gap-0.5">
                <AlertTriangle className="size-3 shrink-0" />
                Não gerado — configure a integração
              </span>
            )}
          </div>

          {/* Data de sincronização */}
          {offer.updatedAt && (
            <div className="flex items-center gap-1.5 text-muted-foreground/70">
              <Clock className="size-3 shrink-0" />
              Sync: {dateTime(offer.updatedAt)}
            </div>
          )}
        </div>
      </div>

      {/* AÇÕES */}
      <div className="flex items-center gap-1.5 border-t border-border p-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1 gap-1 text-xs h-8"
          onClick={copyMessage}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
        <PublishDialog message={message} />
        <Button
          size="sm"
          variant="ghost"
          asChild
          className="h-8 px-2"
          title={isMeli ? "Abrir no Mercado Livre (URL original para a extensão)" : hasAffiliate ? "Abrir link de afiliado" : "Abrir link original"}
        >
          <a href={targetLink} target="_blank" rel="noreferrer noopener">
            <ExternalLink className="size-3.5" />
          </a>
        </Button>

      </div>
    </article>
  );
}
