import { brl, num, rating as fmtRating } from "./format";

/**
 * GERADOR DE COPY
 *
 * Regra inegociável: nunca inventar preço, desconto, avaliação, vendas ou
 * cupom. Variáveis sem dado real são simplesmente omitidas da mensagem.
 */

export type CopyStyle =
  | "agressivo"
  | "urgente"
  | "clean"
  | "feminino"
  | "casual"
  | "promocional";

export type CopyLength = "curto" | "medio" | "longo";

export interface CopyOffer {
  title: string;
  marketplace?: string | null;
  price?: number | null;
  previousPrice?: number | null;
  discountPct?: number | null;
  rating?: number | null;
  salesCount?: number | null;
  coupon?: string | null;
  commission?: number | null;
  link?: string | null;
}

export interface CopyOptions {
  style: CopyStyle;
  length: CopyLength;
  emojis: boolean;
  cta?: string;
  /** Quantidade de informações exibidas (1 = essencial, 5 = tudo disponível). */
  detail: number;
  signature?: string;
}

export const COPY_STYLES: { value: CopyStyle; label: string; headline: string }[] = [
  { value: "agressivo", label: "Agressivo", headline: "CORRE QUE ACABA!" },
  { value: "urgente", label: "Urgente", headline: "ÚLTIMAS UNIDADES" },
  { value: "clean", label: "Clean", headline: "Oferta do dia" },
  { value: "feminino", label: "Feminino", headline: "ACHADINHO DO DIA" },
  { value: "casual", label: "Casual", headline: "Olha esse preço" },
  { value: "promocional", label: "Promocional", headline: "OFERTA IMPERDÍVEL" },
];

const EMOJI = {
  agressivo: "🔥",
  urgente: "⚡",
  clean: "•",
  feminino: "💖",
  casual: "👀",
  promocional: "🔥",
} as const;

export const TEMPLATE_VARIABLES = [
  "produto",
  "preco_anterior",
  "preco",
  "desconto",
  "avaliacao",
  "vendas",
  "cupom",
  "link",
  "marketplace",
  "comissao",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/** Substitui {{variaveis}}; variáveis sem dado real viram string vazia e a linha é removida. */
export function renderTemplate(body: string, offer: CopyOffer): string {
  const map: Record<TemplateVariable, string> = {
    produto: offer.title ?? "",
    preco_anterior: typeof offer.previousPrice === "number" ? brl(offer.previousPrice) : "",
    preco: typeof offer.price === "number" ? brl(offer.price) : "",
    desconto: typeof offer.discountPct === "number" ? `${offer.discountPct}% OFF` : "",
    avaliacao: typeof offer.rating === "number" ? fmtRating(offer.rating) : "",
    vendas: typeof offer.salesCount === "number" ? num(offer.salesCount) : "",
    cupom: offer.coupon ?? "",
    link: offer.link ?? "",
    marketplace: offer.marketplace ?? "",
    comissao: typeof offer.commission === "number" ? brl(offer.commission) : "",
  };

  return body
    .split("\n")
    .map((line) => {
      const used: string[] = [];
      const rendered = line.replace(/\{\{\s*(\w+)\s*\}\}/g, (_all, key: string) => {
        used.push(key);
        return map[key as TemplateVariable] ?? "";
      });
      // Linha que dependia de variável sem dado real é descartada.
      if (used.length > 0 && used.every((k) => !map[k as TemplateVariable])) return null;
      return rendered;
    })
    .filter((line): line is string => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function generateCopy(offer: CopyOffer, options: CopyOptions): string {
  const e = options.emojis ? EMOJI[options.style] : "";
  const headline =
    COPY_STYLES.find((s) => s.value === options.style)?.headline ?? "OFERTA";
  const lines: string[] = [];
  const detail = options.detail;

  lines.push(`${e ? `${e} ` : ""}${headline}`.trim());
  lines.push("");
  lines.push(offer.title);
  lines.push("");

  if (typeof offer.previousPrice === "number" && detail >= 2) {
    lines.push(`De: ${brl(offer.previousPrice)}`);
  }
  if (typeof offer.price === "number") {
    lines.push(`${options.emojis ? "💰 " : ""}Por: ${brl(offer.price)}`);
  }
  if (typeof offer.discountPct === "number" && detail >= 2) {
    lines.push(`${options.emojis ? "🔥 " : ""}${offer.discountPct}% OFF`);
  }

  if (options.length !== "curto" && detail >= 3) {
    const social: string[] = [];
    if (typeof offer.rating === "number")
      social.push(`${options.emojis ? "⭐ " : ""}${fmtRating(offer.rating)}`);
    if (typeof offer.salesCount === "number")
      social.push(`${options.emojis ? "🛒 " : ""}+${num(offer.salesCount)} vendidos`);
    if (social.length) {
      lines.push("");
      lines.push(social.join("   "));
    }
  }

  if (offer.coupon && detail >= 2) {
    lines.push("");
    lines.push(`${options.emojis ? "🎟️ " : ""}Cupom: ${offer.coupon}`);
  }

  if (options.length === "longo" && detail >= 4 && offer.marketplace) {
    lines.push("");
    lines.push(`Disponível na ${offer.marketplace}`);
  }

  if (offer.link) {
    lines.push("");
    lines.push(`${options.emojis ? "👉 " : ""}${options.cta || "CONFIRA A OFERTA"}:`);
    lines.push(offer.link);
  }

  if (options.signature) {
    lines.push("");
    lines.push(options.signature);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const DEFAULT_TEMPLATE_BODY = `🔥 ACHADINHO DO DIA!

{{produto}}

De {{preco_anterior}}
💰 {{preco}}
🔥 {{desconto}}

⭐ {{avaliacao}}
🛒 {{vendas}} vendidos
🎟️ Cupom: {{cupom}}

👉 CONFIRA A OFERTA:
{{link}}`;
