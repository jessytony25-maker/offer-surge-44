/**
 * OfferIntelligenceEngine — Orquestrador central do pipeline de inteligência.
 *
 * Pipeline:
 * Captura → Normalização → Histórico de Preço → Score → Segmentação
 * → Copy → Anti-Spam → Fila
 *
 * Este motor é independente do frontend e pode ser invocado de:
 * - Server functions do TanStack Start
 * - Edge Functions do Supabase (futuro)
 * - Jobs agendados (futuro)
 */

import { computeOfferScore, type OfferScoreInput, type OfferScoreWeights, DEFAULT_WEIGHTS } from "../offer-score";
import { computePriceStats, computeRealDiscount, type PriceSnapshot } from "./PriceHistoryEngine";
import { segmentOfferToGroups, type GroupProfile, type OfferProfile } from "./SegmentationEngine";
import { generateIntelligentCopy, injectSubId, type CopyOfferInput, type CopyGenerationOptions } from "./CopyIntelligenceEngine";
import { checkAntiSpam, isWithinTimeWindow, type AntiSpamRules, type AntiSpamCheckInput } from "./AntiSpamEngine";

export interface NormalizedOffer {
  id?: string;
  productId?: string;
  title: string;
  marketplace: string;
  category?: string | null;
  price: number;
  previousPrice?: number | null;
  discountPct?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  salesCount?: number | null;
  coupon?: string | null;
  freeShipping?: boolean;
  available?: boolean;
  commissionPct?: number | null;
  commission?: number | null;
  affiliateLink?: string | null;
  imageUrl?: string | null;
}

export interface PipelineGroupConfig {
  group: GroupProfile;
  ansiSpamInput: Pick<AntiSpamCheckInput, "sentInLastHour" | "sentToday" | "lastSentAt" | "recentOfferIds">;
  antiSpamRules: AntiSpamRules;
  copyOptions: CopyGenerationOptions;
  allowedStartTime?: string;
  allowedEndTime?: string;
  subId?: string | null;
}

export interface PipelineItemResult {
  groupId: string;
  groupName: string;
  willPublish: boolean;
  blockedReason?: string;
  segmentationDecision: "yes" | "maybe" | "no";
  segmentationScore: number;
  generatedCopy: string | null;
  scoreResult: ReturnType<typeof computeOfferScore> | null;
  realDiscount: { announcedDiscountPct: number | null; historicDiscountPct: number | null; label: string } | null;
}

export interface FullPipelineResult {
  offer: NormalizedOffer;
  scoreResult: ReturnType<typeof computeOfferScore>;
  priceStats: ReturnType<typeof computePriceStats> | null;
  realDiscount: ReturnType<typeof computeRealDiscount> | null;
  groupResults: PipelineItemResult[];
  publishableCount: number;
  blockedCount: number;
  pipelineRunAt: string;
}

/**
 * Executa o pipeline completo de inteligência para uma oferta.
 */
