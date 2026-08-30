/**
 * BestTimeEngine — Analisa o histórico de desempenho para recomendar
 * o melhor horário de publicação por grupo.
 *
 * NUNCA inventa recomendações. Retorna null se dados insuficientes.
 */

const MIN_SAMPLES_FOR_RECOMMENDATION = 10;

export interface HourPerformance {
  hour: number; // 0-23
  clicks: number;
  sales: number;
  publications: number;
  avgCtr: number;
  avgConversion: number;
}

export interface BestTimeResult {
  hasEnoughData: boolean;
  message: string;
  bestHour: number | null;
  bestHourRange: string | null; // "19h–21h"
  worstHour: number | null;
  hourlyBreakdown: HourPerformance[];
  bestDayOfWeek: number | null; // 0=Domingo, 6=Sábado
  bestDayLabel: string | null;
}

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function analyzeBestTime(performances: Array<{
  publishHour?: number | null;
  publishDayOfWeek?: number | null;
  clicks: number;
  sales: number;
  publicationsCount?: number;
}>): BestTimeResult {
  const validData = performances.filter((p) => p.publishHour !== null && p.publishHour !== undefined);

  if (validData.length < MIN_SAMPLES_FOR_RECOMMENDATION) {
    return {
      hasEnoughData: false,
      message: `Dados insuficientes para recomendar horário (${validData.length}/${MIN_SAMPLES_FOR_RECOMMENDATION} amostras necessárias).`,
      bestHour: null,
      bestHourRange: null,
      worstHour: null,
      hourlyBreakdown: [],
      bestDayOfWeek: null,
      bestDayLabel: null,
    };
  }

  // Agrupa por hora
  const byHour = new Map<number, { clicks: number; sales: number; publications: number }>();
  for (const p of validData) {
    const h = p.publishHour!;
    const existing = byHour.get(h) ?? { clicks: 0, sales: 0, publications: 0 };
    byHour.set(h, {
      clicks: existing.clicks + (p.clicks || 0),
      sales: existing.sales + (p.sales || 0),
      publications: existing.publications + (p.publicationsCount || 1),
    });
  }

  const hourlyBreakdown: HourPerformance[] = [];
  byHour.forEach((data, hour) => {
    hourlyBreakdown.push({
      hour,
      clicks: data.clicks,
      sales: data.sales,
      publications: data.publications,
      avgCtr: data.publications > 0 ? data.clicks / data.publications : 0,
      avgConversion: data.clicks > 0 ? data.sales / data.clicks : 0,
    });
  });

  hourlyBreakdown.sort((a, b) => b.avgCtr - a.avgCtr);

  const bestHour = hourlyBreakdown[0]?.hour ?? null;
  const worstHour = hourlyBreakdown[hourlyBreakdown.length - 1]?.hour ?? null;
  const bestHourRange = bestHour !== null ? `${bestHour}h–${(bestHour + 2) % 24}h` : null;

  // Melhor dia da semana
  const byDay = new Map<number, { clicks: number; sales: number; publications: number }>();
  for (const p of validData) {
    if (p.publishDayOfWeek !== null && p.publishDayOfWeek !== undefined) {
      const d = p.publishDayOfWeek;
      const existing = byDay.get(d) ?? { clicks: 0, sales: 0, publications: 0 };
      byDay.set(d, {
        clicks: existing.clicks + (p.clicks || 0),
        sales: existing.sales + (p.sales || 0),
        publications: existing.publications + (p.publicationsCount || 1),
      });
    }
  }

  let bestDayOfWeek: number | null = null;
  let bestDayCtr = -1;
  byDay.forEach((data, day) => {
    const ctr = data.publications > 0 ? data.clicks / data.publications : 0;
    if (ctr > bestDayCtr) {
      bestDayCtr = ctr;
      bestDayOfWeek = day;
    }
  });

  return {
    hasEnoughData: true,
    message: bestHour !== null
      ? `Melhor horário para publicação: ${bestHourRange} (baseado em ${validData.length} amostras).`
      : "Dados disponíveis mas padrão ainda não identificado.",
    bestHour,
    bestHourRange,
    worstHour,
    hourlyBreakdown,
    bestDayOfWeek,
    bestDayLabel: bestDayOfWeek !== null ? (DAY_LABELS[bestDayOfWeek] ?? null) : null,
  };
}
