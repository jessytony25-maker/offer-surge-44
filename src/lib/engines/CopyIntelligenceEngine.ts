/**
 * CopyIntelligenceEngine — Geração de copy adaptativa ao perfil do grupo.
 *
 * Expande o copy-generator.ts existente com 10 estilos, suporte a
 * assinatura de marca, subID/rastreamento e adaptação por nicho.
 *
 * Regra inviolável: NUNCA inventar preço, desconto, avaliação, cupom ou
 * qualquer dado que não tenha sido fornecido explicitamente.
 */

import { brl, num } from "../format";

export type CopyStyle =
  | "urgente"
  | "viral"
  | "curto"
  | "detalhado"
  | "economico"
  | "feminino"
  | "masculino"
  | "esportivo"
  | "elegante"
  | "promocional"
  | "agressivo"
  | "clean"
  | "casual";

export interface CopyOfferInput {
  title: string;
  marketplace?: string | null;
  price?: number | null;
  previousPrice?: number | null;
  discountPct?: number | null;
  realDiscountPct?: number | null; // desconto calculado sobre histórico
  historicMinPrice?: number | null;
  rating?: number | null;
  salesCount?: number | null;
  coupon?: string | null;
  freeShipping?: boolean | null;
  affiliateLink?: string | null;
  score?: number | null;
}

export interface BrandConfig {
  brandName?: string | null;
  channelName?: string | null;
  instagram?: string | null;
  cta?: string | null;
  emoji?: string | null;
  signature?: string | null;
}

export interface CopyGenerationOptions {
  style: CopyStyle;
  emojis?: boolean;
  brand?: BrandConfig;
  groupNiche?: string | null;
  positiveKeywords?: string[];
  length?: "curto" | "medio" | "longo";
}

const STYLE_CONFIG: Record<
  CopyStyle,
  { headline: string; emoji: string; hook: string }
> = {
  urgente:     { headline: "ÚLTIMAS UNIDADES!",       emoji: "⚡", hook: "Corre que acaba!" },
  viral:       { headline: "TODO MUNDO VENDO ISSO!",  emoji: "🔥", hook: "Compartilha com quem precisa!" },
  curto:       { headline: "OFERTA RÁPIDA",           emoji: "💥", hook: "Confira:" },
  detalhado:   { headline: "OFERTA COMPLETA",         emoji: "📋", hook: "Veja os detalhes:" },
  economico:   { headline: "ECONOMIA MÁXIMA",         emoji: "💰", hook: "Economize agora:" },
  feminino:    { headline: "ACHADINHO DO DIA 💖",     emoji: "✨", hook: "Encontrei esse love:" },
  masculino:   { headline: "MELHOR PREÇO DO DIA",     emoji: "🔥", hook: "Não perde:" },
  esportivo:   { headline: "BORA TREINAR GASTANDO POUCO!", emoji: "🏃", hook: "Oferta para atletas:" },
  elegante:    { headline: "Seleção Premium",         emoji: "✦",  hook: "Qualidade que cabe no bolso:" },
  promocional: { headline: "OFERTA IMPERDÍVEL",       emoji: "🔥", hook: "Aproveite agora:" },
  agressivo:   { headline: "CORRE QUE ACABA!",        emoji: "🔥", hook: "Última chance:" },
  clean:       { headline: "Oferta do dia",           emoji: "•",  hook: "Confira:" },
  casual:      { headline: "Olha esse preço",         emoji: "👀", hook: "Vale muito a pena:" },
};

/**
 * Injeta subID no link afiliado para rastreamento por grupo.
 * Nunca inventa parâmetros proprietários de marketplace.
 */
export function injectSubId(link: string, subId: string | null | undefined): string {
  if (!link || !subId) return link;
  try {
    const url = new URL(link);
    url.searchParams.set("sub_id", subId);
    return url.toString();
  } catch {
    // Se o link não for uma URL válida, retorna como está
    return link;
  }
}