export function runOfferPipeline(params: {
  offer: NormalizedOffer;
  priceHistory?: PriceSnapshot[];
  groups: PipelineGroupConfig[];
  scoreWeights?: Partial<OfferScoreWeights>;
  emergencyStop?: boolean;
  pilotEnabled?: boolean;
}): FullPipelineResult {
  const { offer, priceHistory = [], groups, scoreWeights = {}, emergencyStop = false, pilotEnabled = true } = params;

  // 1. Histórico de Preço
  const priceStats = priceHistory.length > 0 ? computePriceStats(priceHistory) : null;

  // 2. Desconto Real
  const realDiscount = priceStats
    ? computeRealDiscount({
        currentPrice: offer.price,
        previousPrice: offer.previousPrice,
        historicMinPrice: priceStats.minPrice,
        historicSamples: priceStats.sampleCount,
        announcedDiscountPct: offer.discountPct,
      })
    : null;

  // 3. Offer Score
  const scoreInput: OfferScoreInput = {
    discountPct: offer.discountPct,
    price: offer.price,
    lowestHistoricPrice: priceStats?.hasEnoughData ? priceStats.minPrice : null,
    historySamples: priceStats?.sampleCount ?? 0,
    rating: offer.rating,
    ratingCount: offer.ratingCount,
    salesCount: offer.salesCount,
    commissionPct: offer.commissionPct,
    hasCoupon: !!offer.coupon,
    freeShipping: offer.freeShipping,
    available: offer.available,
  };
  const scoreResult = computeOfferScore(scoreInput, { ...DEFAULT_WEIGHTS, ...scoreWeights });

  // 4. Segmentação
  const offerProfile: OfferProfile = {
    title: offer.title,
    category: offer.category,
    marketplace: offer.marketplace,
    price: offer.price,
    score: scoreResult.score,
    commissionPct: offer.commissionPct,
    tags: [offer.marketplace, offer.category].filter(Boolean) as string[],
  };
  const segResults = segmentOfferToGroups(offerProfile, groups.map((g) => g.group));

  // 5. Por grupo: Anti-Spam + Copy
  const groupResults: PipelineItemResult[] = groups.map((gConfig, idx) => {
    const segResult = segResults[idx]!;

    // Botão de emergência: bloqueia tudo
    if (emergencyStop) {
      return {
        groupId: gConfig.group.id,
        groupName: gConfig.group.name,
        willPublish: false,
        blockedReason: "⛔ PARADA DE EMERGÊNCIA ativa. Todas as publicações interrompidas.",
        segmentationDecision: segResult.decision,
        segmentationScore: segResult.score,
        generatedCopy: null,
        scoreResult,
        realDiscount: realDiscount ? { announcedDiscountPct: realDiscount.announcedDiscountPct, historicDiscountPct: realDiscount.historicDiscountPct, label: realDiscount.label } : null,
      };
    }

    // Piloto desativado: não executa automaticamente
    if (!pilotEnabled) {
      return {
        groupId: gConfig.group.id,
        groupName: gConfig.group.name,
        willPublish: false,
        blockedReason: "Piloto automático desativado. Modo manual requer aprovação.",
        segmentationDecision: segResult.decision,
        segmentationScore: segResult.score,
        generatedCopy: null,
        scoreResult,
        realDiscount: realDiscount ? { announcedDiscountPct: realDiscount.announcedDiscountPct, historicDiscountPct: realDiscount.historicDiscountPct, label: realDiscount.label } : null,
      };
    }

    // Segmentação negativa definitiva
    if (segResult.decision === "no") {
      return {
        groupId: gConfig.group.id,
        groupName: gConfig.group.name,
        willPublish: false,
        blockedReason: segResult.warnings[0] || "Oferta não segmentada para este grupo.",
        segmentationDecision: "no",
        segmentationScore: 0,
        generatedCopy: null,
        scoreResult,
        realDiscount: realDiscount ? { announcedDiscountPct: realDiscount.announcedDiscountPct, historicDiscountPct: realDiscount.historicDiscountPct, label: realDiscount.label } : null,
      };
    }

    // Janela de horário
    if (gConfig.allowedStartTime && gConfig.allowedEndTime) {
      if (!isWithinTimeWindow(gConfig.allowedStartTime, gConfig.allowedEndTime)) {
        return {
          groupId: gConfig.group.id,
          groupName: gConfig.group.name,
          willPublish: false,
          blockedReason: `Fora da janela de horário permitida (${gConfig.allowedStartTime}–${gConfig.allowedEndTime}).`,
          segmentationDecision: segResult.decision,
          segmentationScore: segResult.score,
          generatedCopy: null,
          scoreResult,
          realDiscount: realDiscount ? { announcedDiscountPct: realDiscount.announcedDiscountPct, historicDiscountPct: realDiscount.historicDiscountPct, label: realDiscount.label } : null,
        };
      }
    }

    // Anti-Spam
    const antiSpamResult = checkAntiSpam({
      groupId: gConfig.group.id,
      offerId: offer.id,
      ...gConfig.ansiSpamInput,
      rules: gConfig.antiSpamRules,
    });

    if (!antiSpamResult.canPublish) {
      return {
        groupId: gConfig.group.id,
        groupName: gConfig.group.name,
        willPublish: false,
        blockedReason: antiSpamResult.reason,
        segmentationDecision: segResult.decision,
        segmentationScore: segResult.score,
        generatedCopy: null,
        scoreResult,
        realDiscount: realDiscount ? { announcedDiscountPct: realDiscount.announcedDiscountPct, historicDiscountPct: realDiscount.historicDiscountPct, label: realDiscount.label } : null,
      };
    }

    // 5. Geração de Copy adaptada ao grupo
    const copyInput: CopyOfferInput = {
      title: offer.title,
      marketplace: offer.marketplace,
      price: offer.price,
      previousPrice: offer.previousPrice,
      discountPct: offer.discountPct,
      realDiscountPct: realDiscount?.historicDiscountPct ?? undefined,
      historicMinPrice: priceStats?.hasEnoughData ? priceStats.minPrice : null,
      rating: offer.rating,
      salesCount: offer.salesCount,
      coupon: offer.coupon,
      freeShipping: offer.freeShipping,
      score: scoreResult.score,
      affiliateLink: gConfig.subId ? injectSubId(offer.affiliateLink ?? "", gConfig.subId) : offer.affiliateLink,
    };

    const generatedCopy = generateIntelligentCopy(copyInput, {
      ...gConfig.copyOptions,
      groupNiche: gConfig.group.niche,
      positiveKeywords: gConfig.group.positiveKeywords,
    });

    return {
      groupId: gConfig.group.id,
      groupName: gConfig.group.name,
      willPublish: true,
      segmentationDecision: segResult.decision,
      segmentationScore: segResult.score,
      generatedCopy,
      scoreResult,
      realDiscount: realDiscount ? { announcedDiscountPct: realDiscount.announcedDiscountPct, historicDiscountPct: realDiscount.historicDiscountPct, label: realDiscount.label } : null,
    };
  });

  const publishableCount = groupResults.filter((r) => r.willPublish).length;
  const blockedCount = groupResults.filter((r) => !r.willPublish).length;

  return {
    offer,
    scoreResult,
    priceStats,
    realDiscount,
    groupResults,
    publishableCount,
    blockedCount,
    pipelineRunAt: new Date().toISOString(),
  };
}
