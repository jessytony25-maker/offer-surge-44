/**
 * OFFER_SCORE — algoritmo modular de pontuação de ofertas (0 a 100).
 *
 * Cada fator só entra no cálculo quando o dado existe. Fatores ausentes são
 * ignorados e o score é normalizado pelos pesos efetivamente aplicados —
 * assim nunca "inventamos" informação para completar a nota.
 * Os pesos são configuráveis (tabela offer_score_weights).
 */

export type OfferScoreFactor =
  | "discount"
  | "price"
  | "priceHistory"
  | "rating"
  | "ratingCount"
  | "sales"
  | "commission"
  | "coupon"
  | "shipping"
  | "availability"
  | "popularity"
  | "category";

export type OfferScoreWeights = Record<OfferScoreFactor, number>;

export const DEFAULT_WEIGHTS: OfferScoreWeights = {
  discount: 22,
  price: 8,
  priceHistory: 10,
  rating: 12,
  ratingCount: 8,
  sales: 12,
  commission: 14,
  coupon: 5,
  shipping: 4,
  availability: 3,
  popularity: 6,
  category: 4,
};

export interface OfferScoreInput {
  discountPct?: number | null;
  price?: number | null;
  /** Menor preço já registrado no histórico, quando houver amostras suficientes. */
  lowestHistoricPrice?: number | null;
  historySamples?: number;
  rating?: number | null;
  ratingCount?: number | null;
  salesCount?: number | null;
  commissionPct?: number | null;
  hasCoupon?: boolean | null;
  freeShipping?: boolean | null;
  available?: boolean | null;
  /** 0..1 — participação da categoria nas conversões do usuário. */
  categoryAffinity?: number | null;
  /** 0..1 — sinal de popularidade agregado (cliques/impressões). */
  popularity?: number | null;
}

export interface OfferScoreResult {
  score: number;
  label: OfferScoreLabel;
  breakdown: Partial<Record<OfferScoreFactor, number>>;
  missing: OfferScoreFactor[];
}

export type OfferScoreLabel =
  | "OFERTA QUENTE"
  | "BOA OFERTA"
  | "OFERTA REGULAR"
  | "NÃO RECOMENDADA";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function scoreLabel(score: number): OfferScoreLabel {
  if (score >= 85) return "OFERTA QUENTE";
  if (score >= 70) return "BOA OFERTA";
  if (score >= 50) return "OFERTA REGULAR";
  return "NÃO RECOMENDADA";
}

export function scoreTone(score: number): "hot" | "good" | "regular" | "low" {
  if (score >= 85) return "hot";
  if (score >= 70) return "good";
  if (score >= 50) return "regular";
  return "low";
}

export function computeOfferScore(
  input: OfferScoreInput,
  weights: Partial<OfferScoreWeights> = {},
): OfferScoreResult {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const parts: Partial<Record<OfferScoreFactor, number>> = {};
  const missing: OfferScoreFactor[] = [];

  const add = (factor: OfferScoreFactor, value: number | null) => {
    if (value === null) missing.push(factor);
    else parts[factor] = clamp01(value);
  };

  add(
    "discount",
    typeof input.discountPct === "number" ? clamp01(input.discountPct / 70) : null,
  );
  add(
    "price",
    typeof input.price === "number"
      ? clamp01(1 - Math.log10(Math.max(input.price, 1)) / 3.5)
      : null,
  );
  add(
    "priceHistory",
    typeof input.lowestHistoricPrice === "number" &&
      typeof input.price === "number" &&
      (input.historySamples ?? 0) >= 3 &&
      input.lowestHistoricPrice > 0
      ? clamp01(1 - (input.price - input.lowestHistoricPrice) / input.lowestHistoricPrice)
      : null,
  );
  add(
    "rating",
    typeof input.rating === "number" ? clamp01((input.rating - 3) / 2) : null,
  );
  add(
    "ratingCount",
    typeof input.ratingCount === "number"
      ? clamp01(Math.log10(input.ratingCount + 1) / 4)
      : null,
  );
  add(
    "sales",
    typeof input.salesCount === "number"
      ? clamp01(Math.log10(input.salesCount + 1) / 4.5)
      : null,
  );
  add(
    "commission",
    typeof input.commissionPct === "number" ? clamp01(input.commissionPct / 18) : null,
  );
  add("coupon", typeof input.hasCoupon === "boolean" ? (input.hasCoupon ? 1 : 0) : null);
  add(
    "shipping",
    typeof input.freeShipping === "boolean" ? (input.freeShipping ? 1 : 0) : null,
  );
  add(
    "availability",
    typeof input.available === "boolean" ? (input.available ? 1 : 0) : null,
  );
  add("popularity", typeof input.popularity === "number" ? input.popularity : null);
  add(
    "category",
    typeof input.categoryAffinity === "number" ? input.categoryAffinity : null,
  );

  let totalWeight = 0;
  let sum = 0;
  (Object.keys(parts) as OfferScoreFactor[]).forEach((factor) => {
    totalWeight += w[factor];
    sum += w[factor] * (parts[factor] ?? 0);
  });

  const score = totalWeight === 0 ? 0 : Math.round((sum / totalWeight) * 100);
  return { score, label: scoreLabel(score), breakdown: parts, missing };
}
