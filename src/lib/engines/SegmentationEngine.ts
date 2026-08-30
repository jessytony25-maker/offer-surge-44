/**
 * SegmentationEngine — Analisa uma oferta e recomenda grupos de destino.
 *
 * Usa: categoria, palavras-chave, marketplace, faixa de preço, score,
 * perfil do grupo (nicho, palavras positivas/negativas, categorias bloqueadas).
 *
 * Nunca força envio para grupos incompatíveis.
 * Sempre permite substituição manual.
 */

export type SegmentationDecision = "yes" | "maybe" | "no";

export interface GroupProfile {
  id: string;
  name: string;
  niche?: string | null;
  positiveKeywords?: string[];
  negativeKeywords?: string[];
  allowedCategories?: string[];
  blockedCategories?: string[];
  allowedMarketplaces?: string[];
  minScore?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  minCommissionPct?: number | null;
}

export interface OfferProfile {
  title: string;
  category?: string | null;
  marketplace?: string | null;
  price?: number | null;
  score?: number;
  commissionPct?: number | null;
  tags?: string[];
}

export interface SegmentationResult {
  groupId: string;
  groupName: string;
  decision: SegmentationDecision;
  score: number; // 0-100: relevância calculada
  reasons: string[];
  warnings: string[];
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s,\-_]+/).filter((w) => w.length > 2);
}

function countKeywordMatches(tokens: string[], keywords: string[]): number {
  let count = 0;
  for (const kw of keywords) {
    const kwTokens = tokenize(kw);
    if (kwTokens.some((kt) => tokens.some((t) => t.includes(kt) || kt.includes(t)))) {
      count++;
    }
  }
  return count;
}

export function segmentOfferToGroups(
  offer: OfferProfile,
  groups: GroupProfile[],
): SegmentationResult[] {
  const offerTokens = tokenize(offer.title + " " + (offer.category ?? "") + " " + (offer.tags ?? []).join(" "));

  return groups.map((group): SegmentationResult => {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let segScore = 50; // começa neutro

    // 1. Marketplace permitido
    if (group.allowedMarketplaces?.length && offer.marketplace) {
      if (!group.allowedMarketplaces.includes(offer.marketplace)) {
        return {
          groupId: group.id,
          groupName: group.name,
          decision: "no",
          score: 0,
          reasons: [],
          warnings: [`Marketplace "${offer.marketplace}" não permitido neste grupo.`],
        };
      }
      segScore += 5;
      reasons.push(`Marketplace "${offer.marketplace}" compatível.`);
    }

    // 2. Categoria bloqueada
    if (group.blockedCategories?.length && offer.category) {
      if (group.blockedCategories.includes(offer.category.toLowerCase())) {
        return {
          groupId: group.id,
          groupName: group.name,
          decision: "no",
          score: 0,
          reasons: [],
          warnings: [`Categoria "${offer.category}" bloqueada neste grupo.`],
        };
      }
    }

    // 3. Categoria permitida
    if (group.allowedCategories?.length && offer.category) {
      if (group.allowedCategories.includes(offer.category.toLowerCase())) {
        segScore += 15;
        reasons.push(`Categoria "${offer.category}" compatível.`);
      } else {
        segScore -= 10;
        warnings.push(`Categoria "${offer.category}" não está na lista preferida do grupo.`);
      }
    }

    // 4. Score mínimo
    if (group.minScore !== undefined && offer.score !== undefined) {
      if (offer.score < group.minScore) {
        return {
          groupId: group.id,
          groupName: group.name,
          decision: "no",
          score: 0,
          reasons: [],
          warnings: [`Score da oferta (${offer.score}) abaixo do mínimo exigido (${group.minScore}).`],
        };
      }
      segScore += Math.min(20, ((offer.score - group.minScore) / (100 - group.minScore)) * 20);
      reasons.push(`Score ${offer.score} ≥ mínimo ${group.minScore}.`);
    }

    // 5. Faixa de preço
    if (group.minPrice !== null && group.minPrice !== undefined && offer.price !== null && offer.price !== undefined) {
      if (offer.price < group.minPrice) {
        segScore -= 15;
        warnings.push(`Preço (R$${offer.price?.toFixed(2)}) abaixo do mínimo do grupo (R$${group.minPrice?.toFixed(2)}).`);
      }
    }
    if (group.maxPrice !== null && group.maxPrice !== undefined && offer.price !== null && offer.price !== undefined) {
      if (offer.price > group.maxPrice) {
        segScore -= 15;
        warnings.push(`Preço (R$${offer.price?.toFixed(2)}) acima do máximo do grupo (R$${group.maxPrice?.toFixed(2)}).`);
      }
    }

    // 6. Palavras-chave positivas
    if (group.positiveKeywords?.length) {
      const matches = countKeywordMatches(offerTokens, group.positiveKeywords);
      if (matches > 0) {
        const bonus = Math.min(25, matches * 8);
        segScore += bonus;
        reasons.push(`${matches} palavra(s)-chave positiva(s) encontrada(s): relevante para o grupo.`);
      }
    }

    // 7. Palavras-chave negativas
    if (group.negativeKeywords?.length) {
      const negMatches = countKeywordMatches(offerTokens, group.negativeKeywords);
      if (negMatches > 0) {
        segScore -= Math.min(40, negMatches * 15);
        warnings.push(`${negMatches} palavra(s)-chave negativa(s) encontrada(s): oferta pode não ser relevante.`);
      }
    }

    // 8. Nicho do grupo vs título da oferta
    if (group.niche) {
      const nicheTokens = tokenize(group.niche);
      const nicheMatch = nicheTokens.some((nt) => offerTokens.some((ot) => ot.includes(nt) || nt.includes(ot)));
      if (nicheMatch) {
        segScore += 10;
        reasons.push(`Nicho "${group.niche}" compatível com a oferta.`);
      }
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(segScore)));
    const decision: SegmentationDecision =
      finalScore >= 65 ? "yes" : finalScore >= 40 ? "maybe" : "no";

    return {
      groupId: group.id,
      groupName: group.name,
      decision,
      score: finalScore,
      reasons,
      warnings,
    };
  });
}