export function generateIntelligentCopy(
  offer: CopyOfferInput,
  options: CopyGenerationOptions,
): string {
  const cfg = STYLE_CONFIG[options.style] ?? STYLE_CONFIG.promocional;
  const e = options.emojis !== false ? cfg.emoji : "";
  const lines: string[] = [];
  const isLong = options.length === "longo";
  const isShort = options.length === "curto";

  // Cabeçalho adaptado ao nicho do grupo
  const headline =
    options.groupNiche && !isShort
      ? `${e ? e + " " : ""}${options.groupNiche.toUpperCase()}, ${cfg.hook.toUpperCase()}`
      : `${e ? e + " " : ""}${cfg.headline}`;
  lines.push(headline);
  lines.push("");
  lines.push(offer.title);
  lines.push("");

  // Preços — nunca inventados
  if (typeof offer.previousPrice === "number") {
    lines.push(`De: ${brl(offer.previousPrice)}`);
  }
  if (typeof offer.price === "number") {
    lines.push(`${options.emojis !== false ? "💰 " : ""}Por: ${brl(offer.price)}`);
  }

  // Desconto anunciado E desconto histórico (quando disponível)
  if (typeof offer.discountPct === "number") {
    lines.push(`${options.emojis !== false ? "🔥 " : ""}${offer.discountPct}% OFF (anunciado)`);
  }
  if (typeof offer.realDiscountPct === "number" && offer.realDiscountPct !== offer.discountPct) {
    lines.push(`📊 ${offer.realDiscountPct}% OFF (baseado no histórico de preços)`);
  }

  // Menor preço histórico
  if (typeof offer.historicMinPrice === "number" && !isShort && isLong) {
    lines.push(`📉 Menor preço registrado: ${brl(offer.historicMinPrice)}`);
  }

  // Avaliação e vendas
  if (!isShort) {
    const social: string[] = [];
    if (typeof offer.rating === "number") {
      social.push(`${options.emojis !== false ? "⭐ " : ""}${offer.rating.toFixed(1)}`);
    }
    if (typeof offer.salesCount === "number") {
      social.push(`${options.emojis !== false ? "🛒 " : ""}+${num(offer.salesCount)} vendidos`);
    }
    if (social.length) {
      lines.push("");
      lines.push(social.join("   "));
    }
  }

  // Frete grátis
  if (offer.freeShipping) {
    lines.push(`${options.emojis !== false ? "🚚 " : ""}Frete Grátis`);
  }

  // Cupom — apenas quando fornecido pela API, nunca inventado
  if (offer.coupon) {
    lines.push("");
    lines.push(`${options.emojis !== false ? "🎟️ " : ""}Cupom: ${offer.coupon}`);
  }

  // Marketplace
  if (offer.marketplace && isLong) {
    lines.push("");
    lines.push(`Disponível na ${offer.marketplace}`);
  }

  // CTA e link afiliado
  if (offer.affiliateLink) {
    lines.push("");
    const cta = options.brand?.cta || "CONFIRA A OFERTA";
    lines.push(`${options.emojis !== false ? "👉 " : ""}${cta}:`);
    lines.push(offer.affiliateLink);
  }

  // Assinatura da marca
  if (options.brand) {
    const { brandName, channelName, instagram, signature } = options.brand;
    const brandEmoji = options.brand.emoji || "";
    if (brandName || channelName || instagram || signature) {
      lines.push("");
      lines.push("—");
      if (signature) {
        lines.push(signature);
      } else {
        if (brandName) lines.push(`${brandEmoji} ${brandName}`.trim());
        if (channelName) lines.push(`📲 ${channelName}`);
        if (instagram) lines.push(`📷 @${instagram.replace("@", "")}`);
      }
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Retorna os estilos de copy disponíveis com labels em PT-BR.
 */
export const COPY_STYLE_OPTIONS: { value: CopyStyle; label: string; description: string }[] = [
  { value: "urgente",     label: "⚡ Urgente",      description: "Cria senso de urgência e escassez" },
  { value: "viral",       label: "🔥 Viral",        description: "Encoraja compartilhamento" },
  { value: "curto",       label: "💥 Curto",        description: "Mensagem direta e objetiva" },
  { value: "detalhado",   label: "📋 Detalhado",    description: "Todas as informações disponíveis" },
  { value: "economico",   label: "💰 Econômico",    description: "Foco em economia e cashback" },
  { value: "feminino",    label: "✨ Feminino",     description: "Linguagem carinhosa e acolhedora" },
  { value: "masculino",   label: "🔥 Masculino",    description: "Direto, objetivo e impactante" },
  { value: "esportivo",   label: "🏃 Esportivo",    description: "Para grupos de esportes e academia" },
  { value: "elegante",    label: "✦ Elegante",      description: "Tom sofisticado para premium" },
  { value: "promocional", label: "🔥 Promocional",  description: "Clássico de promoção" },
  { value: "agressivo",   label: "🔥 Agressivo",    description: "Máxima urgência e impacto" },
  { value: "clean",       label: "• Clean",         description: "Sem emojis, estilo neutro" },
  { value: "casual",      label: "👀 Casual",       description: "Conversa e descontraído" },
];
