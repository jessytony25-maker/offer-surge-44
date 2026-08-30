import { Copy, ExternalLink, Star, Ticket, Truck, Link2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { DemoOffer } from "@/lib/demo-data";
import { brl, num, rating as fmtRating } from "@/lib/format";
import { scoreLabel, scoreTone } from "@/lib/offer-score";
import { generateCopy } from "@/lib/copy-generator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublishDialog } from "@/components/offers/PublishDialog";

const TONE: Record<string, string> = {
  hot: "bg-success/15 text-success border-success/30",
  good: "bg-primary/10 text-primary border-primary/25",
  regular: "bg-accent/15 text-accent-foreground border-accent/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function OfferCard({ offer }: { offer: DemoOffer }) {
  const tone = TONE[scoreTone(offer.score)] ?? TONE["low"];
  const targetLink = offer.affiliateUrl || offer.originalUrl;
  const isAffiliateLink = Boolean(offer.affiliateUrl && offer.affiliateUrl !== offer.originalUrl);

  const message = generateCopy(
    {
      title: offer.title,
      marketplace: offer.marketplace,
      price: offer.price,
      previousPrice: offer.previousPrice,
      discountPct: offer.discountPct,
      rating: offer.rating,
      salesCount: offer.salesCount,
      coupon: offer.coupon,
      link: targetLink,
    },
    { style: "promocional", length: "medio", emojis: true, detail: 4 },
  );

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Copy copiada com Link de Afiliado!");
    } catch {
      toast.error("Não foi possível copiar a mensagem");
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex gap-3 p-3">
        <img
          src={offer.image}
          alt={offer.title}
          loading="lazy"
          width={512}
          height={512}
          className="size-20 shrink-0 rounded-lg object-cover sm:size-24"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
              {offer.title}
            </h3>
            <span
              className={`shrink-0 rounded-md border px-2 py-1 text-xs font-bold ${tone}`}
              title={scoreLabel(offer.score)}
            >
              {offer.score}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {offer.marketplace} · {offer.category}
            </p>
            {isAffiliateLink && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold gap-0.5">
                <CheckCircle2 className="size-2.5" /> Afiliado Ativo
              </Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
            <span className="text-base font-bold text-foreground">{brl(offer.price)}</span>
            <span className="text-xs text-muted-foreground line-through">
              {brl(offer.previousPrice)}
            </span>
            <span className="rounded bg-success/15 px-1.5 py-0.5 text-[11px] font-semibold text-success">
              -{offer.discountPct}%
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" /> {fmtRating(offer.rating)} ({num(offer.ratingCount)})
            </span>
            <span>Comissão {brl(offer.commission)}</span>
            {offer.freeShipping ? (
              <span className="inline-flex items-center gap-1">
                <Truck className="size-3" /> Frete grátis
              </span>
            ) : null}
            {offer.coupon ? (
              <span className="inline-flex items-center gap-1">
                <Ticket className="size-3" /> {offer.coupon}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border p-2">
        <Button size="sm" variant="secondary" className="flex-1 gap-1 text-xs" onClick={copyMessage}>
          <Copy className="size-3.5" /> Copy com Afiliado
        </Button>
        <PublishDialog message={message} />
        <Button size="sm" variant="ghost" asChild title="Abrir Link de Afiliado">
          <a href={targetLink} target="_blank" rel="noreferrer noopener">
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>
    </article>
  );
}
