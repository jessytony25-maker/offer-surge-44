/**
 * PriceHistoryEngine — Gerencia e calcula o histórico real de preços.
 *
 * Princípio fundamental: NUNCA inventar dados. Se não há amostras
 * suficientes, retornar null e indicar "Histórico insuficiente".
 */

export interface PriceSnapshot {
  price: number;
  promoPrice?: number | null;
  originalPrice?: number | null;
  coupon?: string | null;
  freeShipping?: boolean;
  available?: boolean;
  capturedAt: string;
}

export interface PriceHistoryStats {
  sampleCount: number;
  hasEnoughData: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  avg7d: number | null;
  avg30d: number | null;
  avg90d: number | null;
  lastCapturedAt: string | null;
  currentPrice: number | null;
  variation: number | null; // percentual vs min histórico, null se sem dados
  trend: "up" | "down" | "stable" | null;
}

export interface RealDiscountResult {
  announcedDiscountPct: number | null;
  historicDiscountPct: number | null;
  hasHistoricData: boolean;
  insufficientData: boolean;
  label: string;
}

const MIN_SAMPLES = 3;

/**
 * Calcula estatísticas a partir de um array de snapshots locais.
 * Usado quando os dados já foram buscados do banco.
 */
export function computePriceStats(snapshots: PriceSnapshot[]): PriceHistoryStats {
  if (!snapshots.length) {
    return {
      sampleCount: 0,
      hasEnoughData: false,
      minPrice: null,
      maxPrice: null,
      avgPrice: null,
      avg7d: null,
      avg30d: null,
      avg90d: null,
      lastCapturedAt: null,
      currentPrice: null,
      variation: null,
      trend: null,
    };
  }

  const effectivePrices = snapshots.map((s) =>
    typeof s.promoPrice === "number" ? s.promoPrice : s.price,
  );

  const now = Date.now();
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const ms90d = 90 * 24 * 60 * 60 * 1000;

  const prices7d = snapshots
    .filter((s) => now - new Date(s.capturedAt).getTime() <= ms7d)
    .map((s) => (typeof s.promoPrice === "number" ? s.promoPrice : s.price));
  const prices30d = snapshots
    .filter((s) => now - new Date(s.capturedAt).getTime() <= ms30d)
    .map((s) => (typeof s.promoPrice === "number" ? s.promoPrice : s.price));
  const prices90d = snapshots
    .filter((s) => now - new Date(s.capturedAt).getTime() <= ms90d)
    .map((s) => (typeof s.promoPrice === "number" ? s.promoPrice : s.price));

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const minPrice = Math.min(...effectivePrices);
  const maxPrice = Math.max(...effectivePrices);
  const avgPrice = avg(effectivePrices);
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );
  const currentPrice = sorted[0]
    ? typeof sorted[0].promoPrice === "number"
      ? sorted[0].promoPrice
      : sorted[0].price
    : null;

  // Variação: quanto o preço atual está acima do mínimo histórico
  const variation =
    currentPrice !== null && minPrice > 0
      ? ((currentPrice - minPrice) / minPrice) * 100
      : null;

  // Tendência com base nos últimos 2 snapshots
  let trend: "up" | "down" | "stable" | null = null;
  if (sorted.length >= 2) {
    const p1 =
      typeof sorted[0]?.promoPrice === "number" ? sorted[0].promoPrice : sorted[0]?.price;
    const p2 =
      typeof sorted[1]?.promoPrice === "number" ? sorted[1].promoPrice : sorted[1]?.price;
    if (p1 !== undefined && p2 !== undefined) {
      if (p1 < p2 * 0.98) trend = "down";
      else if (p1 > p2 * 1.02) trend = "up";
      else trend = "stable";
    }
  }

  return {
    sampleCount: snapshots.length,
    hasEnoughData: snapshots.length >= MIN_SAMPLES,
    minPrice,
    maxPrice,
    avgPrice,
    avg7d: avg(prices7d),
    avg30d: avg(prices30d),
    avg90d: avg(prices90d),
    lastCapturedAt: sorted[0]?.capturedAt ?? null,
    currentPrice,
    variation,
    trend,
  };
}

/**
 * Calcula desconto real baseado no histórico.
 * Nunca inventa dados — retorna flags claras quando dados faltam.
 */
export function computeRealDiscount(params: {
  currentPrice: number;
  previousPrice?: number | null;
  historicMinPrice?: number | null;
  historicSamples?: number;
  announcedDiscountPct?: number | null;
}): RealDiscountResult {
  const { currentPrice, previousPrice, historicMinPrice, historicSamples = 0, announcedDiscountPct } = params;

  const hasHistoricData = (historicSamples ?? 0) >= MIN_SAMPLES && historicMinPrice !== null && historicMinPrice !== undefined;

  let historicDiscountPct: number | null = null;
  if (hasHistoricData && historicMinPrice! > 0 && currentPrice < historicMinPrice!) {
    historicDiscountPct = Math.round(((historicMinPrice! - currentPrice) / historicMinPrice!) * 100);
  } else if (hasHistoricData && historicMinPrice! > 0) {
    historicDiscountPct = Math.max(
      0,
      Math.round(((historicMinPrice! - currentPrice) / historicMinPrice!) * 100),
    );
  }

  let label = "";
  if (!hasHistoricData) {
    label = "Histórico insuficiente para calcular desconto real.";
  } else if (historicDiscountPct !== null && announcedDiscountPct !== null) {
    const diff = (announcedDiscountPct ?? 0) - (historicDiscountPct ?? 0);
    if (Math.abs(diff) <= 3) {
      label = "Desconto anunciado condiz com o histórico.";
    } else if (diff > 3) {
      label = `Desconto anunciado pode estar exagerado (${diff}pp acima do histórico).`;
    } else {
      label = `Desconto real maior do que o anunciado (${Math.abs(diff)}pp a mais).`;
    }
  } else {
    label = "Dados disponíveis para comparação parcial.";
  }

  return {
    announcedDiscountPct: announcedDiscountPct ?? null,
    historicDiscountPct,
    hasHistoricData,
    insufficientData: !hasHistoricData,
    label,
  };
}

/**
 * Formata a variação de preço para exibição.
 */
export function formatPriceVariation(variation: number | null): string {
  if (variation === null) return "Histórico insuficiente";
  if (variation < -1) return `↓ ${Math.abs(Math.round(variation))}% abaixo do mínimo histórico`;
  if (variation < 1) return "✓ No mínimo histórico";
  if (variation <= 5) return `↑ ${Math.round(variation)}% acima do mínimo histórico`;
  return `↑↑ ${Math.round(variation)}% acima do mínimo histórico`;
}
